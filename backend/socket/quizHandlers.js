/**
 * Quiz Socket Handlers – Self-Paced Mode
 * 
 * When the host starts a quiz, ALL questions become available at once.
 * Participants can join at any time during the quiz window and go through
 * questions at their own pace. The quiz auto-ends after the configured
 * duration (default 60 minutes).
 *
 * Events (client → server):
 *   quiz:host-join          { quizId }
 *   quiz:participant-join   { code, name, userId? }
 *   quiz:start              { quizId }
 *   quiz:submit-answer      { quizId, questionIndex, answer, timeMs }
 *   quiz:end                { quizId }
 *
 * Events (server → client):
 *   quiz:joined             { quiz, participants, role, questions?, endsAt? }
 *   quiz:participant-update { participants }
 *   quiz:started            { questions, totalQuestions, endsAt, duration }
 *   quiz:answer-result      { correct, pointsEarned, totalScore, rank, ... }
 *   quiz:leaderboard-live   { leaderboard }
 *   quiz:progress-update    { leaderboard, participantProgress, remainingMs }
 *   quiz:ended              { leaderboard, stats }
 *   quiz:error              { message }
 */

import Quiz from '../models/Quiz.js';
import {buildLeaderboard} from '../routes/quiz.js';

// In-memory map of active quiz sessions
// quizId -> { quiz, autoEndTimer, progressInterval }
const activeSessions=new Map();

// socket.id -> { quizId, role: 'host'|'participant', name, participantId }
const socketMeta=new Map();

export function setupQuizSocketHandlers(io)
{
    const quizNS=io;

    quizNS.on('connection', (socket) =>
    {
        // ── Host joins their quiz room ────────────────────────────────────
        socket.on('quiz:host-join', async ({quizId}={}) =>
        {
            try
            {
                if (!quizId) return socket.emit('quiz:error', {message: 'quizId required'});

                const quiz=await Quiz.findById(quizId);
                if (!quiz) return socket.emit('quiz:error', {message: 'Quiz not found'});
                if (quiz.status==='completed')
                    return socket.emit('quiz:error', {message: 'Quiz has already ended'});

                const room=`quiz:${quizId}`;
                socket.join(room);
                socketMeta.set(socket.id, {quizId, role: 'host', name: quiz.hostName, participantId: 'host'});

                // Initialise in-memory session if not already
                if (!activeSessions.has(quizId))
                {
                    activeSessions.set(quizId, {quiz, autoEndTimer: null, progressInterval: null});
                }

                // If quiz is active and no auto-end timer is set (e.g. server restarted), restore it
                if (['active'].includes(quiz.status)&&quiz.endsAt)
                {
                    restoreAutoEnd(io, quizId, quiz);
                }

                socket.emit('quiz:joined', {
                    role: 'host',
                    quiz: sanitizeQuizForHost(quiz),
                    participants: buildLeaderboard(quiz),
                    endsAt: quiz.endsAt||null,
                });

                console.log(`[QUIZ] Host joined quiz ${quiz.code}`);
            } catch (err)
            {
                console.error('[QUIZ] host-join error:', err.message);
                socket.emit('quiz:error', {message: 'Failed to join quiz room'});
            }
        });

        // ── Participant joins by room code ────────────────────────────────
        socket.on('quiz:participant-join', async ({code, name, userId}={}) =>
        {
            try
            {
                if (!code||!name) return socket.emit('quiz:error', {message: 'code and name are required'});

                const quiz=await Quiz.findOne({code: code.toUpperCase()});
                if (!quiz) return socket.emit('quiz:error', {message: 'Quiz not found. Check the room code.'});
                if (quiz.status==='completed') return socket.emit('quiz:error', {message: 'This quiz has already ended.'});
                if (quiz.status==='draft') return socket.emit('quiz:error', {message: 'This quiz has not been published yet.'});

                // Check if quiz time has expired (in case auto-end hasn't fired yet)
                if (quiz.endsAt&&new Date()>=new Date(quiz.endsAt))
                {
                    await endQuiz(io, String(quiz._id));
                    return socket.emit('quiz:error', {message: 'This quiz has already ended.'});
                }

                const quizId=String(quiz._id);
                const room=`quiz:${quizId}`;

                // Add or update participant in DB
                const existing=quiz.participants.find(p => p.participantId===socket.id||(userId&&String(p.userId)===String(userId)));
                if (!existing)
                {
                    quiz.participants.push({
                        participantId: socket.id,
                        name: name.trim().slice(0, 30),
                        userId: userId||null,
                        score: 0,
                        streak: 0,
                        answers: [],
                    });
                    await quiz.save();
                } else
                {
                    // Update participantId for reconnecting users
                    existing.participantId=socket.id;
                    await quiz.save();
                }

                socket.join(room);
                socketMeta.set(socket.id, {quizId, role: 'participant', name: name.trim(), participantId: socket.id});

                // Auto-start immediately if waiting or draft with questions so participants do not wait
                if (['waiting', 'draft'].includes(quiz.status) && quiz.questions.length > 0)
                {
                    const now = new Date();
                    const durationMs = (quiz.duration || 60) * 60 * 1000;
                    quiz.status = 'active';
                    quiz.startedAt = now;
                    quiz.endsAt = new Date(now.getTime() + durationMs);
                    quiz.currentQuestionIndex = 0;
                    await quiz.save();
                    scheduleAutoEnd(io, quizId, durationMs);
                }

                // Init session if not already
                if (!activeSessions.has(quizId))
                {
                    activeSessions.set(quizId, {quiz, autoEndTimer: null, progressInterval: null});
                } else
                {
                    activeSessions.get(quizId).quiz=quiz;
                }

                const participants=buildLeaderboard(quiz);

                // Build payload based on quiz state
                const payload=buildParticipantJoinPayload(quiz, socket.id);
                socket.emit('quiz:joined', {role: 'participant', ...payload, participants});

                // Notify host and others
                quizNS.to(room).emit('quiz:participant-update', {participants});

                console.log(`[QUIZ] ${name} joined quiz ${quiz.code} (status: ${quiz.status})`);
            } catch (err)
            {
                console.error('[QUIZ] participant-join error:', err.message);
                socket.emit('quiz:error', {message: 'Failed to join quiz'});
            }
        });

        // ── Start quiz (self-paced: all questions open at once) ─────
        socket.on('quiz:start', async ({quizId}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                const targetQuizId = quizId || meta?.quizId;
                if (!targetQuizId) return socket.emit('quiz:error', {message: 'quizId required'});

                const quiz=await Quiz.findById(targetQuizId);
                if (!quiz) return socket.emit('quiz:error', {message: 'Quiz not found'});
                if (!['waiting', 'draft'].includes(quiz.status))
                {
                    if (quiz.status === 'active') {
                        const payload = buildParticipantJoinPayload(quiz, socket.id);
                        return socket.emit('quiz:started', payload);
                    }
                    return socket.emit('quiz:error', {message: 'Quiz cannot be started from its current state'});
                }
                if (quiz.questions.length===0)
                    return socket.emit('quiz:error', {message: 'Add questions before starting'});

                const now=new Date();
                const durationMs=(quiz.duration||60)*60*1000;
                const endsAt=new Date(now.getTime()+durationMs);

                quiz.status='active';
                quiz.startedAt=now;
                quiz.endsAt=endsAt;
                quiz.currentQuestionIndex=0;
                await quiz.save();

                activeSessions.set(quizId, {quiz, autoEndTimer: null, progressInterval: null});

                const room=`quiz:${quizId}`;

                // Send all questions (without correct answers) to everyone
                const questionsForParticipants=quiz.questions.map((q, i) => ({
                    index: i,
                    text: q.text,
                    type: q.type,
                    options: q.options,
                    points: q.points,
                    difficulty: q.difficulty,
                    timeLimit: q.timeLimit,
                }));

                quizNS.to(room).emit('quiz:started', {
                    questions: questionsForParticipants,
                    totalQuestions: quiz.questions.length,
                    endsAt: endsAt.toISOString(),
                    duration: quiz.duration||60,
                });

                // Set auto-end timer
                scheduleAutoEnd(io, quizId, durationMs);

                // Set progress broadcast interval (every 10 seconds)
                startProgressBroadcast(io, quizId);

                console.log(`[QUIZ] Quiz ${quiz.code} started! Duration: ${quiz.duration||60}min, ends at ${endsAt.toISOString()}`);
            } catch (err)
            {
                console.error('[QUIZ] start error:', err.message);
                socket.emit('quiz:error', {message: 'Failed to start quiz'});
            }
        });

        // ── Participant submits answer for a specific question ─────────────
        socket.on('quiz:submit-answer', async ({quizId: rawQuizId, code, questionIndex, answer, timeMs=0}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                if (!meta||meta.role!=='participant')
                    return socket.emit('quiz:error', {message: 'Only participants can submit answers'});

                const quizId=meta.quizId||rawQuizId;
                const quiz=await Quiz.findById(quizId);
                if (!quiz) return socket.emit('quiz:error', {message: 'Quiz not found'});

                // Quiz must be active for answers
                if (quiz.status!=='active')
                    return socket.emit('quiz:error', {message: 'Quiz is not currently active'});

                // Check if quiz time has expired
                if (quiz.endsAt&&new Date()>=new Date(quiz.endsAt))
                {
                    await endQuiz(io, quizId);
                    return socket.emit('quiz:error', {message: 'Quiz time has expired'});
                }

                if (questionIndex<0||questionIndex>=quiz.questions.length)
                    return socket.emit('quiz:error', {message: 'Invalid question index'});

                const participant=quiz.participants.find(p => p.participantId===socket.id);
                if (!participant) return socket.emit('quiz:error', {message: 'Participant not found'});

                // Check not already answered this question
                if (participant.answers.some(a => a.questionIndex===questionIndex))
                    return socket.emit('quiz:error', {message: 'Already answered this question'});

                const question=quiz.questions[questionIndex];
                const correct=String(answer).trim().toLowerCase()===String(question.correctAnswer).trim().toLowerCase();

                // Time bonus: up to 50% extra points for quick answers
                const maxBonus=Math.round(question.points*0.5);
                const timeFraction=Math.max(0, 1-(timeMs/(question.timeLimit*1000)));
                const timeBonus=correct? Math.round(maxBonus*timeFraction):0;
                const pointsEarned=correct? question.points+timeBonus:0;

                if (correct)
                    participant.streak=(participant.streak||0)+1;
                else
                    participant.streak=0;

                // Streak bonus
                const streakBonus=correct&&participant.streak>=3? Math.round(question.points*0.2):0;
                const totalPoints=pointsEarned+streakBonus;

                participant.score+=totalPoints;
                participant.answers.push({questionIndex, answer: String(answer).trim(), correct, pointsEarned: totalPoints, timeMs});

                await quiz.save();

                // Update session cache
                if (activeSessions.has(quizId)) activeSessions.get(quizId).quiz=quiz;

                const leaderboard=buildLeaderboard(quiz);
                const rank=leaderboard.findIndex(p => p.participantId===socket.id)+1;

                // Tell the participant their result for this question
                socket.emit('quiz:answer-result', {
                    questionIndex,
                    correct,
                    correctAnswer: question.correctAnswer,
                    explanation: question.explanation,
                    pointsEarned: totalPoints,
                    totalScore: participant.score,
                    streak: participant.streak,
                    rank,
                    answeredCount: participant.answers.length,
                    totalQuestions: quiz.questions.length,
                });

                // Broadcast updated leaderboard to the room
                const room=`quiz:${quizId}`;
                quizNS.to(room).emit('quiz:leaderboard-live', {leaderboard});

                // Check if this participant has answered all questions
                if (participant.answers.length>=quiz.questions.length)
                {
                    socket.emit('quiz:participant-complete', {
                        message: 'You have completed all questions!',
                        totalScore: participant.score,
                        rank,
                    });
                }
            } catch (err)
            {
                console.error('[QUIZ] submit-answer error:', err.message);
                socket.emit('quiz:error', {message: 'Failed to submit answer'});
            }
        });

        // ── Host ends quiz early ───────────────────────────────────────────
        socket.on('quiz:end', async ({quizId}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                if (!meta||meta.role!=='host'||meta.quizId!==quizId)
                    return socket.emit('quiz:error', {message: 'Only the host can end the quiz'});

                await endQuiz(io, quizId);
            } catch (err)
            {
                console.error('[QUIZ] end error:', err.message);
                socket.emit('quiz:error', {message: 'Failed to end quiz'});
            }
        });

        // ── Participant reports proctoring violation (cheating detection) ──
        socket.on('quiz:proctoring-event', async ({type, severity, description}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                if (!meta||meta.role!=='participant') return;

                const quizId=meta.quizId;
                const quiz=await Quiz.findById(quizId);
                if (!quiz||quiz.status!=='active') return;

                const participant=quiz.participants.find(p => p.participantId===socket.id);
                if (!participant) return;

                // Penalty points based on severity
                const PENALTY_MAP={
                    low: 2,
                    medium: 5,
                    high: 10,
                    critical: 20,
                };
                const penalty=PENALTY_MAP[severity]||5;

                // Diminishing returns: first few of same type penalize more
                const sameTypeCount=(participant.proctoringViolations||[]).filter(v => v.type===type).length;
                const actualPenalty=sameTypeCount<3? penalty:Math.max(1, Math.round(penalty*0.5));

                // Deduct from score (floor at 0)
                participant.score=Math.max(0, participant.score-actualPenalty);
                participant.totalPenalty=(participant.totalPenalty||0)+actualPenalty;

                // Update integrity score
                const integrityLoss={low: 3, medium: 5, high: 10, critical: 15}[severity]||5;
                participant.integrityScore=Math.max(0, (participant.integrityScore??100)-integrityLoss);

                // Record violation
                if (!participant.proctoringViolations) participant.proctoringViolations=[];
                participant.proctoringViolations.push({
                    type,
                    severity: severity||'medium',
                    penalty: actualPenalty,
                    timestamp: new Date(),
                });

                await quiz.save();
                if (activeSessions.has(quizId)) activeSessions.get(quizId).quiz=quiz;

                // Tell the participant their updated score
                const leaderboard=buildLeaderboard(quiz);
                const rank=leaderboard.findIndex(p => p.participantId===socket.id)+1;

                socket.emit('quiz:penalty-applied', {
                    type,
                    severity,
                    penalty: actualPenalty,
                    totalPenalty: participant.totalPenalty,
                    newScore: participant.score,
                    integrityScore: participant.integrityScore,
                    rank,
                    violationCount: participant.proctoringViolations.length,
                });

                // Notify host
                const room=`quiz:${quizId}`;
                quizNS.to(room).emit('quiz:leaderboard-live', {leaderboard});

                // If integrity drops to 0 → auto-disqualify
                if (participant.integrityScore<=0)
                {
                    socket.emit('quiz:disqualified', {
                        message: 'You have been disqualified due to repeated cheating violations.',
                        totalPenalty: participant.totalPenalty,
                        violations: participant.proctoringViolations.length,
                    });
                    console.log(`[QUIZ] Participant ${participant.name} disqualified from quiz ${quiz.code} (integrity = 0)`);
                }

                console.log(`[QUIZ] Penalty -${actualPenalty}pts on ${participant.name} for ${type} (${severity})`);
            } catch (err)
            {
                console.error('[QUIZ] proctoring-event error:', err.message);
            }
        });

        // ── Cleanup on disconnect ──────────────────────────────────────────
        socket.on('disconnect', async () =>
        {
            const meta=socketMeta.get(socket.id);
            if (!meta) return;
            socketMeta.delete(socket.id);

            const {quizId, role, name}=meta;
            try
            {
                if (role==='participant')
                {
                    const quiz=await Quiz.findById(quizId);
                    if (quiz&&quiz.status!=='completed')
                    {
                        const room=`quiz:${quizId}`;
                        const participants=buildLeaderboard(quiz);
                        quizNS.to(room).emit('quiz:participant-update', {participants});
                        console.log(`[QUIZ] Participant ${name} disconnected from quiz ${quizId}`);
                    }
                }
            } catch (err)
            {
                console.error('[QUIZ] disconnect cleanup error:', err.message);
            }
        });
    });
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function scheduleAutoEnd(io, quizId, delayMs)
{
    const session=activeSessions.get(quizId);
    if (!session) return;

    if (session.autoEndTimer) clearTimeout(session.autoEndTimer);

    session.autoEndTimer=setTimeout(async () =>
    {
        console.log(`[QUIZ] Auto-ending quiz ${quizId} (duration expired)`);
        await endQuiz(io, quizId);
    }, delayMs);
}

function restoreAutoEnd(io, quizId, quiz)
{
    if (!quiz.endsAt) return;
    const remaining=new Date(quiz.endsAt).getTime()-Date.now();
    if (remaining<=0)
    {
        endQuiz(io, quizId);
    } else
    {
        scheduleAutoEnd(io, quizId, remaining);
        startProgressBroadcast(io, quizId);
    }
}

function startProgressBroadcast(io, quizId)
{
    const session=activeSessions.get(quizId);
    if (!session) return;

    if (session.progressInterval) clearInterval(session.progressInterval);

    session.progressInterval=setInterval(async () =>
    {
        try
        {
            const quiz=await Quiz.findById(quizId);
            if (!quiz||quiz.status==='completed')
            {
                clearInterval(session.progressInterval);
                return;
            }

            const room=`quiz:${quizId}`;
            const leaderboard=buildLeaderboard(quiz);
            const remainingMs=quiz.endsAt? Math.max(0, new Date(quiz.endsAt).getTime()-Date.now()):0;

            const participantProgress=quiz.participants.map(p => ({
                name: p.name,
                participantId: p.participantId,
                score: p.score,
                answeredCount: p.answers.length,
                totalQuestions: quiz.questions.length,
                integrityScore: p.integrityScore??100,
                totalPenalty: p.totalPenalty||0,
                violations: (p.proctoringViolations||[]).length,
            }));

            io.to(room).emit('quiz:progress-update', {
                leaderboard,
                participantProgress,
                remainingMs,
                totalParticipants: quiz.participants.length,
            });
        } catch (err)
        {
            console.error('[QUIZ] progress broadcast error:', err.message);
        }
    }, 10000);
}

async function endQuiz(io, quizId)
{
    const session=activeSessions.get(quizId);

    if (session)
    {
        if (session.autoEndTimer) clearTimeout(session.autoEndTimer);
        if (session.progressInterval) clearInterval(session.progressInterval);
    }

    const quiz=await Quiz.findById(quizId);
    if (!quiz||quiz.status==='completed') return;

    quiz.status='completed';
    quiz.endedAt=new Date();
    await quiz.save();

    const leaderboard=buildLeaderboard(quiz);
    const room=`quiz:${quizId}`;

    io.to(room).emit('quiz:ended', {
        leaderboard,
        quizId,
        stats: {
            totalParticipants: quiz.participants.length,
            totalQuestions: quiz.questions.length,
            duration: quiz.startedAt? Math.round((quiz.endedAt-quiz.startedAt)/1000):0,
        },
    });

    activeSessions.delete(quizId);
    console.log(`[QUIZ] Quiz ${quiz.code} ended`);
}

function sanitizeQuizForHost(quiz)
{
    return {
        id: quiz._id,
        code: quiz.code,
        title: quiz.title,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        status: quiz.status,
        currentQuestionIndex: quiz.currentQuestionIndex,
        totalQuestions: quiz.questions.length,
        questionTimeLimit: quiz.questionTimeLimit,
        duration: quiz.duration||60,
        endsAt: quiz.endsAt,
        questions: quiz.questions,
        settings: quiz.settings,
    };
}

function buildParticipantJoinPayload(quiz, socketId)
{
    const base={
        status: quiz.status,
        totalQuestions: quiz.questions.length,
        title: quiz.title,
        hostName: quiz.hostName,
        endsAt: quiz.endsAt? quiz.endsAt.toISOString():null,
        duration: quiz.duration||60,
    };

    if (quiz.status==='active')
    {
        const questionsForParticipant=quiz.questions.map((q, i) => ({
            index: i,
            text: q.text,
            type: q.type,
            options: q.options,
            points: q.points,
            difficulty: q.difficulty,
            timeLimit: q.timeLimit,
        }));

        const participant=quiz.participants.find(p => p.participantId===socketId);
        const answeredIndices=(participant?.answers||[]).map(a => a.questionIndex);

        return {
            ...base,
            questions: questionsForParticipant,
            answeredIndices,
        };
    }

    return base;
}
