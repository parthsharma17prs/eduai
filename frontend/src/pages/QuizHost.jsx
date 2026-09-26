import {useState, useEffect, useRef, useCallback} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {io} from 'socket.io-client';
import {API_BASE_URL} from '../services/api';
import './QuizHost.css';

const API_URL = API_BASE_URL;

function fmtTime(totalSec)
{
    if (totalSec<=0) return '0:00';
    const h=Math.floor(totalSec/3600);
    const m=Math.floor((totalSec%3600)/60);
    const s=totalSec%60;
    if (h>0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function QuizHost()
{
    const {quizId}=useParams();
    const navigate=useNavigate();
    const socketRef=useRef(null);

    const [phase, setPhase]=useState('connecting'); // connecting | waiting | active | ended
    const [quiz, setQuiz]=useState(null);
    const [participants, setParticipants]=useState([]);
    const [leaderboard, setLeaderboard]=useState([]);
    const [totalQ, setTotalQ]=useState(0);
    const [endStats, setEndStats]=useState(null);
    const [error, setError]=useState('');

    // Self-paced: countdown timer to auto-end
    const [remainingSec, setRemainingSec]=useState(0);
    const [endsAt, setEndsAt]=useState(null);
    const [participantProgress, setParticipantProgress]=useState([]);
    const countdownRef=useRef(null);

    const startCountdown=useCallback((endsAtISO) =>
    {
        if (countdownRef.current) clearInterval(countdownRef.current);
        const end=new Date(endsAtISO).getTime();
        setEndsAt(end);
        const tick=() =>
        {
            const left=Math.max(0, Math.round((end-Date.now())/1000));
            setRemainingSec(left);
            if (left<=0&&countdownRef.current) clearInterval(countdownRef.current);
        };
        tick();
        countdownRef.current=setInterval(tick, 1000);
    }, []);

    useEffect(() =>
    {
        const socket=io(API_URL, {withCredentials: true});
        socketRef.current=socket;

        socket.on('connect', () =>
        {
            socket.emit('quiz:host-join', {quizId});
        });

        socket.on('quiz:joined', ({quiz: q, participants: p, role, endsAt: ea}) =>
        {
            if (role!=='host') return;
            setQuiz(q);
            setLeaderboard(p||[]);
            setParticipants(p||[]);
            setTotalQ(q.totalQuestions||q.questions?.length||0);

            if (q.status==='active')
            {
                setPhase('active');
                if (ea||q.endsAt) startCountdown(ea||q.endsAt);
            } else if (q.status==='completed')
            {
                setPhase('ended');
            } else
            {
                setPhase('waiting');
            }
        });

        socket.on('quiz:participant-update', ({participants: p}) =>
        {
            setParticipants(p||[]);
            setLeaderboard(p||[]);
        });

        socket.on('quiz:started', ({totalQuestions, endsAt: ea, duration}) =>
        {
            setTotalQ(totalQuestions);
            setPhase('active');
            if (ea) startCountdown(ea);
        });

        socket.on('quiz:leaderboard-live', ({leaderboard: lb}) =>
        {
            setLeaderboard(lb||[]);
        });

        socket.on('quiz:progress-update', ({leaderboard: lb, participantProgress: pp, remainingMs, totalParticipants}) =>
        {
            setLeaderboard(lb||[]);
            setParticipantProgress(pp||[]);
            if (remainingMs!==undefined)
            {
                setRemainingSec(Math.max(0, Math.round(remainingMs/1000)));
            }
        });

        socket.on('quiz:ended', ({leaderboard: lb, stats}) =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setLeaderboard(lb||[]);
            setEndStats(stats);
            setPhase('ended');
        });

        socket.on('quiz:error', ({message}) => setError(message));

        return () =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            socket.disconnect();
        };
    }, [quizId, startCountdown]);

    const emit=(event, data={}) => socketRef.current?.emit(event, data);
    const handleStart=() => emit('quiz:start', {quizId});
    const handleEnd=() =>
    {
        if (confirm('End quiz now? All participants will be stopped.')) emit('quiz:end', {quizId});
    };

    // Timer color
    const durationSec=(quiz?.duration||60)*60;
    const timerPct=durationSec>0? (remainingSec/durationSec)*100:0;
    const timerColor=timerPct>50? '#22c55e':timerPct>20? '#f59e0b':'#ef4444';

    // Number of participants who finished all questions
    const completedCount=participantProgress.filter(p => p.answeredCount>=p.totalQuestions).length;

    if (phase==='connecting')
    {
        return (
            <div className="qh-root">
                <div className="qh-spinner">
                    <div className="qh-spin" />
                    <p>Connecting to quiz room…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="qh-root">
            {/* Header */}
            <header className="qh-header">
                <div className="qh-header-left">
                    <span className="qh-logo" style={{display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', border: '3px solid currentColor'}} />
                    <div>
                        <div className="qh-quiz-title">{quiz?.title||'Quiz'}</div>
                        <div className="qh-quiz-meta">Code: <strong className="qh-code">{quiz?.code}</strong>{quiz?.topic&&<> · {quiz.topic}</>}</div>
                    </div>
                </div>
                <div className="qh-header-right">
                    {phase==='active'&&(
                        <div className="qh-countdown" style={{color: timerColor}}>
                            ⏱ {fmtTime(remainingSec)}
                        </div>
                    )}
                    <span className={`qh-phase-badge qh-phase-${phase}`}>{
                        phase==='waiting'? 'Waiting':
                            phase==='active'? 'Live (Self-Paced)':
                                phase==='ended'? 'Ended':phase
                    }</span>
                    {['active', 'waiting'].includes(phase)&&(
                        <button className="qh-btn-danger" onClick={handleEnd}>End Quiz</button>
                    )}
                </div>
            </header>

            {error&&<div className="qh-error">{error} <button onClick={() => setError('')}>✕</button></div>}

            {/* WAITING ROOM */}
            {phase==='waiting'&&(
                <div className="qh-body">
                    <div className="qh-waiting">
                        <div className="qh-waiting-info">
                            <h2>Waiting Room</h2>
                            <p className="qh-sub">Share the code with participants:</p>
                            <div className="qh-big-code">{quiz?.code}</div>
                            <p className="qh-sub">{totalQ} question{totalQ!==1? 's':''} · {quiz?.duration||60} min duration</p>
                            <p className="qh-sub" style={{fontSize: '0.85rem', opacity: 0.7}}>
                                Once started, participants can join and attempt at their own pace. Quiz auto-ends after {quiz?.duration||60} minutes.
                            </p>
                            <button className="qh-btn-start" onClick={handleStart}>
                                ▶ Start Quiz ({quiz?.duration||60} min)
                            </button>
                        </div>
                        <div className="qh-participant-list">
                            <h3>Participants ({participants.length})</h3>
                            {participants.length===0
                                ? <p className="qh-sub">No participants yet — they can also join after you start!</p>
                                :participants.map((p, i) => (
                                    <div className="qh-p-row" key={i}>
                                        <span className="qh-p-rank">#{i+1}</span>
                                        <span className="qh-p-name">{p.name}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIVE — Self-paced dashboard */}
            {phase==='active'&&(
                <div className="qh-body">
                    <div className="qh-live-dashboard">
                        {/* Timer bar at top */}
                        <div className="qh-timer-bar">
                            <div className="qh-timer-fill" style={{width: `${timerPct}%`, background: timerColor}} />
                        </div>

                        {/* Stats row */}
                        <div className="qh-stats-row">
                            <div className="qh-stat">
                                <span className="qh-stat-val" style={{color: timerColor}}>{fmtTime(remainingSec)}</span>
                                <span className="qh-stat-lbl">Time Left</span>
                            </div>
                            <div className="qh-stat">
                                <span className="qh-stat-val">{participants.length}</span>
                                <span className="qh-stat-lbl">Participants</span>
                            </div>
                            <div className="qh-stat">
                                <span className="qh-stat-val">{totalQ}</span>
                                <span className="qh-stat-lbl">Questions</span>
                            </div>
                            <div className="qh-stat">
                                <span className="qh-stat-val">{completedCount}</span>
                                <span className="qh-stat-lbl">Finished</span>
                            </div>
                        </div>

                        <div className="qh-live-columns">
                            {/* Leaderboard */}
                            <div className="qh-sidebar-board">
                                <h3>Live Leaderboard</h3>
                                {leaderboard.length===0
                                    ? <p className="qh-sub">No answers yet…</p>
                                    :leaderboard.slice(0, 15).map((p, i) => (
                                        <div className="qh-lb-row" key={i}>
                                            <span className="qh-lb-rank">{i<3? `#${i+1}`:`#${p.rank}`}</span>
                                            <span className="qh-lb-name">{p.name}</span>
                                            <span className="qh-lb-score">{p.score} pts</span>
                                            <span className="qh-lb-answers">{p.answers}/{totalQ}</span>
                                            {p.violations>0&&(
                                                <span className="qh-lb-integrity" style={{color: p.integrityScore>60? '#f59e0b':'#ef4444'}} title={`Integrity: ${p.integrityScore}% | ${p.violations} violations | -${p.totalPenalty} pts`}>
                                                    ⚠ {p.integrityScore}%
                                                </span>
                                            )}
                                        </div>
                                    ))
                                }
                            </div>

                            {/* Participant progress */}
                            <div className="qh-progress-panel">
                                <h3>Participant Progress</h3>
                                {participantProgress.length===0
                                    ? <p className="qh-sub">Progress data will appear as participants answer…</p>
                                    :participantProgress.map((p, i) =>
                                    {
                                        const pct=totalQ>0? Math.round((p.answeredCount/totalQ)*100):0;
                                        const done=p.answeredCount>=totalQ;
                                        return (
                                            <div className={`qh-prog-row${done? ' done':''}`} key={i}>
                                                <span className="qh-prog-name">{p.name}</span>
                                                <div className="qh-prog-bar-wrap">
                                                    <div className="qh-prog-bar" style={{width: `${pct}%`}} />
                                                </div>
                                                <span className="qh-prog-count">{p.answeredCount}/{totalQ}</span>
                                                <span className="qh-prog-score">{p.score} pts</span>
                                                {done&&<span className="qh-prog-done">✓</span>}
                                                {p.violations>0&&(
                                                    <span className="qh-prog-integrity" style={{color: p.integrityScore>60? '#f59e0b':'#ef4444'}} title={`${p.violations} violations, -${p.totalPenalty} pts penalty`}>
                                                        ⚠ {p.integrityScore}%
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ENDED */}
            {phase==='ended'&&(
                <div className="qh-body qh-ended">
                    <div className="qh-ended-card">
                        <h2>Quiz Complete!</h2>
                        {endStats&&(
                            <div className="qh-stats-row">
                                <div className="qh-stat">
                                    <span className="qh-stat-val">{endStats.totalParticipants}</span>
                                    <span className="qh-stat-lbl">Players</span>
                                </div>
                                <div className="qh-stat">
                                    <span className="qh-stat-val">{endStats.totalQuestions}</span>
                                    <span className="qh-stat-lbl">Questions</span>
                                </div>
                                <div className="qh-stat">
                                    <span className="qh-stat-val">{Math.floor((endStats.duration||0)/60)}m {(endStats.duration||0)%60}s</span>
                                    <span className="qh-stat-lbl">Duration</span>
                                </div>
                            </div>
                        )}
                        <div className="qh-podium">
                            {leaderboard.slice(0, 3).map((p, i) => (
                                <div className={`qh-podium-place p${i+1}`} key={i}>
                                    <div className="qh-podium-medal">#{i+1}</div>
                                    <div className="qh-podium-name">{p.name}</div>
                                    <div className="qh-podium-score">{p.score} pts</div>
                                </div>
                            ))}
                        </div>
                        <div className="qh-full-lb">
                            {leaderboard.map((p, i) => (
                                <div className="qh-lb-row" key={i}>
                                    <span className="qh-lb-rank">#{p.rank}</span>
                                    <span className="qh-lb-name">{p.name}</span>
                                    <span className="qh-lb-score">{p.score} pts</span>
                                    <span className="qh-lb-answers">{p.answers}/{totalQ} answered</span>
                                </div>
                            ))}
                        </div>
                        <div className="qh-ended-actions">
                            <button className="qh-btn-next" onClick={() => navigate(`/quiz/results/${quizId}`)}>Full Results</button>
                            <button className="qh-btn-secondary" onClick={() => navigate('/quiz/dashboard')}>‹ Dashboard</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
