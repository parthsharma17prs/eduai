/**
 * Coding Contest Socket Handlers
 * 
 * When the host starts a contest, ALL challenges become available at once.
 * Participants can join at any time during the contest window and work through
 * challenges at their own pace. The contest auto-ends after the configured duration.
 *
 * Events (client → server):
 *   contest:host-join          { contestId }
 *   contest:participant-join   { code, name, userId? }
 *   contest:start              { contestId }
 *   contest:submit-code        { contestId, challengeIndex, code, language, timeMs }
 *   contest:run-code           { contestId, challengeIndex, code, language }
 *   contest:end                { contestId }
 *
 * Events (server → client):
 *   contest:joined             { contest, participants, role, challenges?, endsAt? }
 *   contest:participant-update { participants }
 *   contest:started            { challenges, totalChallenges, endsAt, duration }
 *   contest:submission-result  { passed, total, pointsEarned, totalScore, rank, ... }
 *   contest:run-result         { results, output }
 *   contest:leaderboard-live   { leaderboard }
 *   contest:progress-update    { leaderboard, participantProgress, remainingMs }
 *   contest:ended              { leaderboard, stats }
 *   contest:error              { message }
 */

import CodingContest from '../models/CodingContest.js';
import {buildLeaderboard} from '../routes/contest.js';
import axios from 'axios';

const activeSessions=new Map(); // contestId -> { contest, autoEndTimer, progressInterval }
const socketMeta=new Map(); // socket.id -> { contestId, role, name, participantId }

// Code execution helper (reuse pistonservice or local)
async function executeCode(code, language, testCases)
{
    const results=[];

    // Map language names
    const langMap={
        javascript: {piston: 'javascript', version: '18.15.0'},
        python: {piston: 'python', version: '3.10.0'},
        java: {piston: 'java', version: '15.0.2'},
        cpp: {piston: 'cpp', version: '10.2.0'},
    };

    const langInfo=langMap[language]||langMap.javascript;

    for (const tc of testCases)
    {
        try
        {
            // Try Piston API for code execution
            const response=await axios.post('https://emkc.org/api/v2/piston/execute', {
                language: langInfo.piston,
                version: langInfo.version,
                files: [{content: code}],
                stdin: tc.input,
            }, {timeout: 10000});

            const output=(response.data.run?.output||'').trim();
            const expected=String(tc.output).trim();
            const passed=output===expected;

            results.push({
                input: tc.input,
                expected: tc.output,
                actual: output,
                passed,
                hidden: tc.hidden,
                error: response.data.run?.stderr||null,
            });
        } catch (err)
        {
            results.push({
                input: tc.input,
                expected: tc.output,
                actual: '',
                passed: false,
                hidden: tc.hidden,
                error: err.message||'Execution failed',
            });
        }
    }

    return results;
}

export function setupContestSocketHandlers(io)
{
    const contestNS=io;

    contestNS.on('connection', (socket) =>
    {
        // ── Host joins their contest room ────────────────────────────────
        socket.on('contest:host-join', async ({contestId}={}) =>
        {
            try
            {
                if (!contestId) return socket.emit('contest:error', {message: 'contestId required'});

                const contest=await CodingContest.findById(contestId);
                if (!contest) return socket.emit('contest:error', {message: 'Contest not found'});
                if (contest.status==='completed')
                    return socket.emit('contest:error', {message: 'Contest has already ended'});

                const room=`contest:${contestId}`;
                socket.join(room);
                socketMeta.set(socket.id, {contestId, role: 'host', name: contest.hostName, participantId: 'host'});

                if (!activeSessions.has(contestId))
                {
                    activeSessions.set(contestId, {contest, autoEndTimer: null, progressInterval: null});
                }

                // Restore auto-end if contest is active
                if (contest.status==='active'&&contest.endsAt)
                {
                    restoreAutoEnd(io, contestId, contest);
                }

                socket.emit('contest:joined', {
                    role: 'host',
                    contest: sanitizeContestForHost(contest),
                    participants: buildLeaderboard(contest),
                    endsAt: contest.endsAt||null,
                });

                console.log(`[CONTEST] Host joined contest ${contest.code}`);
            } catch (err)
            {
                console.error('[CONTEST] host-join error:', err.message);
                socket.emit('contest:error', {message: 'Failed to join contest room'});
            }
        });

        // ── Participant joins by room code ────────────────────────────────
        socket.on('contest:participant-join', async ({code, name, userId}={}) =>
        {
            try
            {
                if (!code||!name) return socket.emit('contest:error', {message: 'code and name are required'});

                const contest=await CodingContest.findOne({code: code.toUpperCase()});
                if (!contest) return socket.emit('contest:error', {message: 'Contest not found. Check the room code.'});
                if (contest.status==='completed') return socket.emit('contest:error', {message: 'This contest has already ended.'});
                if (contest.status==='draft') return socket.emit('contest:error', {message: 'This contest has not been published yet.'});

                // Check if contest time has expired
                if (contest.endsAt&&new Date()>=new Date(contest.endsAt))
                {
                    await endContest(io, String(contest._id));
                    return socket.emit('contest:error', {message: 'This contest has already ended.'});
                }

                const contestId=String(contest._id);
                const room=`contest:${contestId}`;

                // Add or update participant
                const existing=contest.participants.find(p => p.participantId===socket.id||(userId&&String(p.userId)===String(userId)));
                if (!existing)
                {
                    contest.participants.push({
                        participantId: socket.id,
                        name: name.trim().slice(0, 30),
                        userId: userId||null,
                        score: 0,
                        solvedCount: 0,
                        submissions: [],
                    });
                    await contest.save();
                } else
                {
                    existing.participantId=socket.id;
                    await contest.save();
                }

                socket.join(room);
                socketMeta.set(socket.id, {contestId, role: 'participant', name: name.trim(), participantId: socket.id});

                // Auto-start immediately if waiting or draft with challenges so participants don't wait
                if (['waiting', 'draft'].includes(contest.status) && contest.challenges.length > 0)
                {
                    const now = new Date();
                    const durationMs = (contest.duration || 90) * 60 * 1000;
                    contest.status = 'active';
                    contest.startedAt = now;
                    contest.endsAt = new Date(now.getTime() + durationMs);
                    await contest.save();
                    scheduleAutoEnd(io, contestId, durationMs);
                }

                if (!activeSessions.has(contestId))
                {
                    activeSessions.set(contestId, {contest, autoEndTimer: null, progressInterval: null});
                } else
                {
                    activeSessions.get(contestId).contest=contest;
                }

                const participants=buildLeaderboard(contest);
                const payload=buildParticipantJoinPayload(contest, socket.id);
                socket.emit('contest:joined', {role: 'participant', ...payload, participants});

                contestNS.to(room).emit('contest:participant-update', {participants});

                console.log(`[CONTEST] ${name} joined contest ${contest.code} (status: ${contest.status})`);
            } catch (err)
            {
                console.error('[CONTEST] participant-join error:', err.message);
                socket.emit('contest:error', {message: 'Failed to join contest'});
            }
        });

        // ── Start contest ───────────────────────────────────────────
        socket.on('contest:start', async ({contestId}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                const targetContestId = contestId || meta?.contestId;
                if (!targetContestId) return socket.emit('contest:error', {message: 'contestId required'});

                const contest=await CodingContest.findById(targetContestId);
                if (!contest) return socket.emit('contest:error', {message: 'Contest not found'});
                if (!['waiting', 'draft'].includes(contest.status))
                {
                    if (contest.status === 'active') {
                        const payload = buildParticipantJoinPayload(contest, socket.id);
                        return socket.emit('contest:started', payload);
                    }
                    return socket.emit('contest:error', {message: 'Contest cannot be started from its current state'});
                }
                if (contest.challenges.length===0)
                    return socket.emit('contest:error', {message: 'Add challenges before starting'});

                const now=new Date();
                const durationMs=(contest.duration||90)*60*1000;
                const endsAt=new Date(now.getTime()+durationMs);

                contest.status='active';
                contest.startedAt=now;
                contest.endsAt=endsAt;
                await contest.save();

                activeSessions.set(contestId, {contest, autoEndTimer: null, progressInterval: null});

                const room=`contest:${contestId}`;

                // Send challenges (without hidden test cases) to everyone
                const challengesForParticipants=contest.challenges.map((c, i) => ({
                    index: i,
                    title: c.title,
                    description: c.description,
                    difficulty: c.difficulty,
                    points: c.points,
                    timeLimit: c.timeLimit,
                    examples: c.examples,
                    constraints: c.constraints,
                    starterCode: c.starterCode,
                    functionName: c.functionName,
                    hints: c.hints,
                    testCases: (c.testCases||[]).filter(tc => !tc.hidden),
                }));

                contestNS.to(room).emit('contest:started', {
                    challenges: challengesForParticipants,
                    totalChallenges: contest.challenges.length,
                    endsAt: endsAt.toISOString(),
                    duration: contest.duration||90,
                });

                scheduleAutoEnd(io, contestId, durationMs);
                startProgressBroadcast(io, contestId);

                console.log(`[CONTEST] Contest ${contest.code} started! Duration: ${contest.duration||90}min`);
            } catch (err)
            {
                console.error('[CONTEST] start error:', err.message);
                socket.emit('contest:error', {message: 'Failed to start contest'});
            }
        });

        // ── Run code (test against visible test cases only) ───────────────
        socket.on('contest:run-code', async ({contestId: rawContestId, code, challengeIndex, language='javascript', code: rawCode}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                if (!meta||meta.role!=='participant')
                    return socket.emit('contest:error', {message: 'Only participants can run code'});

                const contestId=meta.contestId||rawContestId;
                const contest=await CodingContest.findById(contestId);
                if (!contest||contest.status!=='active')
                    return socket.emit('contest:error', {message: 'Contest is not active'});

                if (challengeIndex<0||challengeIndex>=contest.challenges.length)
                    return socket.emit('contest:error', {message: 'Invalid challenge index'});

                const challenge=contest.challenges[challengeIndex];
                const visibleTestCases=(challenge.testCases||[]).filter(tc => !tc.hidden);

                if (visibleTestCases.length===0)
                {
                    return socket.emit('contest:run-result', {results: [], output: 'No visible test cases available.'});
                }

                const results=await executeCode(code, language, visibleTestCases);
                const passed=results.filter(r => r.passed).length;

                socket.emit('contest:run-result', {
                    challengeIndex,
                    results: results.map(r => ({
                        input: r.input,
                        expected: r.expected,
                        actual: r.actual,
                        passed: r.passed,
                        error: r.error,
                    })),
                    passed,
                    total: visibleTestCases.length,
                    output: `Passed ${passed}/${visibleTestCases.length} visible test cases`,
                });

            } catch (err)
            {
                console.error('[CONTEST] run-code error:', err.message);
                socket.emit('contest:error', {message: 'Code execution failed'});
            }
        });

        // ── Submit code (test against ALL test cases) ─────────────────────
        socket.on('contest:submit-code', async ({contestId: rawContestId, code, challengeIndex, language='javascript', timeMs=0}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                if (!meta||meta.role!=='participant')
                    return socket.emit('contest:error', {message: 'Only participants can submit code'});

                const contestId=meta.contestId||rawContestId;
                const contest=await CodingContest.findById(contestId);
                if (!contest) return socket.emit('contest:error', {message: 'Contest not found'});
                if (contest.status!=='active')
                    return socket.emit('contest:error', {message: 'Contest is not active'});

                // Check if contest time has expired
                if (contest.endsAt&&new Date()>=new Date(contest.endsAt))
                {
                    await endContest(io, contestId);
                    return socket.emit('contest:error', {message: 'Contest time has expired'});
                }

                if (challengeIndex<0||challengeIndex>=contest.challenges.length)
                    return socket.emit('contest:error', {message: 'Invalid challenge index'});

                const participant=contest.participants.find(p => p.participantId===socket.id);
                if (!participant) return socket.emit('contest:error', {message: 'Participant not found'});

                const challenge=contest.challenges[challengeIndex];
                const allTestCases=challenge.testCases||[];

                // Execute against all test cases
                const results=await executeCode(code, language, allTestCases);
                const passed=results.filter(r => r.passed).length;
                const total=allTestCases.length;

                // Calculate points
                let pointsEarned=0;
                const hadPreviousSubmission=participant.submissions?.some(s => s.challengeIndex===challengeIndex);
                const previousBestPassed=hadPreviousSubmission
                    ? Math.max(...participant.submissions.filter(s => s.challengeIndex===challengeIndex).map(s => s.passed))
                    :0;

                if (passed>previousBestPassed)
                {
                    if (contest.settings.partialScoring)
                    {
                        // Partial scoring: points proportional to test cases passed
                        pointsEarned=Math.round((passed/total)*challenge.points);
                        const previousPoints=Math.round((previousBestPassed/total)*challenge.points);
                        pointsEarned=pointsEarned-previousPoints; // Only add the difference
                    } else
                    {
                        // Full scoring: only get points if all test cases pass
                        pointsEarned=passed===total? challenge.points:0;
                    }
                }

                // Update participant
                participant.submissions=participant.submissions||[];
                participant.submissions.push({
                    challengeIndex,
                    code,
                    language,
                    passed,
                    total,
                    pointsEarned,
                    timeMs,
                    submittedAt: new Date(),
                });

                participant.score+=Math.max(0, pointsEarned);

                // Count solved challenges (all test cases passed)
                const solvedIndices=new Set();
                for (const sub of participant.submissions)
                {
                    if (sub.passed===sub.total&&sub.total>0)
                    {
                        solvedIndices.add(sub.challengeIndex);
                    }
                }
                participant.solvedCount=solvedIndices.size;

                await contest.save();
                if (activeSessions.has(contestId)) activeSessions.get(contestId).contest=contest;

                const leaderboard=buildLeaderboard(contest);
                const rank=leaderboard.findIndex(p => p.participantId===socket.id)+1;

                // Send result to participant
                socket.emit('contest:submission-result', {
                    challengeIndex,
                    passed,
                    total,
                    pointsEarned,
                    totalScore: participant.score,
                    solvedCount: participant.solvedCount,
                    rank,
                    allPassed: passed===total,
                    results: results.map(r => ({
                        passed: r.passed,
                        hidden: r.hidden,
                        error: r.error,
                        // Only show input/output for visible test cases
                        input: r.hidden? '(hidden)':r.input,
                        expected: r.hidden? '(hidden)':r.expected,
                        actual: r.hidden? '(hidden)':r.actual,
                    })),
                });

                // Broadcast updated leaderboard
                const room=`contest:${contestId}`;
                contestNS.to(room).emit('contest:leaderboard-live', {leaderboard});

                console.log(`[CONTEST] ${participant.name} submitted challenge ${challengeIndex}: ${passed}/${total} (+${pointsEarned}pts)`);

            } catch (err)
            {
                console.error('[CONTEST] submit-code error:', err.message);
                socket.emit('contest:error', {message: 'Failed to submit code'});
            }
        });

        // ── Host ends contest early ───────────────────────────────────────
        socket.on('contest:end', async ({contestId}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                if (!meta||meta.role!=='host'||meta.contestId!==contestId)
                    return socket.emit('contest:error', {message: 'Only the host can end the contest'});

                await endContest(io, contestId);
            } catch (err)
            {
                console.error('[CONTEST] end error:', err.message);
                socket.emit('contest:error', {message: 'Failed to end contest'});
            }
        });

        // ── Proctoring violation ──────────────────────────────────────────
        socket.on('contest:proctoring-event', async ({type, severity, description}={}) =>
        {
            try
            {
                const meta=socketMeta.get(socket.id);
                if (!meta||meta.role!=='participant') return;

                const contestId=meta.contestId;
                const contest=await CodingContest.findById(contestId);
                if (!contest||contest.status!=='active') return;

                const participant=contest.participants.find(p => p.participantId===socket.id);
                if (!participant) return;

                const PENALTY_MAP={low: 5, medium: 10, high: 20, critical: 50};
                const penalty=PENALTY_MAP[severity]||10;

                const sameTypeCount=(participant.proctoringViolations||[]).filter(v => v.type===type).length;
                const actualPenalty=sameTypeCount<3? penalty:Math.max(2, Math.round(penalty*0.5));

                participant.score=Math.max(0, participant.score-actualPenalty);
                participant.totalPenalty=(participant.totalPenalty||0)+actualPenalty;

                const integrityLoss={low: 5, medium: 10, high: 15, critical: 25}[severity]||10;
                participant.integrityScore=Math.max(0, (participant.integrityScore??100)-integrityLoss);

                if (!participant.proctoringViolations) participant.proctoringViolations=[];
                participant.proctoringViolations.push({
                    type,
                    severity: severity||'medium',
                    penalty: actualPenalty,
                    timestamp: new Date(),
                });

                await contest.save();
                if (activeSessions.has(contestId)) activeSessions.get(contestId).contest=contest;

                const leaderboard=buildLeaderboard(contest);
                const rank=leaderboard.findIndex(p => p.participantId===socket.id)+1;

                socket.emit('contest:penalty-applied', {
                    type,
                    severity,
                    penalty: actualPenalty,
                    totalPenalty: participant.totalPenalty,
                    newScore: participant.score,
                    integrityScore: participant.integrityScore,
                    rank,
                    violationCount: participant.proctoringViolations.length,
                });

                const room=`contest:${contestId}`;
                contestNS.to(room).emit('contest:leaderboard-live', {leaderboard});

                if (participant.integrityScore<=0)
                {
                    socket.emit('contest:disqualified', {
                        message: 'You have been disqualified due to repeated violations.',
                        totalPenalty: participant.totalPenalty,
                        violations: participant.proctoringViolations.length,
                    });
                }

                console.log(`[CONTEST] Penalty -${actualPenalty}pts on ${participant.name} for ${type}`);
            } catch (err)
            {
                console.error('[CONTEST] proctoring-event error:', err.message);
            }
        });

        // ── Disconnect cleanup ────────────────────────────────────────────
        socket.on('disconnect', async () =>
        {
            const meta=socketMeta.get(socket.id);
            if (!meta) return;
            socketMeta.delete(socket.id);

            const {contestId, role, name}=meta;
            try
            {
                if (role==='participant')
                {
                    const contest=await CodingContest.findById(contestId);
                    if (contest&&contest.status!=='completed')
                    {
                        const room=`contest:${contestId}`;
                        const participants=buildLeaderboard(contest);
                        contestNS.to(room).emit('contest:participant-update', {participants});
                        console.log(`[CONTEST] Participant ${name} disconnected from contest ${contestId}`);
                    }
                }
            } catch (err)
            {
                console.error('[CONTEST] disconnect cleanup error:', err.message);
            }
        });
    });
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function scheduleAutoEnd(io, contestId, delayMs)
{
    const session=activeSessions.get(contestId);
    if (!session) return;

    if (session.autoEndTimer) clearTimeout(session.autoEndTimer);

    session.autoEndTimer=setTimeout(async () =>
    {
        console.log(`[CONTEST] Auto-ending contest ${contestId} (duration expired)`);
        await endContest(io, contestId);
    }, delayMs);
}

function restoreAutoEnd(io, contestId, contest)
{
    if (!contest.endsAt) return;
    const remaining=new Date(contest.endsAt).getTime()-Date.now();
    if (remaining<=0)
    {
        endContest(io, contestId);
    } else
    {
        scheduleAutoEnd(io, contestId, remaining);
        startProgressBroadcast(io, contestId);
    }
}

function startProgressBroadcast(io, contestId)
{
    const session=activeSessions.get(contestId);
    if (!session) return;

    if (session.progressInterval) clearInterval(session.progressInterval);

    session.progressInterval=setInterval(async () =>
    {
        try
        {
            const contest=await CodingContest.findById(contestId);
            if (!contest||contest.status==='completed')
            {
                clearInterval(session.progressInterval);
                return;
            }

            const room=`contest:${contestId}`;
            const leaderboard=buildLeaderboard(contest);
            const remainingMs=contest.endsAt? Math.max(0, new Date(contest.endsAt).getTime()-Date.now()):0;

            const participantProgress=contest.participants.map(p => ({
                name: p.name,
                participantId: p.participantId,
                score: p.score,
                solvedCount: p.solvedCount||0,
                submissionCount: (p.submissions||[]).length,
                totalChallenges: contest.challenges.length,
                integrityScore: p.integrityScore??100,
                totalPenalty: p.totalPenalty||0,
            }));

            io.to(room).emit('contest:progress-update', {
                leaderboard,
                participantProgress,
                remainingMs,
                totalParticipants: contest.participants.length,
            });
        } catch (err)
        {
            console.error('[CONTEST] progress broadcast error:', err.message);
        }
    }, 10000);
}

async function endContest(io, contestId)
{
    const session=activeSessions.get(contestId);

    if (session)
    {
        if (session.autoEndTimer) clearTimeout(session.autoEndTimer);
        if (session.progressInterval) clearInterval(session.progressInterval);
    }

    const contest=await CodingContest.findById(contestId);
    if (!contest||contest.status==='completed') return;

    contest.status='completed';
    contest.endedAt=new Date();
    await contest.save();

    const leaderboard=buildLeaderboard(contest);
    const room=`contest:${contestId}`;

    io.to(room).emit('contest:ended', {
        leaderboard,
        contestId,
        stats: {
            totalParticipants: contest.participants.length,
            totalChallenges: contest.challenges.length,
            duration: contest.startedAt? Math.round((contest.endedAt-contest.startedAt)/1000):0,
        },
    });

    activeSessions.delete(contestId);
    console.log(`[CONTEST] Contest ${contest.code} ended`);
}

function sanitizeContestForHost(contest)
{
    return {
        id: contest._id,
        code: contest.code,
        title: contest.title,
        topic: contest.topic,
        difficulty: contest.difficulty,
        status: contest.status,
        totalChallenges: contest.challenges.length,
        duration: contest.duration||90,
        endsAt: contest.endsAt,
        challenges: contest.challenges,
        settings: contest.settings,
    };
}

function buildParticipantJoinPayload(contest, socketId)
{
    const base={
        status: contest.status,
        totalChallenges: contest.challenges.length,
        title: contest.title,
        hostName: contest.hostName,
        endsAt: contest.endsAt? contest.endsAt.toISOString():null,
        duration: contest.duration||90,
    };

    if (contest.status==='active')
    {
        const challengesForParticipant=contest.challenges.map((c, i) => ({
            index: i,
            title: c.title,
            description: c.description,
            difficulty: c.difficulty,
            points: c.points,
            timeLimit: c.timeLimit,
            examples: c.examples,
            constraints: c.constraints,
            starterCode: c.starterCode,
            functionName: c.functionName,
            hints: c.hints,
            testCases: (c.testCases||[]).filter(tc => !tc.hidden),
        }));

        const participant=contest.participants.find(p => p.participantId===socketId);
        const submittedIndices=[...new Set((participant?.submissions||[]).map(s => s.challengeIndex))];

        return {
            ...base,
            challenges: challengesForParticipant,
            submittedIndices,
        };
    }

    return base;
}
