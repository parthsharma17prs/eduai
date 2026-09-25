import {useState, useEffect, useRef, useCallback} from 'react';
import {useSearchParams, useNavigate} from 'react-router-dom';
import {io} from 'socket.io-client';
import {Video, VideoOff, Mic, MicOff, LogOut, Trophy, Clock, Users, Wifi, ChevronLeft, ChevronRight, CheckCircle, ShieldAlert, AlertTriangle} from 'lucide-react';
import ProctoringMonitor from '../components/ProctoringMonitor';
import proctoringService from '../services/proctoring';
import './QuizPlay.css';

const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000';

const OPTION_COLORS=['#3b82f6', '#ef4444', '#f59e0b', '#22c55e'];
const OPTION_LABELS=['A', 'B', 'C', 'D'];

function fmtTime(totalSec)
{
    if (totalSec<=0) return '0:00';
    const h=Math.floor(totalSec/3600);
    const m=Math.floor((totalSec%3600)/60);
    const s=totalSec%60;
    if (h>0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function QuizPlay()
{
    const [searchParams]=useSearchParams();
    const navigate=useNavigate();
    const code=searchParams.get('code');
    const playerName=searchParams.get('name');
    const socketRef=useRef(null);

    // ── Local Camera ─────────────────────────────────────────────────────────
    const videoRef=useRef(null);
    const [localStream, setLocalStream]=useState(null);
    const [isVideoOn, setIsVideoOn]=useState(true);
    const [isAudioOn, setIsAudioOn]=useState(true);

    // ── Proctoring ────────────────────────────────────────────────────────────
    const [proctoringEvents, setProctoringEvents]=useState([]);
    const [integrityScore, setIntegrityScore]=useState(100);
    const [suspicionScore, setSuspicionScore]=useState(0);
    const proctoringStartedRef=useRef(false);

    // Penalty overlay
    const [penaltyFlash, setPenaltyFlash]=useState(null); // {type, severity, penalty, newScore}
    const [totalPenalty, setTotalPenalty]=useState(0);
    const [disqualified, setDisqualified]=useState(false);
    const penaltyTimerRef=useRef(null);

    // ── Quiz State (self-paced) ───────────────────────────────────────────────
    const [phase, setPhase]=useState('connecting'); // connecting | waiting | active | completed | ended
    const [quizTitle, setQuizTitle]=useState('');
    const [hostName, setHostName]=useState('');
    const [participants, setParticipants]=useState([]);

    // All questions received at once
    const [questions, setQuestions]=useState([]);
    const [currentIdx, setCurrentIdx]=useState(0);

    // Per-question answer tracking
    const [answeredMap, setAnsweredMap]=useState({}); // { [qIdx]: { answer, result } }
    const [selectedAnswer, setSelectedAnswer]=useState(null);
    const [shortAnswer, setShortAnswer]=useState('');
    const [submitting, setSubmitting]=useState(false);
    const questionOpenTime=useRef(null);

    // Global countdown (quiz auto-ends)
    const [remainingSec, setRemainingSec]=useState(0);
    const countdownRef=useRef(null);

    // Scores
    const [myScore, setMyScore]=useState(0);
    const [myRank, setMyRank]=useState(null);
    const [leaderboard, setLeaderboard]=useState([]);
    const [endData, setEndData]=useState(null);
    const [error, setError]=useState('');

    // ── Camera ───────────────────────────────────────────────────────────────
    useEffect(() =>
    {
        let stream;
        navigator.mediaDevices.getUserMedia({video: true, audio: true})
            .then(s =>
            {
                stream=s;
                setLocalStream(s);
                if (videoRef.current) videoRef.current.srcObject=s;
            })
            .catch(err => console.warn('[QuizPlay] Camera unavailable:', err));
        return () => {stream?.getTracks().forEach(t => t.stop());};
    }, []);

    useEffect(() =>
    {
        if (videoRef.current&&localStream) videoRef.current.srcObject=localStream;
    }, [localStream]);

    const toggleVideo=useCallback(() =>
    {
        localStream?.getVideoTracks().forEach(t => {t.enabled=!t.enabled; setIsVideoOn(t.enabled);});
    }, [localStream]);

    const toggleAudio=useCallback(() =>
    {
        localStream?.getAudioTracks().forEach(t => {t.enabled=!t.enabled; setIsAudioOn(t.enabled);});
    }, [localStream]);

    // ── Proctoring: start when quiz is active ────────────────────────────────
    const handleViolationDetected=useCallback((violation, newSuspicionScore) =>
    {
        console.log('[QuizPlay] Violation:', violation.type, '| Severity:', violation.severity);
        setProctoringEvents(prev => [...prev, violation]);
        setSuspicionScore(newSuspicionScore);
        setIntegrityScore(Math.max(0, 100-newSuspicionScore));

        // Emit to backend for penalty deduction
        socketRef.current?.emit('quiz:proctoring-event', {
            type: violation.type,
            severity: violation.severity||'medium',
            description: violation.description||violation.type,
        });
    }, []);

    useEffect(() =>
    {
        // Start proctoring when quiz becomes active and video is ready
        if (phase==='active'&&videoRef.current&&!proctoringStartedRef.current)
        {
            proctoringStartedRef.current=true;
            const startProctoring=async () =>
            {
                try
                {
                    console.log('[QuizPlay] Starting proctoring monitoring...');
                    await proctoringService.startMonitoring(
                        videoRef.current,
                        `quiz-${code}`,
                        handleViolationDetected,
                        null // no socketService for quiz — events stay local
                    );
                    console.log('[QuizPlay] Proctoring started successfully');
                } catch (err)
                {
                    console.error('[QuizPlay] Failed to start proctoring:', err);
                }
            };
            startProctoring();
        }

        // Stop proctoring when quiz ends
        if ((phase==='ended'||phase==='completed')&&proctoringStartedRef.current)
        {
            proctoringService.stopMonitoring();
            proctoringStartedRef.current=false;
        }
    }, [phase, code, handleViolationDetected]);

    // Cleanup proctoring on unmount
    useEffect(() =>
    {
        return () =>
        {
            if (proctoringStartedRef.current)
            {
                proctoringService.stopMonitoring();
                proctoringStartedRef.current=false;
            }
        };
    }, []);

    // ── Global Countdown ──────────────────────────────────────────────────────
    const startCountdown=useCallback((endsAtISO) =>
    {
        if (countdownRef.current) clearInterval(countdownRef.current);
        const end=new Date(endsAtISO).getTime();
        const tick=() =>
        {
            const left=Math.max(0, Math.round((end-Date.now())/1000));
            setRemainingSec(left);
            if (left<=0&&countdownRef.current) clearInterval(countdownRef.current);
        };
        tick();
        countdownRef.current=setInterval(tick, 1000);
    }, []);

    // ── Socket ────────────────────────────────────────────────────────────────
    useEffect(() =>
    {
        if (!code||!playerName)
        {
            navigate('/quiz/dashboard?view=join');
            return;
        }

        const socket=io(API_URL, {withCredentials: true});
        socketRef.current=socket;

        socket.on('connect', () =>
        {
            socket.emit('quiz:participant-join', {code, name: playerName});
        });

        socket.on('quiz:joined', (payload) =>
        {
            const {role, status, totalQuestions, title, hostName: host, participants: p,
                questions: qs, answeredIndices, endsAt}=payload;
            if (role!=='participant') return;

            setParticipants(p||[]);
            setQuizTitle(title||'');
            setHostName(host||'');

            if (status==='active'&&Array.isArray(qs)&&qs.length>0)
            {
                // Quiz already active — join mid-quiz
                setQuestions(qs);
                setPhase('active');
                if (endsAt) startCountdown(endsAt);

                // Restore already-answered indices
                if (Array.isArray(answeredIndices)&&answeredIndices.length>0)
                {
                    const map={};
                    answeredIndices.forEach(idx => {map[idx]={answer: '(already answered)', result: null};});
                    setAnsweredMap(map);
                    // Navigate to first unanswered question
                    const firstUnanswered=qs.findIndex((_, i) => !answeredIndices.includes(i));
                    setCurrentIdx(firstUnanswered>=0? firstUnanswered:0);
                }
            } else if (status==='completed')
            {
                setPhase('ended');
            } else
            {
                setPhase('waiting');
            }
        });

        socket.on('quiz:participant-update', ({participants: p}) => setParticipants(p||[]));

        socket.on('quiz:started', ({questions: qs, totalQuestions, endsAt, duration}) =>
        {
            if (Array.isArray(qs))
            {
                setQuestions(qs);
                setPhase('active');
                setCurrentIdx(0);
                setAnsweredMap({});
                setSelectedAnswer(null);
                setShortAnswer('');
                questionOpenTime.current=Date.now();
                if (endsAt) startCountdown(endsAt);
            }
        });

        socket.on('quiz:answer-result', (result) =>
        {
            setSubmitting(false);
            setMyScore(result.totalScore);
            setMyRank(result.rank);

            setAnsweredMap(prev => ({
                ...prev,
                [result.questionIndex]: {
                    answer: prev[result.questionIndex]?.answer||'',
                    result,
                },
            }));

            // Check if all questions done
            if (result.answeredCount>=result.totalQuestions)
            {
                setPhase('completed');
            }
        });

        socket.on('quiz:participant-complete', ({totalScore, rank}) =>
        {
            setMyScore(totalScore);
            setMyRank(rank);
            setPhase('completed');
        });

        socket.on('quiz:leaderboard-live', ({leaderboard: lb}) =>
        {
            setLeaderboard(lb||[]);
            const me=(lb||[]).find(p => p.name===playerName);
            if (me) {setMyScore(me.score); setMyRank(me.rank);}
        });

        socket.on('quiz:progress-update', ({leaderboard: lb}) =>
        {
            if (lb) setLeaderboard(lb);
        });

        socket.on('quiz:ended', ({leaderboard: lb}) =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setLeaderboard(lb||[]);
            const me=(lb||[]).find(p => p.name===playerName);
            if (me) {setMyScore(me.score); setMyRank(me.rank);}
            setEndData({leaderboard: lb});
            setPhase('ended');
        });

        socket.on('quiz:error', ({message}) => setError(message));

        // Penalty & disqualification
        socket.on('quiz:penalty-applied', (data) =>
        {
            setMyScore(data.newScore);
            setIntegrityScore(data.integrityScore);
            setTotalPenalty(data.totalPenalty);
            if (data.rank) setMyRank(data.rank);

            // Show penalty flash overlay
            setPenaltyFlash({type: data.type, severity: data.severity, penalty: data.penalty, newScore: data.newScore});
            if (penaltyTimerRef.current) clearTimeout(penaltyTimerRef.current);
            penaltyTimerRef.current=setTimeout(() => setPenaltyFlash(null), 3500);
        });

        socket.on('quiz:disqualified', ({message}) =>
        {
            setDisqualified(true);
            setPhase('ended');
            setError(message||'You have been disqualified due to repeated violations.');
        });

        return () =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            socket.disconnect();
        };
    }, [code, playerName, navigate, startCountdown]);

    // Reset selection when navigating to a new question
    useEffect(() =>
    {
        if (answeredMap[currentIdx]) return; // already answered, don't reset
        setSelectedAnswer(null);
        setShortAnswer('');
        questionOpenTime.current=Date.now();
    }, [currentIdx, answeredMap]);

    // ── Answer handlers ───────────────────────────────────────────────────────
    const isAnswered=(idx) => !!answeredMap[idx];
    const currentQ=questions[currentIdx]||null;

    const handleSelectOption=(opt) =>
    {
        if (isAnswered(currentIdx)||phase!=='active') return;
        setSelectedAnswer(opt);
    };

    const handleSubmit=() =>
    {
        const answer=currentQ?.type==='short'? shortAnswer.trim():selectedAnswer;
        if (!answer||isAnswered(currentIdx)||submitting) return;
        setSubmitting(true);
        const timeMs=questionOpenTime.current? Date.now()-questionOpenTime.current:0;

        // Save answer locally immediately
        setAnsweredMap(prev => ({...prev, [currentIdx]: {answer, result: null}}));

        socketRef.current?.emit('quiz:submit-answer', {
            quizId: null,
            code,
            questionIndex: currentIdx,
            answer,
            timeMs,
        });
    };

    const goNext=() =>
    {
        if (currentIdx<questions.length-1) setCurrentIdx(currentIdx+1);
    };
    const goPrev=() =>
    {
        if (currentIdx>0) setCurrentIdx(currentIdx-1);
    };

    const answeredCount=Object.keys(answeredMap).length;
    const totalQ=questions.length;
    const timerColor=remainingSec>1800? '#22c55e':remainingSec>600? '#f59e0b':'#ef4444';

    // ── Render quiz content ──────────────────────────────────────────────────
    const renderQuizContent=() =>
    {
        switch (phase)
        {
            case 'connecting':
                return (
                    <div className="qp-center-content">
                        <div className="qp-spin" />
                        <p className="qp-sub">Joining quiz room…</p>
                    </div>
                );

            case 'waiting':
                return (
                    <div className="qp-center-content">
                        <div className="qp-avatar-big">{playerName?.charAt(0).toUpperCase()}</div>
                        <h2 className="qp-player-name">{playerName}</h2>
                        <p className="qp-sub">Ready to begin your live quiz test!</p>
                        <div className="qp-info-card">
                            <div className="qp-info-title">{quizTitle||code}</div>
                            {hostName&&(
                                <div className="qp-info-row">
                                    <Wifi size={13} /> Hosted by {hostName}
                                </div>
                            )}
                            <div className="qp-info-row">
                                <Users size={13} /> {participants.length} player{participants.length!==1? 's':''} joined
                            </div>
                        </div>
                        <button
                            type="button"
                            className="qp-btn-submit"
                            style={{ marginTop: '1.25rem', padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: 600, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: '10px', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)' }}
                            onClick={() => socketRef.current?.emit('quiz:start', { code })}
                        >
                            🚀 Start Test Immediately
                        </button>
                        <div className="qp-pulse-ring" />
                    </div>
                );

            case 'active':
                {
                    if (!currentQ) return null;
                    const answered=isAnswered(currentIdx);
                    const ansResult=answeredMap[currentIdx]?.result;

                    return (
                        <div className="qp-question-content">
                            {/* Penalty flash overlay */}
                            {penaltyFlash&&(
                                <div className={`qp-penalty-flash qp-penalty-${penaltyFlash.severity}`}>
                                    <AlertTriangle size={18} />
                                    <span className="qp-penalty-text">
                                        -{penaltyFlash.penalty} pts — <strong>{penaltyFlash.type.replace(/_/g, ' ')}</strong>
                                    </span>
                                </div>
                            )}

                            {/* Disqualified overlay */}
                            {disqualified&&(
                                <div className="qp-disqualified-overlay">
                                    <ShieldAlert size={48} />
                                    <h2>Disqualified</h2>
                                    <p>You have been removed from this quiz due to repeated cheating violations.</p>
                                    <button className="qp-btn-home" onClick={() => navigate('/')}>Back to Home</button>
                                </div>
                            )}

                            {/* Integrity bar */}
                            {totalPenalty>0&&(
                                <div className="qp-integrity-bar-wrap">
                                    <span className="qp-integrity-label">
                                        <ShieldAlert size={12} /> Integrity: {integrityScore}%
                                    </span>
                                    <div className="qp-integrity-bar">
                                        <div className="qp-integrity-fill"
                                            style={{
                                                width: `${integrityScore}%`,
                                                background: integrityScore>60? '#22c55e':integrityScore>30? '#f59e0b':'#ef4444',
                                            }}
                                        />
                                    </div>
                                    <span className="qp-penalty-total">-{totalPenalty} pts penalty</span>
                                </div>
                            )}

                            {/* Global countdown */}
                            <div className="qp-global-timer">
                                <Clock size={14} style={{color: timerColor}} />
                                <span style={{color: timerColor, fontWeight: 700}}>{fmtTime(remainingSec)}</span>
                                <span className="qp-progress-text">{answeredCount}/{totalQ} answered</span>
                            </div>

                            {/* Question navigator strip */}
                            <div className="qp-q-nav-strip">
                                {questions.map((_, i) => (
                                    <button
                                        key={i}
                                        className={`qp-q-dot${i===currentIdx? ' current':''}${isAnswered(i)? ' done':''}`}
                                        onClick={() => setCurrentIdx(i)}
                                        title={`Q${i+1}${isAnswered(i)? ' (answered)':''}`}
                                    >
                                        {i+1}
                                    </button>
                                ))}
                            </div>

                            {/* Question text */}
                            <div className="qp-q-meta">
                                <span className="qp-q-num">Question {currentIdx+1} / {totalQ}</span>
                                <div className="qp-q-chips">
                                    <span className="qp-chip qp-chip-score">
                                        <Trophy size={12} /> {myScore} pts
                                    </span>
                                    {myRank&&<span className="qp-chip">Rank #{myRank}</span>}
                                    <span className="qp-chip">{currentQ.points} pts</span>
                                </div>
                            </div>

                            <div className="qp-q-text">{currentQ.text}</div>

                            {/* MCQ options */}
                            {currentQ.type==='mcq'&&(
                                <div className="qp-options">
                                    {currentQ.options.map((opt, i) =>
                                    {
                                        let cls='qp-option';
                                        if (answered&&ansResult)
                                        {
                                            if (opt===ansResult.correctAnswer) cls+=' correct-answer';
                                            else if (opt===answeredMap[currentIdx]?.answer&&!ansResult.correct) cls+=' wrong-answer';
                                            else cls+=' locked';
                                        } else if (answered) cls+=' locked';
                                        else if (selectedAnswer===opt) cls+=' selected';

                                        return (
                                            <button
                                                key={i}
                                                className={cls}
                                                style={{'--opt-color': OPTION_COLORS[i]}}
                                                onClick={() => handleSelectOption(opt)}
                                                disabled={answered}
                                            >
                                                <span className="qp-opt-label" style={{background: OPTION_COLORS[i]}}>{OPTION_LABELS[i]}</span>
                                                <span className="qp-opt-text">{opt}</span>
                                                {answered&&ansResult&&opt===ansResult.correctAnswer&&<CheckCircle size={16} color="#22c55e" style={{marginLeft: 'auto'}} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Short answer */}
                            {currentQ.type==='short'&&!answered&&(
                                <div className="qp-short-wrap">
                                    <textarea
                                        className="qp-short-input"
                                        value={shortAnswer}
                                        onChange={e => setShortAnswer(e.target.value)}
                                        placeholder="Type your answer…"
                                        rows={4}
                                    />
                                </div>
                            )}

                            {/* Answer result */}
                            {answered&&ansResult&&(
                                <div className={`qp-inline-result ${ansResult.correct? 'correct':'wrong'}`}>
                                    <span>{ansResult.correct? 'Correct!':'Wrong!'}</span>
                                    {ansResult.correct&&<span className="qp-pts-badge">+{ansResult.pointsEarned} pts</span>}
                                    {ansResult.streak>=3&&<span className="qp-streak-badge">{ansResult.streak}x streak!</span>}
                                    {ansResult.explanation&&<p className="qp-explanation">{ansResult.explanation}</p>}
                                </div>
                            )}

                            {/* Submit or navigation */}
                            <div className="qp-q-actions">
                                <button className="qp-nav-btn" onClick={goPrev} disabled={currentIdx===0}>
                                    <ChevronLeft size={16} /> Prev
                                </button>

                                {!answered&&(
                                    <button
                                        className="qp-submit-btn"
                                        onClick={handleSubmit}
                                        disabled={submitting||(currentQ.type==='mcq'? !selectedAnswer:!shortAnswer.trim())}
                                    >
                                        {submitting? 'Submitting…':'Submit'}
                                    </button>
                                )}

                                <button className="qp-nav-btn" onClick={goNext} disabled={currentIdx>=totalQ-1}>
                                    Next <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    );
                }

            case 'completed':
                return (
                    <div className="qp-center-content">
                        <div className="qp-result-icon correct"><span style={{display: 'inline-block', width: '56px', height: '56px', borderRadius: '50%', border: '4px solid #22c55e'}} /></div>
                        <h2 className="qp-ended-title">All Questions Answered!</h2>
                        <p className="qp-sub">Waiting for the quiz to end…</p>
                        <div className="qp-score-summary">
                            <div className="qp-score-box">
                                <span className="qp-score-val">{myScore}</span>
                                <span className="qp-score-lbl">Total Score</span>
                            </div>
                            <div className="qp-score-box">
                                <span className="qp-score-val">#{myRank||'—'}</span>
                                <span className="qp-score-lbl">Rank</span>
                            </div>
                            <div className="qp-score-box">
                                <span className="qp-score-val">{answeredCount}/{totalQ}</span>
                                <span className="qp-score-lbl">Answered</span>
                            </div>
                        </div>
                        {remainingSec>0&&(
                            <p className="qp-sub" style={{marginTop: 16}}>
                                Quiz ends in <strong style={{color: timerColor}}>{fmtTime(remainingSec)}</strong>
                            </p>
                        )}
                    </div>
                );

            case 'ended':
                {
                    const myPos=endData?.leaderboard?.findIndex(p => p.name===playerName)??-1;
                    const me=myPos>=0? endData.leaderboard[myPos]:null;
                    return (
                        <div className="qp-center-content">
                            <div className="qp-ended-icon">
                                {myPos>=0&&myPos<3? `#${myPos+1}`:'Done'}
                            </div>
                            <h2 className="qp-ended-title">Quiz Complete!</h2>
                            {me&&(
                                <div className="qp-score-summary">
                                    <div className="qp-score-box">
                                        <span className="qp-score-val">{me.score}</span>
                                        <span className="qp-score-lbl">Your Score</span>
                                    </div>
                                    <div className="qp-score-box">
                                        <span className="qp-score-val">#{me.rank}</span>
                                        <span className="qp-score-lbl">Final Rank</span>
                                    </div>
                                </div>
                            )}
                            <div className="qp-lb-list">
                                {(endData?.leaderboard||[]).slice(0, 10).map((p, i) => (
                                    <div className={`qp-lb-row${p.name===playerName? ' me':''}`} key={i}>
                                        <span className="qp-lb-rank">
                                            {i<3? `#${i+1}`:`#${p.rank}`}
                                        </span>
                                        <span className="qp-lb-name">{p.name}{p.name===playerName? ' (You)':''}</span>
                                        <span className="qp-lb-score">{p.score} pts</span>
                                    </div>
                                ))}
                            </div>
                            <button className="qp-btn-home" onClick={() => navigate('/')}>Back to Home</button>
                        </div>
                    );
                }

            default:
                return null;
        }
    };

    // ── Main Render ───────────────────────────────────────────────────────────
    return (
        <div className="quiz-room">
            {/* Header */}
            <div className="quiz-room-header">
                <div className="quiz-room-info">
                    <span className="quiz-room-title">{quizTitle||'Quiz Room'}</span>
                    <span className="quiz-room-code-badge">Room {code}</span>
                    <span className="quiz-room-mode-badge">Self-Paced Quiz</span>
                </div>
                <div className="quiz-room-controls">
                    {['active', 'completed'].includes(phase)&&(
                        <>
                            <span className="quiz-header-chip" style={{color: timerColor}}>
                                <Clock size={13} /> {fmtTime(remainingSec)}
                            </span>
                            <span className="quiz-header-chip quiz-header-score">
                                <Trophy size={13} /> {myScore} pts
                            </span>
                            {myRank&&<span className="quiz-header-chip">Rank #{myRank}</span>}
                            <span className="quiz-header-chip">{answeredCount}/{totalQ}</span>
                        </>
                    )}
                    <button className="btn btn-danger quiz-leave-btn" onClick={() => navigate('/')}>
                        <LogOut size={14} /> Leave
                    </button>
                </div>
            </div>

            {error&&<div className="quiz-error-bar">{error}</div>}

            {/* Content */}
            <div className="quiz-room-content">
                {/* Left Panel: Camera + Proctoring */}
                <div className="quiz-left-panel">
                    <div className="qp-camera-panel">
                        <div className="qp-camera-header">
                            <span className="qp-camera-label">Your Camera</span>
                            <div className="qp-camera-btns">
                                <button
                                    className={`qp-cam-btn${!isVideoOn? ' off':''}`}
                                    onClick={toggleVideo}
                                    title={isVideoOn? 'Turn off camera':'Turn on camera'}
                                >
                                    {isVideoOn? <Video size={14} />:<VideoOff size={14} />}
                                </button>
                                <button
                                    className={`qp-cam-btn${!isAudioOn? ' off':''}`}
                                    onClick={toggleAudio}
                                    title={isAudioOn? 'Mute':'Unmute'}
                                >
                                    {isAudioOn? <Mic size={14} />:<MicOff size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="qp-video-wrap">
                            <video ref={videoRef} autoPlay playsInline muted className="qp-local-video" />
                            {!isVideoOn&&(
                                <div className="qp-video-off-overlay">
                                    <VideoOff size={32} color="#888" />
                                    <span>Camera off</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <ProctoringMonitor
                        interviewId={code}
                        events={proctoringEvents}
                        integrityScore={integrityScore}
                    />
                </div>

                {/* Right Panel: Quiz Content */}
                <div className="quiz-middle-panel">
                    {renderQuizContent()}
                </div>
            </div>
        </div>
    );
}
