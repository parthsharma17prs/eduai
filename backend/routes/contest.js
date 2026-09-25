import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import CodingContest from '../models/CodingContest.js';
import {verifyAuth} from '../middleware/auth.js';

const router=express.Router();

const GROQ_URL='https://api.groq.com/openai/v1/chat/completions';
const GROQ_TIMEOUT=30000;

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
        exists=await CodingContest.exists({code});
    } while (exists);
    return code;
}

async function callGroq(messages, opts={})
{
    const {model=process.env.GROQ_MODEL || 'openai/gpt-oss-120b', temperature=0.6, max_tokens=4000}=opts;
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

// ── AI Challenge Generation ────────────────────────────────────────────────────
router.post('/generate-challenges', verifyAuth, async (req, res) =>
{
    const {topic, count=3, difficulty='medium', existingChallenges=[]}=req.body;
    if (!topic) return res.status(400).json({success: false, error: 'topic is required'});

    const skipText=existingChallenges.length
        ? `\nAvoid repeating these problems:\n${existingChallenges.map((c, i) => `${i+1}. ${c.title}`).join('\n')}`
        :'';

    const pointsMap={easy: 100, medium: 150, hard: 200};

    const prompt=`Generate ${count} ${difficulty} coding challenge problems about: "${topic}".
${skipText}
Each problem should be suitable for a competitive programming contest.

Return ONLY a valid JSON array with this format:
[
  {
    "title": "Problem Title",
    "description": "Clear problem statement explaining what to solve. Include input/output format.",
    "difficulty": "${difficulty}",
    "points": ${pointsMap[difficulty]||150},
    "timeLimit": ${difficulty==='easy'? 20:difficulty==='medium'? 30:45},
    "examples": [
      {"input": "example input 1", "output": "expected output 1", "explanation": "why this is the answer"},
      {"input": "example input 2", "output": "expected output 2", "explanation": "explanation"}
    ],
    "constraints": ["1 <= n <= 1000", "Input fits in 32-bit integer"],
    "testCases": [
      {"input": "test1 input", "output": "test1 output", "hidden": false},
      {"input": "test2 input", "output": "test2 output", "hidden": false},
      {"input": "hidden test input", "output": "hidden output", "hidden": true},
      {"input": "hidden test 2", "output": "hidden output 2", "hidden": true}
    ],
    "starterCode": {
      "javascript": "function solution(input) {\\n  // Write your code here\\n  return result;\\n}",
      "python": "def solution(input):\\n    # Write your code here\\n    return result",
      "java": "public class Solution {\\n    public static String solution(String input) {\\n        // Write your code here\\n        return result;\\n    }\\n}",
      "cpp": "#include <string>\\nusing namespace std;\\n\\nstring solution(string input) {\\n    // Write your code here\\n    return result;\\n}"
    },
    "functionName": {"javascript": "solution", "python": "solution", "java": "solution", "cpp": "solution"},
    "hints": ["Think about edge cases", "Consider using a hash map for O(1) lookups"]
  }
]`;

    try
    {
        const raw=await callGroq([
            {role: 'system', content: 'You are a competitive programming problem generator. Generate clear, well-structured coding challenges with proper test cases. Always return valid JSON arrays only.'},
            {role: 'user', content: prompt},
        ]);

        const challenges=safeParseJSON(raw);
        if (!Array.isArray(challenges)||challenges.length===0)
        {
            return res.status(500).json({success: false, error: 'AI failed to generate valid challenges. Please retry.'});
        }

        // Sanitize
        const sanitized=challenges.map(c => ({
            title: String(c.title||'').trim(),
            description: String(c.description||'').trim(),
            difficulty: ['easy', 'medium', 'hard'].includes(c.difficulty)? c.difficulty:difficulty,
            points: Number(c.points)||pointsMap[difficulty],
            timeLimit: Number(c.timeLimit)||30,
            examples: Array.isArray(c.examples)? c.examples.slice(0, 3):[],
            constraints: Array.isArray(c.constraints)? c.constraints:[],
            testCases: Array.isArray(c.testCases)? c.testCases.map(tc => ({
                input: String(tc.input||''),
                output: String(tc.output||''),
                hidden: !!tc.hidden,
            })):[],
            starterCode: c.starterCode||{},
            functionName: c.functionName||{javascript: 'solution', python: 'solution', java: 'solution', cpp: 'solution'},
            hints: Array.isArray(c.hints)? c.hints:[],
        })).filter(c => c.title&&c.description);

        return res.json({success: true, challenges: sanitized});
    } catch (err)
    {
        console.error('[CONTEST] AI generation error:', err.message);
        return res.status(500).json({success: false, error: 'AI service error. Please try again.'});
    }
});

// ── CRUD ───────────────────────────────────────────────────────────────────────
// POST /api/contest/create
router.post('/create', verifyAuth, async (req, res) =>
{
    const {title, topic, description='', difficulty='medium', duration=90, settings={}}=req.body;
    if (!title||!topic) return res.status(400).json({success: false, error: 'title and topic are required'});

    const code=await generateUniqueCode();
    const contest=await CodingContest.create({
        code,
        title: title.trim(),
        topic: topic.trim(),
        description: description.trim(),
        difficulty,
        duration: Math.max(15, Math.min(480, Number(duration)||90)),
        hostId: req.user.userId,
        hostName: req.user.username||req.user.name||'Host',
        challenges: [],
        participants: [],
        settings: {
            showLeaderboardLive: settings.showLeaderboardLive!==false,
            allowLateJoin: settings.allowLateJoin!==false,
            partialScoring: settings.partialScoring!==false,
            allowedLanguages: settings.allowedLanguages||['javascript', 'python', 'java', 'cpp'],
        },
    });

    return res.status(201).json({success: true, contest: contestSummary(contest)});
});

// GET /api/contest/my-contests
router.get('/my-contests', verifyAuth, async (req, res) =>
{
    const contests=await CodingContest.find(
        {hostId: req.user.userId}
    ).sort({createdAt: -1}).limit(50);

    return res.json({success: true, contests: contests.map(contestSummary)});
});

// GET /api/contest/browse (public list)
router.get('/browse', async (req, res) =>
{
    try
    {
        const contests=await CodingContest.find(
            {status: {$in: ['waiting', 'active']}},
            {'challenges.testCases': 0}
        ).sort({createdAt: -1}).limit(50);

        return res.json({
            success: true,
            contests: contests.map(c => ({
                id: c._id,
                code: c.code,
                title: c.title,
                topic: c.topic,
                difficulty: c.difficulty,
                status: c.status,
                hostName: c.hostName,
                challengeCount: (c.challenges||[]).length,
                participantCount: (c.participants||[]).length,
                duration: c.duration,
                createdAt: c.createdAt,
            })),
        });
    } catch (err)
    {
        console.error('[CONTEST] browse error:', err.message);
        return res.status(500).json({success: false, error: 'Server error'});
    }
});

// GET /api/contest/room/:code (participant join lookup)
router.get('/room/:code', async (req, res) =>
{
    const contest=await CodingContest.findOne(
        {code: req.params.code.toUpperCase()},
        {challenges: 0, participants: 0}
    );
    if (!contest) return res.status(404).json({success: false, error: 'Contest not found. Check the room code.'});
    if (contest.status==='completed') return res.status(410).json({success: false, error: 'This contest has already ended.'});

    return res.json({
        success: true,
        contest: {
            id: contest._id,
            code: contest.code,
            title: contest.title,
            topic: contest.topic,
            difficulty: contest.difficulty,
            hostName: contest.hostName,
            status: contest.status,
            challengeCount: contest.challenges?.length||0,
            duration: contest.duration,
        },
    });
});

// GET /api/contest/:id (host only)
router.get('/:id', verifyAuth, async (req, res) =>
{
    try
    {
        if (!mongoose.isValidObjectId(req.params.id))
            return res.status(404).json({success: false, error: 'Contest not found'});

        const contest=await CodingContest.findById(req.params.id);
        if (!contest) return res.status(404).json({success: false, error: 'Contest not found'});
        if (String(contest.hostId)!==String(req.user.userId))
            return res.status(403).json({success: false, error: 'Forbidden'});

        return res.json({success: true, contest});
    } catch (err)
    {
        return res.status(500).json({success: false, error: err.message});
    }
});

// PUT /api/contest/:id
router.put('/:id', verifyAuth, async (req, res) =>
{
    const contest=await CodingContest.findById(req.params.id);
    if (!contest) return res.status(404).json({success: false, error: 'Contest not found'});
    if (String(contest.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (contest.status!=='draft')
        return res.status(400).json({success: false, error: 'Cannot edit a contest once it is published/live'});

    const {title, topic, description, difficulty, duration, settings}=req.body;
    if (title) contest.title=title.trim();
    if (topic) contest.topic=topic.trim();
    if (description!==undefined) contest.description=description.trim();
    if (difficulty) contest.difficulty=difficulty;
    if (duration) contest.duration=Math.max(15, Math.min(480, Number(duration)));
    if (settings) contest.settings={...contest.settings.toObject(), ...settings};

    await contest.save();
    return res.json({success: true, contest: contestSummary(contest)});
});

// DELETE /api/contest/:id
router.delete('/:id', verifyAuth, async (req, res) =>
{
    const contest=await CodingContest.findById(req.params.id);
    if (!contest) return res.status(404).json({success: false, error: 'Contest not found'});
    if (String(contest.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (contest.status==='active')
        return res.status(400).json({success: false, error: 'Cannot delete an active contest'});

    await contest.deleteOne();
    return res.json({success: true});
});

// POST /api/contest/:id/challenges (add or replace challenges)
router.post('/:id/challenges', verifyAuth, async (req, res) =>
{
    const contest=await CodingContest.findById(req.params.id);
    if (!contest) return res.status(404).json({success: false, error: 'Contest not found'});
    if (String(contest.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (!['draft', 'waiting'].includes(contest.status))
        return res.status(400).json({success: false, error: 'Cannot modify challenges once contest is live'});

    const {challenges, replace=false}=req.body;
    if (!Array.isArray(challenges)) return res.status(400).json({success: false, error: 'challenges must be an array'});

    const sanitized=challenges.map(c => ({
        title: String(c.title||'').trim(),
        description: String(c.description||'').trim(),
        difficulty: ['easy', 'medium', 'hard'].includes(c.difficulty)? c.difficulty:'medium',
        points: Number(c.points)||100,
        timeLimit: Number(c.timeLimit)||30,
        examples: Array.isArray(c.examples)? c.examples:[],
        constraints: Array.isArray(c.constraints)? c.constraints:[],
        testCases: Array.isArray(c.testCases)? c.testCases:[],
        starterCode: c.starterCode||{},
        functionName: c.functionName||{},
        hints: Array.isArray(c.hints)? c.hints:[],
    })).filter(c => c.title&&c.description);

    if (replace)
        contest.challenges=sanitized;
    else
        contest.challenges.push(...sanitized);

    await contest.save();
    return res.json({success: true, challenges: contest.challenges, count: contest.challenges.length});
});

// DELETE /api/contest/:id/challenges/:idx
router.delete('/:id/challenges/:idx', verifyAuth, async (req, res) =>
{
    const contest=await CodingContest.findById(req.params.id);
    if (!contest) return res.status(404).json({success: false, error: 'Contest not found'});
    if (String(contest.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});

    const idx=parseInt(req.params.idx);
    if (isNaN(idx)||idx<0||idx>=contest.challenges.length)
        return res.status(400).json({success: false, error: 'Invalid challenge index'});

    contest.challenges.splice(idx, 1);
    await contest.save();
    return res.json({success: true, challenges: contest.challenges});
});

// POST /api/contest/:id/publish
router.post('/:id/publish', verifyAuth, async (req, res) =>
{
    const contest=await CodingContest.findById(req.params.id);
    if (!contest) return res.status(404).json({success: false, error: 'Contest not found'});
    if (String(contest.hostId)!==String(req.user.userId))
        return res.status(403).json({success: false, error: 'Forbidden'});
    if (contest.challenges.length===0)
        return res.status(400).json({success: false, error: 'Add at least one challenge before publishing'});
    if (contest.status!=='draft')
        return res.status(400).json({success: false, error: 'Contest is already published'});

    contest.status='waiting';
    await contest.save();
    return res.json({success: true, contest: contestSummary(contest)});
});

// GET /api/contest/:id/results
router.get('/:id/results', verifyAuth, async (req, res) =>
{
    const contest=await CodingContest.findById(req.params.id);
    if (!contest) return res.status(404).json({success: false, error: 'Contest not found'});
    if (contest.status!=='completed') return res.status(400).json({success: false, error: 'Contest is not completed yet'});

    const leaderboard=buildLeaderboard(contest);
    const challengeStats=contest.challenges.map((c, i) =>
    {
        const submissions=contest.participants.map(p => p.submissions?.find(s => s.challengeIndex===i)).filter(Boolean);
        const solved=submissions.filter(s => s.passed===s.total&&s.total>0).length;
        return {
            index: i,
            title: c.title,
            difficulty: c.difficulty,
            points: c.points,
            totalSubmissions: submissions.length,
            solvedCount: solved,
            solveRate: submissions.length? Math.round((solved/submissions.length)*100):0,
        };
    });

    return res.json({
        success: true,
        contest: {
            id: contest._id,
            title: contest.title,
            topic: contest.topic,
            code: contest.code,
            startedAt: contest.startedAt,
            endedAt: contest.endedAt,
            totalParticipants: contest.participants.length,
        },
        leaderboard,
        challengeStats,
    });
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function contestSummary(contest)
{
    return {
        id: contest._id,
        code: contest.code,
        title: contest.title,
        topic: contest.topic,
        description: contest.description,
        difficulty: contest.difficulty,
        status: contest.status,
        challengeCount: (contest.challenges||[]).length,
        participantCount: (contest.participants||[]).length,
        duration: contest.duration||90,
        endsAt: contest.endsAt,
        settings: contest.settings,
        createdAt: contest.createdAt,
        startedAt: contest.startedAt,
        endedAt: contest.endedAt,
    };
}

export function buildLeaderboard(contest)
{
    return contest.participants
        .map(p => ({
            name: p.name,
            participantId: p.participantId,
            score: p.score,
            solvedCount: p.solvedCount||0,
            submissions: (p.submissions||[]).length,
            integrityScore: p.integrityScore??100,
            totalPenalty: p.totalPenalty||0,
            violations: (p.proctoringViolations||[]).length,
        }))
        .sort((a, b) =>
        {
            if (b.score!==a.score) return b.score-a.score;
            return b.solvedCount-a.solvedCount;
        })
        .map((p, i) => ({...p, rank: i+1}));
}

export default router;
