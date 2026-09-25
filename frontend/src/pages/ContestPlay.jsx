import {useState, useEffect, useRef, useCallback} from 'react';
import {useSearchParams, useNavigate} from 'react-router-dom';
import {io} from 'socket.io-client';
import {Code2, Clock, Trophy, Users, Play, Send, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, Lightbulb, RotateCcw, Video, VideoOff, Mic, MicOff, LogOut, Shield} from 'lucide-react';
import CodeEditor from '../components/CodeEditor';
import ProctoringMonitor from '../components/ProctoringMonitor';
import proctoringService from '../services/proctoring';
import './ContestPlay.css';

const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000';

const DIFFICULTY_COLORS={easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444'};

function fmtTime(totalSec)
{
    if (totalSec<=0) return '0:00';
    const h=Math.floor(totalSec/3600);
    const m=Math.floor((totalSec%3600)/60);
    const s=totalSec%60;
    if (h>0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ContestPlay()
{
    const [searchParams]=useSearchParams();
    const navigate=useNavigate();
    const code=searchParams.get('code');
    const playerName=searchParams.get('name');
    const socketRef=useRef(null);

    // State
    const [phase, setPhase]=useState('connecting');
    const [contestTitle, setContestTitle]=useState('');
    const [hostName, setHostName]=useState('');
    const [participants, setParticipants]=useState([]);

    // Challenges
    const [challenges, setChallenges]=useState([]);
    const [currentIdx, setCurrentIdx]=useState(0);
    const [submittedMap, setSubmittedMap]=useState({});

    // Code editor
    const [codeValue, setCodeValue]=useState('');
    const [language, setLanguage]=useState('javascript');

    // Submission state
    const [running, setRunning]=useState(false);
    const [submitting, setSubmitting]=useState(false);
    const [runResults, setRunResults]=useState(null);
    const [submitResults, setSubmitResults]=useState(null);
    const [showHints, setShowHints]=useState(false);

    // Timer
    const [remainingSec, setRemainingSec]=useState(0);
    const [durationSec, setDurationSec]=useState(90*60);
    const countdownRef=useRef(null);
    const challengeOpenTime=useRef(null);

    // Scores
    const [myScore, setMyScore]=useState(0);
    const [mySolvedCount, setMySolvedCount]=useState(0);
    const [myRank, setMyRank]=useState(null);
    const [leaderboard, setLeaderboard]=useState([]);
    const [endData, setEndData]=useState(null);
    const [error, setError]=useState('');

    // ── Camera & Proctoring ──────────────────────────────────────────────────
    const videoRef=useRef(null);
    const [localStream, setLocalStream]=useState(null);
    const [isVideoOn, setIsVideoOn]=useState(true);
    const [isAudioOn, setIsAudioOn]=useState(true);
    const [proctoringEvents, setProctoringEvents]=useState([]);
    const [integrityScore, setIntegrityScore]=useState(100);
    const [suspicionScore, setSuspicionScore]=useState(0);
    const proctoringStartedRef=useRef(false);

    // ── Camera Setup ─────────────────────────────────────────────────────────
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
            .catch(err => console.warn('[ContestPlay] Camera unavailable:', err));
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

    // ── Proctoring: start when contest is active ─────────────────────────────
    const handleViolationDetected=useCallback((violation, newSuspicionScore) =>
    {
        setProctoringEvents(prev => [...prev, violation]);
        setSuspicionScore(newSuspicionScore);
        setIntegrityScore(Math.max(0, 100-newSuspicionScore));
        socketRef.current?.emit('contest:proctoring-event', {
            type: violation.type,
            severity: violation.severity||'medium',
            description: violation.description||violation.type,
        });
    }, []);

    useEffect(() =>
    {
        if (phase==='active'&&videoRef.current&&!proctoringStartedRef.current)
        {
            proctoringStartedRef.current=true;
            (async () =>
            {
                try
                {
                    await proctoringService.startMonitoring(
                        videoRef.current,
                        `contest-${code}`,
                        handleViolationDetected,
                        null
                    );
                } catch (err)
                {
                    console.error('[ContestPlay] Failed to start proctoring:', err);
                }
            })();
        }
        if ((phase==='ended'||phase==='completed')&&proctoringStartedRef.current)
        {
            proctoringService.stopMonitoring();
            proctoringStartedRef.current=false;
        }
    }, [phase, code, handleViolationDetected]);

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

    // ── Countdown ────────────────────────────────────────────────────────────
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

    // ── Socket connection ────────────────────────────────────────────────────
    useEffect(() =>
    {
        if (!code||!playerName)
        {
            navigate('/contest/dashboard?view=join');
            return;
        }

        const socket=io(API_URL, {withCredentials: true});
        socketRef.current=socket;

        socket.on('connect', () =>
        {
            socket.emit('contest:participant-join', {code, name: playerName});
        });

        socket.on('contest:joined', ({status, challenges: ch, totalChallenges, title, hostName: hn, endsAt, duration, submittedIndices, participants: p}) =>
        {
            setContestTitle(title||'Contest');
            setHostName(hn||'Host');
            setParticipants(p||[]);
            if (duration) setDurationSec(duration*60);

            if (status==='active'&&ch)
            {
                setChallenges(ch);
                setPhase('active');
                if (endsAt) startCountdown(endsAt);
                challengeOpenTime.current=Date.now();
                if (ch.length>0)
                {
                    setCodeValue(ch[0].starterCode?.[language]||getDefaultStarter(ch[0], language));
                }
                if (submittedIndices)
                {
                    const map={};
                    submittedIndices.forEach(i => {map[i]={submitted: true};});
                    setSubmittedMap(map);
                }
            } else if (status==='completed')
            {
                setPhase('ended');
            } else
            {
                setPhase('waiting');
            }
        });

        socket.on('contest:participant-update', ({participants: p}) =>
        {
            setParticipants(p||[]);
        });

        socket.on('contest:started', ({challenges: ch, totalChallenges, endsAt, duration}) =>
        {
            setChallenges(ch||[]);
            setPhase('active');
            if (duration) setDurationSec(duration*60);
            if (endsAt) startCountdown(endsAt);
            challengeOpenTime.current=Date.now();
            if (ch&&ch.length>0)
            {
                setCodeValue(ch[0].starterCode?.[language]||getDefaultStarter(ch[0], language));
            }
        });

        socket.on('contest:run-result', ({challengeIndex, results, passed, total, output}) =>
        {
            setRunning(false);
            setRunResults({challengeIndex, results, passed, total, output});
        });

        socket.on('contest:submission-result', ({challengeIndex, passed, total, pointsEarned, totalScore, solvedCount, rank, allPassed, results}) =>
        {
            setSubmitting(false);
            setSubmitResults({challengeIndex, passed, total, pointsEarned, allPassed, results});
            setMyScore(totalScore);
            setMySolvedCount(solvedCount);
            setMyRank(rank);
            setSubmittedMap(prev => ({...prev, [challengeIndex]: {submitted: true, allPassed}}));
        });

        socket.on('contest:leaderboard-live', ({leaderboard: lb}) =>
        {
            setLeaderboard(lb||[]);
        });

        socket.on('contest:progress-update', ({leaderboard: lb, remainingMs}) =>
        {
            setLeaderboard(lb||[]);
            if (remainingMs!==undefined) setRemainingSec(Math.max(0, Math.round(remainingMs/1000)));
        });

        socket.on('contest:ended', ({leaderboard: lb, stats}) =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setLeaderboard(lb||[]);
            setEndData(stats);
            setPhase('ended');
        });

        socket.on('contest:error', ({message}) => setError(message));

        return () =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            socket.disconnect();
        };
    }, [code, playerName, navigate, startCountdown, language]);

    const getDefaultStarter=(challenge, lang) =>
    {
        const fn=challenge?.functionName?.[lang]||'solution';
        const starters={
            javascript: `function ${fn}(input) {\n  // Write your code here\n  return result;\n}\n`,
            python: `def ${fn}(input):\n    # Write your code here\n    return result\n`,
            java: `public class Solution {\n    public static String ${fn}(String input) {\n        // Write your code here\n        return result;\n    }\n}`,
            cpp: `#include <string>\nusing namespace std;\n\nstring ${fn}(string input) {\n    // Write your code here\n    return result;\n}`,
        };
        return starters[lang]||starters.javascript;
    };

    const selectChallenge=(idx) =>
    {
        setCurrentIdx(idx);
        setRunResults(null);
        setSubmitResults(null);
        setShowHints(false);
        const ch=challenges[idx];
        if (ch)
        {
            setCodeValue(ch.starterCode?.[language]||getDefaultStarter(ch, language));
        }
        challengeOpenTime.current=Date.now();
    };

    const handleLanguageChange=(newLang) =>
    {
        setLanguage(newLang);
        const ch=challenges[currentIdx];
        if (ch)
        {
            setCodeValue(ch.starterCode?.[newLang]||getDefaultStarter(ch, newLang));
        }
    };

    const handleRun=() =>
    {
        setRunning(true);
        setRunResults(null);
        setSubmitResults(null);
        socketRef.current?.emit('contest:run-code', {
            challengeIndex: currentIdx,
            code: codeValue,
            language,
        });
    };

    const handleSubmit=() =>
    {
        setSubmitting(true);
        setRunResults(null);
        setSubmitResults(null);
        const timeMs=challengeOpenTime.current? Date.now()-challengeOpenTime.current:0;
        socketRef.current?.emit('contest:submit-code', {
            challengeIndex: currentIdx,
            code: codeValue,
            language,
            timeMs,
        });
    };

    const handleReset=() =>
    {
        const ch=challenges[currentIdx];
        if (ch)
        {
            setCodeValue(ch.starterCode?.[language]||getDefaultStarter(ch, language));
        }
        setRunResults(null);
        setSubmitResults(null);
    };

    const currentChallenge=challenges[currentIdx];
    const timerPct=durationSec>0? (remainingSec/durationSec)*100:0;
    const timerColor=timerPct>50? '#22c55e':timerPct>20? '#f59e0b':'#ef4444';
    const timerClass=timerPct>50? '':timerPct>20? 'warning':'danger';

    // ── Connecting Screen ────────────────────────────────────────────────────
    if (phase==='connecting')
    {
        return (
            <div className="cp-root">
                <div className="cp-waiting">
                    <div className="cp-spin" />
                    <p>Connecting to contest...</p>
                </div>
            </div>
        );
    }

    // ── Waiting Screen ───────────────────────────────────────────────────────
    if (phase==='waiting')
    {
        return (
            <div className="cp-root">
                <div className="cp-waiting">
                    <div className="cp-waiting-avatar">
                        {playerName?.charAt(0)?.toUpperCase()||'?'}
                    </div>
                    <div className="cp-waiting-name">{playerName}</div>
                    <div className="cp-waiting-sub">Waiting for the host to start...</div>
                    <div className="cp-waiting-info">
                        <h4>{contestTitle}</h4>
                        <div className="cp-waiting-meta">
                            <span><Users size={14} /> {participants.length} participants connected</span>
                            <span><Code2 size={14} /> Hosted by {hostName}</span>
                            <span><Clock size={14} /> Duration: {Math.round(durationSec/60)} min</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="cp-btn-submit"
                        style={{ margin: '1rem 0', padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: 600, background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '10px', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)' }}
                        onClick={() => socketRef.current?.emit('contest:start', { code })}
                    >
                        🚀 Start Test Immediately
                    </button>
                    {/* Camera preview while waiting */}
                    <div className="cp-waiting-camera">
                        <div className="cp-video-wrap">
                            <video ref={videoRef} autoPlay muted playsInline className="cp-local-video" />
                            {!isVideoOn&&(
                                <div className="cp-video-off-overlay">
                                    <VideoOff size={24} />
                                    <span>Camera Off</span>
                                </div>
                            )}
                        </div>
                        <div className="cp-camera-btns" style={{justifyContent: 'center', marginTop: 8}}>
                            <button className={`cp-cam-btn${!isVideoOn? ' off':''}`} onClick={toggleVideo} title={isVideoOn? 'Turn off camera':'Turn on camera'}>
                                {isVideoOn? <Video size={14} />:<VideoOff size={14} />}
                            </button>
                            <button className={`cp-cam-btn${!isAudioOn? ' off':''}`} onClick={toggleAudio} title={isAudioOn? 'Mute mic':'Unmute mic'}>
                                {isAudioOn? <Mic size={14} />:<MicOff size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Ended Screen ─────────────────────────────────────────────────────────
    if (phase==='ended')
    {
        return (
            <div className="cp-root">
                <div className="cp-ended">
                    <div className="cp-ended-icon"><Trophy size={56} /></div>
                    <div className="cp-ended-title">Contest Complete!</div>
                    <div className="cp-ended-sub">{contestTitle}</div>
                    <div className="cp-ended-stats">
                        <div className="cp-ended-stat">
                            <div className="cp-ended-stat-val">{myScore}</div>
                            <div className="cp-ended-stat-lbl">Points</div>
                        </div>
                        <div className="cp-ended-stat">
                            <div className="cp-ended-stat-val">#{myRank||'-'}</div>
                            <div className="cp-ended-stat-lbl">Rank</div>
                        </div>
                        <div className="cp-ended-stat">
                            <div className="cp-ended-stat-val">{mySolvedCount}/{challenges.length}</div>
                            <div className="cp-ended-stat-lbl">Solved</div>
                        </div>
                        <div className="cp-ended-stat">
                            <div className="cp-ended-stat-val">{integrityScore}%</div>
                            <div className="cp-ended-stat-lbl">Integrity</div>
                        </div>
                    </div>
                    <div className="cp-leaderboard-section">
                        <h4><Trophy size={14} /> Final Leaderboard</h4>
                        <div className="cp-lb-list">
                            {leaderboard.slice(0, 10).map((p, i) => (
                                <div className={`cp-lb-row${p.name===playerName? ' me':''}`} key={i}>
                                    <span className="cp-lb-rank">#{p.rank}</span>
                                    <span className="cp-lb-name">{p.name}</span>
                                    <span className="cp-lb-solved">{p.solvedCount} solved</span>
                                    <span className="cp-lb-score">{p.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button className="cp-btn-results" onClick={() => navigate('/contest/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // ── Active Contest ────────────────────────────────────────────────────────
    return (
        <div className="cp-root">
            {/* Header */}
            <header className="cp-header">
                <div className="cp-header-left">
                    <Code2 size={20} />
                    <div className="cp-contest-title">{contestTitle}</div>
                    <span className="cp-code-badge">{code}</span>
                </div>
                <div className="cp-header-center">
                    <div className={`cp-timer ${timerClass}`}>
                        <Clock size={16} /> {fmtTime(remainingSec)}
                    </div>
                </div>
                <div className="cp-header-right">
                    <span className="cp-chip cp-chip-score">
                        <Trophy size={12} /> {myScore} pts
                    </span>
                    <span className="cp-chip">
                        #{myRank||'-'}
                    </span>
                    <span className="cp-chip">
                        <Shield size={12} /> {integrityScore}%
                    </span>
                    <button className="cp-leave-btn" onClick={() => {if (confirm('Leave the contest?')) navigate('/contest/dashboard');}}>
                        <LogOut size={14} /> Leave
                    </button>
                </div>
            </header>

            {error&&<div className="cp-error-bar">{error}</div>}

            <div className="cp-content">
                {/* ── Left Sidebar: Problems + Camera ──────────────────── */}
                <aside className="cp-sidebar">
                    <div className="cp-sidebar-header">Problems ({challenges.length})</div>
                    <div className="cp-problems-list">
                        {challenges.map((ch, i) =>
                        {
                            const status=submittedMap[i];
                            return (
                                <div
                                    key={i}
                                    className={`cp-problem-item${i===currentIdx? ' active':''}${status?.allPassed? ' solved':status?.submitted? ' attempted':''}`}
                                    onClick={() => selectChallenge(i)}
                                >
                                    <div className="cp-problem-num">{i+1}</div>
                                    <div className="cp-problem-info">
                                        <div className="cp-problem-title">{ch.title}</div>
                                        <div className="cp-problem-meta">
                                            <span style={{color: DIFFICULTY_COLORS[ch.difficulty]}}>{ch.difficulty}</span>
                                            <span>{ch.points}pts</span>
                                        </div>
                                    </div>
                                    {status?.allPassed&&<CheckCircle size={14} className="cp-problem-solved-icon" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Camera */}
                    <div className="cp-camera-section">
                        <div className="cp-camera-header">
                            <span className="cp-camera-label">Webcam</span>
                            <div className="cp-camera-btns">
                                <button className={`cp-cam-btn${!isVideoOn? ' off':''}`} onClick={toggleVideo} title={isVideoOn? 'Turn off camera':'Turn on camera'}>
                                    {isVideoOn? <Video size={12} />:<VideoOff size={12} />}
                                </button>
                                <button className={`cp-cam-btn${!isAudioOn? ' off':''}`} onClick={toggleAudio} title={isAudioOn? 'Mute mic':'Unmute mic'}>
                                    {isAudioOn? <Mic size={12} />:<MicOff size={12} />}
                                </button>
                            </div>
                        </div>
                        <div className="cp-video-wrap">
                            <video ref={videoRef} autoPlay muted playsInline className="cp-local-video" />
                            {!isVideoOn&&(
                                <div className="cp-video-off-overlay">
                                    <VideoOff size={20} />
                                    <span>Camera Off</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mini Proctoring */}
                    <ProctoringMonitor
                        interviewId={`contest-${code}`}
                        events={proctoringEvents}
                        suspicionScore={suspicionScore}
                        integrityScore={integrityScore}
                    />
                </aside>

                {/* ── Center: Problem Description ──────────────────────── */}
                {currentChallenge? (
                    <>
                        <div className="cp-problem-panel">
                            <div className="cp-problem-header">
                                <div className="cp-problem-title-main">{currentChallenge.title}</div>
                                <div className="cp-problem-chips">
                                    <span className={`cp-difficulty-chip cp-difficulty-${currentChallenge.difficulty}`}>
                                        {currentChallenge.difficulty}
                                    </span>
                                    <span className="cp-points-chip">{currentChallenge.points} pts</span>
                                </div>
                            </div>
                            <div className="cp-problem-body">
                                <div className="cp-problem-description">{currentChallenge.description}</div>

                                {currentChallenge.examples?.length>0&&(
                                    <div className="cp-problem-section">
                                        <h4>Examples</h4>
                                        {currentChallenge.examples.map((ex, i) => (
                                            <div key={i} className="cp-testcase">
                                                <div className="cp-testcase-label">Input</div>
                                                <div className="cp-testcase-value">{typeof ex.input==='object'? JSON.stringify(ex.input):String(ex.input)}</div>
                                                <div className="cp-testcase-label" style={{marginTop: 8}}>Output</div>
                                                <div className="cp-testcase-value">{typeof ex.output==='object'? JSON.stringify(ex.output):String(ex.output)}</div>
                                                {ex.explanation&&<>
                                                    <div className="cp-testcase-label" style={{marginTop: 8}}>Explanation</div>
                                                    <div className="cp-testcase-value">{ex.explanation}</div>
                                                </>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {currentChallenge.constraints?.length>0&&(
                                    <div className="cp-problem-section">
                                        <h4>Constraints</h4>
                                        <ul style={{paddingLeft: 18, color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.7}}>
                                            {currentChallenge.constraints.map((c, i) => <li key={i}>{c}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {currentChallenge.hints?.length>0&&(
                                    <div className="cp-problem-section">
                                        <h4 style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6}} onClick={() => setShowHints(!showHints)}>
                                            <Lightbulb size={14} /> {showHints? 'Hide Hints':'Show Hints'}
                                        </h4>
                                        {showHints&&(
                                            <ul style={{paddingLeft: 18, color: '#fde047', fontSize: '0.85rem', lineHeight: 1.7}}>
                                                {currentChallenge.hints.map((h, i) => <li key={i}>{h}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {currentChallenge.testCases?.filter(tc => !tc.hidden).length>0&&(
                                    <div className="cp-problem-section">
                                        <h4><Eye size={14} /> Visible Test Cases</h4>
                                        {currentChallenge.testCases.filter(tc => !tc.hidden).map((tc, i) => (
                                            <div key={i} className="cp-testcase">
                                                <div className="cp-testcase-label">Input</div>
                                                <div className="cp-testcase-value">{typeof tc.input==='object'? JSON.stringify(tc.input):String(tc.input)}</div>
                                                <div className="cp-testcase-label" style={{marginTop: 8}}>Expected</div>
                                                <div className="cp-testcase-value">{typeof tc.output==='object'? JSON.stringify(tc.output):String(tc.output)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Right: Code Editor ───────────────────────────── */}
                        <div className="cp-code-panel">
                            <div className="cp-code-header">
                                <select className="cp-lang-select" value={language} onChange={e => handleLanguageChange(e.target.value)}>
                                    <option value="javascript">JavaScript</option>
                                    <option value="python">Python</option>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                </select>
                                <div className="cp-code-actions">
                                    <button className="cp-btn-run" onClick={handleReset} title="Reset code">
                                        <RotateCcw size={14} /> Reset
                                    </button>
                                    <button className="cp-btn-run" onClick={handleRun} disabled={running}>
                                        <Play size={14} /> {running? 'Running...':'Run'}
                                    </button>
                                    <button className="cp-btn-submit" onClick={handleSubmit} disabled={submitting}>
                                        <Send size={14} /> {submitting? 'Submitting...':'Submit'}
                                    </button>
                                </div>
                            </div>

                            <div className="cp-editor-wrap">
                                <CodeEditor
                                    value={codeValue}
                                    onChange={setCodeValue}
                                    language={language}
                                    height="100%"
                                />
                            </div>

                            {/* Output panel */}
                            {(runResults||submitResults)&&(
                                <div className="cp-output-panel">
                                    <div className="cp-output-header">
                                        <span>{submitResults? 'Submission Results':'Run Results'}</span>
                                        <button className="cp-output-close" onClick={() => {setRunResults(null); setSubmitResults(null);}}>
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                    <div className="cp-output-body">
                                        {runResults&&(
                                            <>
                                                <div className={`cp-output-result ${runResults.passed===runResults.total? 'pass':'fail'}`}>
                                                    {runResults.passed===runResults.total? <CheckCircle size={16} />:<XCircle size={16} />}
                                                    {runResults.passed}/{runResults.total} test cases passed
                                                </div>
                                                <div className="cp-output-cases">
                                                    {runResults.results?.map((r, i) => (
                                                        <div key={i} className="cp-case-row">
                                                            <span className={`cp-case-icon ${r.passed? 'cp-case-pass':'cp-case-fail'}`}>
                                                                {r.passed? <CheckCircle size={14} />:<XCircle size={14} />}
                                                            </span>
                                                            <span className="cp-case-label">Test {i+1}</span>
                                                            {!r.passed&&<span className="cp-case-fail" style={{fontSize: '0.75rem'}}>Expected: {r.expected} | Got: {r.actual}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        {submitResults&&(
                                            <>
                                                <div className={`cp-output-result ${submitResults.allPassed? 'pass':'fail'}`}>
                                                    {submitResults.allPassed? <CheckCircle size={16} />:<AlertTriangle size={16} />}
                                                    {submitResults.allPassed? 'All Tests Passed!':`${submitResults.passed}/${submitResults.total} Tests Passed`}
                                                    <span style={{marginLeft: 8, color: '#10b981'}}>+{submitResults.pointsEarned} pts</span>
                                                </div>
                                                <div className="cp-output-cases">
                                                    {submitResults.results?.map((r, i) => (
                                                        <div key={i} className="cp-case-row">
                                                            <span className={`cp-case-icon ${r.passed? 'cp-case-pass':'cp-case-fail'}`}>
                                                                {r.passed? <CheckCircle size={14} />:<XCircle size={14} />}
                                                            </span>
                                                            <span className="cp-case-label">Test {i+1} {r.hidden? '(hidden)':''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ):(
                    <div className="cp-problem-panel" style={{gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b'}}>
                        <Code2 size={48} style={{opacity: 0.3, marginRight: 12}} />
                        Select a problem from the sidebar to start coding
                    </div>
                )}
            </div>
        </div>
    );
}
