import express from 'express';
import axios from 'axios';
import Quiz from '../models/Quiz.js';
import {verifyAuth} from '../middleware/auth.js';

const router=express.Router();

const GROQ_URL='https://api.groq.com/openai/v1/chat/completions';
const GROQ_TIMEOUT=20000;

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateCode()
{
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code='';
    for (let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
    return code;
}

async function generateUniqueCode()
{
    let code, exists;
    do
    {
        code=generateCode();
        exists=await Quiz.exists({code});
    } while (exists);
    return code;
}

async function callGroq(messages, opts={})
{
    const {model=process.env.GROQ_MODEL || 'openai/gpt-oss-120b', temperature=0.6, max_tokens=2000}=opts;
    const res=await axios.post(
        GROQ_URL,
        {messages, model, temperature, max_tokens},
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            timeout: GROQ_TIMEOUT,
        }
    );
    return res.data.choices[0]?.message?.content||'';
}

function safeParseJSON(text)
{
    try
    {
        const cleaned=text.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const match=cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (!match) return null;
        return JSON.parse(match[0]);
    } catch
    {
        return null;
    }
}

// ── AI Question Generation ─────────────────────────────────────────────────────
// POST /api/quiz/generate-questions
router.post('/generate-questions', verifyAuth, async (req, res) =>
{
    const {topic, count=5, difficulty='medium', type='mcq', existingQuestions=[]}=req.body;
    if (!topic) return res.status(400).json({success: false, error: 'topic is required'});

    const skipText=existingQuestions.length
        ? `\nAvoid repeating these questions already in the quiz:\n${existingQuestions.map((q, i) => `${i+1}. ${q.text}`).join('\n')}`
        :'';

    const typeInstructions=type==='mcq'
        ? `Each question must have exactly 4 options (A,B,C,D) labeled as an array. "correctAnswer" is the exact text of the correct option.`
        :`"options" should be an empty array []. "correctAnswer" is a concise ideal answer string.`;

    const prompt=`Generate ${count} ${difficulty} ${type==='mcq'? 'multiple-choice':'short-answer'} quiz questions about: "${topic}".
${skipText}
${typeInstructions}
For each question also provide an "explanation" (1-2 sentences why that answer is correct).
Difficulty: ${difficulty}
Return ONLY a valid JSON array, no markdown, no extra text. Format:
[
  {
    "text": "question text here?",
    "type": "${type}",
    "options": ["option A", "option B", "option C", "option D"],
    "correctAnswer": "option A",
    "explanation": "explanation here",
    "points": ${difficulty==='easy'? 10:difficulty==='medium'? 15:20},
    "timeLimit": ${difficulty==='easy'? 15:difficulty==='medium'? 20:30},
    "difficulty": "${difficulty}"
  }
]`;

    try
    {
        const raw=await callGroq([
            {role: 'system', content: 'You are a quiz question generator. Always return valid JSON arrays only.'},
            {role: 'user', content: prompt},
        ]);

        const questions=safeParseJSON(raw);
        if (!Array.isArray(questions)||questions.length===0)
        {
            return res.status(500).json({success: false, error: 'AI failed to generate valid questions. Please retry.'});
        }

        // Sanitize
        const sanitized=questions.map(q => ({
            text: String(q.text||'').trim(),
            type: q.type==='short'? 'short':'mcq',
            options: Array.isArray(q.options)? q.options.map(String):[],
            correctAnswer: String(q.correctAnswer||'').trim(),
            explanation: String(q.explanation||'').trim(),
            points: Number(q.points)||10,
            timeLimit: Number(q.timeLimit)||20,
            difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty)? q.difficulty:difficulty,
        })).filter(q => q.text&&q.correctAnswer);

        return res.json({success: true, questions: sanitized});
    } catch (err)
    {
        console.error('[QUIZ] AI generation error:', err.message);
        return res.status(500).json({success: false, error: 'AI service error. Please try again.'});
    }
});

// ── CRUD ───────────────────────────────────────────────────────────────────────
// POST /api/quiz/create
router.post('/create', verifyAuth, async (req, res) =>
{
    const {title, topic, description='', difficulty='medium', questionTimeLimit=20, duration=60, settings={}}=req.body;
    if (!title||!topic) return res.status(400).json({success: false, error: 'title and topic are required'});

    const code=await generateUniqueCode();
    const quiz=await Quiz.create({
        code,
        title: title.trim(),
        topic: topic.trim(),
        description: description.trim(),
        difficulty,
        questionTimeLimit: Number(questionTimeLimit)||20,
        duration: Math.max(1, Math.min(1440, Number(duration)||60)),
        hostId: req.user.userId,
        hostName: req.user.username||req.user.name||'Host',
        questions: [],
        participants: [],
        settings: {
            showLeaderboardAfterEach: settings.showLeaderboardAfterEach!==false,
            allowLateJoin: settings.allowLateJoin!==false,
            shuffleQuestions: !!settings.shuffleQuestions,
            shuffleOptions: !!settings.shuffleOptions,
        },
    });

    return res.status(201).json({success: true, quiz: quizSummary(quiz)});
});

// GET /api/quiz/my-quizzes
router.get('/my-quizzes', verifyAuth, async (req, res) =>
{
    const quizzes=await Quiz.find(
        {hostId: req.user.userId}
    ).sort({createdAt: -1}).limit(50);

    return res.json({success: true, quizzes: quizzes.map(quizSummary)});
});

// GET /api/quiz/browse  (no auth – public list of waiting/active quizzes)
router.get('/browse', async (req, res) =>
{
    try
    {
        const quizzes=await Quiz.find(
            {status: {$in: ['waiting', 'active', 'question_open', 'question_closed']}},
            {'questions.correctAnswer': 0, 'questions.explanation': 0}
        ).sort({createdAt: -1}).limit(50);

        return res.json({
            success: true,
            quizzes: quizzes.map(q => ({
                id: q._id,
                code: q.code,
                title: q.title,
                topic: q.topic,
                difficulty: q.difficulty,
                status: q.status,
                hostName: q.hostName,
                questionCount: (q.questions||[]).length,
                participantCount: (q.participants||[]).length,
                createdAt: q.createdAt,
            })),
        });
    } catch (err)
    {
        console.error('[QUIZ] browse error:', err.message);
        return res.status(500).json({success: false, error: 'Server error'});
    }
});

// GET /api/quiz/room/:code  (no auth – participant join lookup)
router.get('/room/:code', async (req, res) =>
{
    const quiz=await Quiz.findOne(
        {code: req.params.code.toUpperCase()},
        {questions: 0, participants: 0, 'questions.correctAnswer': 0}
    );
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found. Check the room code.'});
    if (quiz.status==='completed') return res.status(410).json({success: false, error: 'This quiz has already ended.'});

    return res.json({
        success: true,
        quiz: {
            id: quiz._id,
            code: quiz.code,
            title: quiz.title,
            topic: quiz.topic,
            difficulty: quiz.difficulty,
            hostName: quiz.hostName,
            status: quiz.status,
            questionCount: quiz.questions.length,
        },
    });
});

// GET /api/quiz/:id  (host only)
router.get('/:id', verifyAuth, async (req, res) =>
{
    const quiz=await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found'});
    if (String(quiz.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});

    return res.json({success: true, quiz});
});

// PUT /api/quiz/:id  (update metadata or settings)
router.put('/:id', verifyAuth, async (req, res) =>
{
    const quiz=await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found'});
    if (String(quiz.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (quiz.status!=='draft')
        return res.status(400).json({success: false, error: 'Cannot edit a quiz once it is published/live'});

    const {title, topic, description, difficulty, questionTimeLimit, duration, settings}=req.body;
    if (title) quiz.title=title.trim();
    if (topic) quiz.topic=topic.trim();
    if (description!==undefined) quiz.description=description.trim();
    if (difficulty) quiz.difficulty=difficulty;
    if (questionTimeLimit) quiz.questionTimeLimit=Number(questionTimeLimit);
    if (duration) quiz.duration=Math.max(1, Math.min(1440, Number(duration)));
    if (settings) quiz.settings={...quiz.settings.toObject(), ...settings};

    await quiz.save();
    return res.json({success: true, quiz: quizSummary(quiz)});
});

// DELETE /api/quiz/:id
router.delete('/:id', verifyAuth, async (req, res) =>
{
    const quiz=await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found'});
    if (String(quiz.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (['active', 'question_open', 'question_closed'].includes(quiz.status))
        return res.status(400).json({success: false, error: 'Cannot delete an active quiz'});

    await quiz.deleteOne();
    return res.json({success: true});
});

// POST /api/quiz/:id/questions  (add or replace all questions)
router.post('/:id/questions', verifyAuth, async (req, res) =>
{
    const quiz=await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found'});
    if (String(quiz.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (!['draft', 'waiting'].includes(quiz.status))
        return res.status(400).json({success: false, error: 'Cannot modify questions once quiz is live'});

    const {questions, replace=false}=req.body;
    if (!Array.isArray(questions)) return res.status(400).json({success: false, error: 'questions must be an array'});

    const sanitized=questions.map(q => ({
        text: String(q.text||'').trim(),
        type: q.type==='short'? 'short':'mcq',
        options: Array.isArray(q.options)? q.options.map(String):[],
        correctAnswer: String(q.correctAnswer||'').trim(),
        explanation: String(q.explanation||'').trim(),
        points: Number(q.points)||10,
        timeLimit: Number(q.timeLimit)||quiz.questionTimeLimit||20,
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty)? q.difficulty:'medium',
    })).filter(q => q.text&&q.correctAnswer);

    if (replace)
        quiz.questions=sanitized;
    else
        quiz.questions.push(...sanitized);

    await quiz.save();
    return res.json({success: true, questions: quiz.questions, count: quiz.questions.length});
});

// DELETE /api/quiz/:id/questions/:idx
router.delete('/:id/questions/:idx', verifyAuth, async (req, res) =>
{
    const quiz=await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found'});
    if (String(quiz.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});

    const idx=parseInt(req.params.idx);
    if (isNaN(idx)||idx<0||idx>=quiz.questions.length)
        return res.status(400).json({success: false, error: 'Invalid question index'});

    quiz.questions.splice(idx, 1);
    await quiz.save();
    return res.json({success: true, questions: quiz.questions});
});

// POST /api/quiz/:id/publish
router.post('/:id/publish', verifyAuth, async (req, res) =>
{
    const quiz=await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found'});
    if (String(quiz.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (quiz.questions.length===0)
        return res.status(400).json({success: false, error: 'Add at least one question before publishing'});
    if (quiz.status!=='draft')
        return res.status(400).json({success: false, error: 'Quiz is already published'});

    quiz.status='waiting';
    await quiz.save();
    return res.json({success: true, quiz: quizSummary(quiz)});
});

// GET /api/quiz/:id/results  (host or participant – after completion)
router.get('/:id/results', verifyAuth, async (req, res) =>
{
    const quiz=await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({success: false, error: 'Quiz not found'});
    if (quiz.status!=='completed') return res.status(400).json({success: false, error: 'Quiz is not completed yet'});

    const leaderboard=buildLeaderboard(quiz);
    const questionStats=quiz.questions.map((q, i) =>
    {
        const answers=quiz.participants.map(p => p.answers.find(a => a.questionIndex===i)).filter(Boolean);
        const correct=answers.filter(a => a.correct).length;
        return {
            index: i,
            text: q.text,
            type: q.type,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            totalAnswered: answers.length,
            correctCount: correct,
            accuracy: answers.length? Math.round((correct/answers.length)*100):0,
        };
    });

    return res.json({
        success: true,
        quiz: {
            id: quiz._id,
            title: quiz.title,
            topic: quiz.topic,
            code: quiz.code,
            startedAt: quiz.startedAt,
            endedAt: quiz.endedAt,
            totalParticipants: quiz.participants.length,
        },
        leaderboard,
        questionStats,
    });
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function quizSummary(quiz)
{
    return {
        id: quiz._id,
        code: quiz.code,
        title: quiz.title,
        topic: quiz.topic,
        description: quiz.description,
        difficulty: quiz.difficulty,
        status: quiz.status,
        questionCount: (quiz.questions||[]).length,
        participantCount: (quiz.participants||[]).length,
        questionTimeLimit: quiz.questionTimeLimit,
        duration: quiz.duration||60,
        endsAt: quiz.endsAt,
        settings: quiz.settings,
        createdAt: quiz.createdAt,
        startedAt: quiz.startedAt,
        endedAt: quiz.endedAt,
    };
}

export function buildLeaderboard(quiz)
{
    return quiz.participants
        .map(p => ({
            name: p.name,
            participantId: p.participantId,
            score: p.score,
            streak: p.streak,
            answers: p.answers.length,
            integrityScore: p.integrityScore??100,
            totalPenalty: p.totalPenalty||0,
            violations: (p.proctoringViolations||[]).length,
        }))
        .sort((a, b) => b.score-a.score)
        .map((p, i) => ({...p, rank: i+1}));
}

export default router;
