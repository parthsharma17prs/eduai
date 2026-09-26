import {useState, useEffect, useRef, useCallback} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {io} from 'socket.io-client';
import {Code2, Clock, Users, Trophy, Play, Square, BarChart3, CheckCircle, AlertTriangle, ChevronRight} from 'lucide-react';
import {API_BASE_URL} from '../services/api';
import './ContestHost.css';

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

export default function ContestHost()
{
    const {contestId}=useParams();
    const navigate=useNavigate();
    const socketRef=useRef(null);

    const [phase, setPhase]=useState('connecting');
    const [contest, setContest]=useState(null);
    const [participants, setParticipants]=useState([]);
    const [leaderboard, setLeaderboard]=useState([]);
    const [totalC, setTotalC]=useState(0);
    const [endStats, setEndStats]=useState(null);
    const [error, setError]=useState('');

    const [remainingSec, setRemainingSec]=useState(0);
    const [participantProgress, setParticipantProgress]=useState([]);
    const countdownRef=useRef(null);

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

    useEffect(() =>
    {
        const socket=io(API_URL, {withCredentials: true});
        socketRef.current=socket;

        socket.on('connect', () =>
        {
            socket.emit('contest:host-join', {contestId});
        });

        socket.on('contest:joined', ({contest: c, participants: p, role, endsAt}) =>
        {
            if (role!=='host') return;
            setContest(c);
            setLeaderboard(p||[]);
            setParticipants(p||[]);
            setTotalC(c.totalChallenges||c.challenges?.length||0);

            if (c.status==='active')
            {
                setPhase('active');
                if (endsAt||c.endsAt) startCountdown(endsAt||c.endsAt);
            } else if (c.status==='completed')
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
            setLeaderboard(p||[]);
        });

        socket.on('contest:started', ({totalChallenges, endsAt, duration}) =>
        {
            setTotalC(totalChallenges);
            setPhase('active');
            if (endsAt) startCountdown(endsAt);
        });

        socket.on('contest:leaderboard-live', ({leaderboard: lb}) =>
        {
            setLeaderboard(lb||[]);
        });

        socket.on('contest:progress-update', ({leaderboard: lb, participantProgress: pp, remainingMs}) =>
        {
            setLeaderboard(lb||[]);
            setParticipantProgress(pp||[]);
            if (remainingMs!==undefined)
            {
                setRemainingSec(Math.max(0, Math.round(remainingMs/1000)));
            }
        });

        socket.on('contest:ended', ({leaderboard: lb, stats}) =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setLeaderboard(lb||[]);
            setEndStats(stats);
            setPhase('ended');
        });

        socket.on('contest:error', ({message}) => setError(message));

        return () =>
        {
            if (countdownRef.current) clearInterval(countdownRef.current);
            socket.disconnect();
        };
    }, [contestId, startCountdown]);

    const emit=(event, data={}) => socketRef.current?.emit(event, data);
    const handleStart=() => emit('contest:start', {contestId});
    const handleEnd=() =>
    {
        if (confirm('End contest now? All participants will be stopped.')) emit('contest:end', {contestId});
    };

    const durationSec=(contest?.duration||90)*60;
    const timerPct=durationSec>0? (remainingSec/durationSec)*100:0;
    const timerColor=timerPct>50? '#22c55e':timerPct>20? '#f59e0b':'#ef4444';

    const completedCount=participantProgress.filter(p => p.solvedCount>=totalC).length;

    if (phase==='connecting')
    {
        return (
            <div className="ch-root">
                <div className="ch-spinner">
                    <div className="ch-spin" />
                    <p>Connecting to contest room...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ch-root">
            {/* Header */}
            <header className="ch-header">
                <div className="ch-header-left">
                    <Code2 size={24} className="ch-logo" />
                    <div>
                        <div className="ch-contest-title">{contest?.title||'Contest'}</div>
                        <div className="ch-contest-meta">Code: <strong className="ch-code">{contest?.code}</strong>{contest?.topic&&<> | {contest.topic}</>}</div>
                    </div>
                </div>
                <div className="ch-header-right">
                    {phase==='active'&&(
                        <div className="ch-countdown" style={{color: timerColor}}>
                            <Clock size={18} /> {fmtTime(remainingSec)}
                        </div>
                    )}
                    <span className={`ch-phase-badge ch-phase-${phase}`}>
                        {phase==='waiting'? 'Waiting':phase==='active'? 'Live':'Ended'}
                    </span>
                    {['active', 'waiting'].includes(phase)&&(
                        <button className="ch-btn-danger" onClick={handleEnd}>
                            <Square size={14} /> End
                        </button>
                    )}
                </div>
            </header>

            {error&&<div className="ch-error">{error} <button onClick={() => setError('')}>x</button></div>}

            {/* WAITING ROOM */}
            {phase==='waiting'&&(
                <div className="ch-body">
                    <div className="ch-waiting">
                        <div className="ch-waiting-info">
                            <h2>Waiting Room</h2>
                            <p className="ch-sub">Share this code with participants:</p>
                            <div className="ch-big-code">{contest?.code}</div>
                            <p className="ch-sub">{totalC} problem{totalC!==1? 's':''} | {contest?.duration||90} min duration</p>
                            <p className="ch-sub ch-hint">
                                Participants can join anytime. Contest auto-ends after {contest?.duration||90} minutes.
                            </p>
                            <button className="ch-btn-start" onClick={handleStart}>
                                <Play size={18} /> Start Contest ({contest?.duration||90} min)
                            </button>
                        </div>
                        <div className="ch-participant-list">
                            <h3><Users size={16} /> Participants ({participants.length})</h3>
                            {participants.length===0
                                ? <p className="ch-sub">No participants yet — they can join after you start!</p>
                                :participants.map((p, i) => (
                                    <div className="ch-p-row" key={i}>
                                        <span className="ch-p-rank">#{i+1}</span>
                                        <span className="ch-p-name">{p.name}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIVE */}
            {phase==='active'&&(
                <div className="ch-body">
                    <div className="ch-live-dashboard">
                        <div className="ch-timer-bar">
                            <div className="ch-timer-fill" style={{width: `${timerPct}%`, background: timerColor}} />
                        </div>

                        <div className="ch-stats-row">
                            <div className="ch-stat">
                                <span className="ch-stat-val" style={{color: timerColor}}>{fmtTime(remainingSec)}</span>
                                <span className="ch-stat-lbl">Time Left</span>
                            </div>
                            <div className="ch-stat">
                                <span className="ch-stat-val">{participants.length}</span>
                                <span className="ch-stat-lbl">Participants</span>
                            </div>
                            <div className="ch-stat">
                                <span className="ch-stat-val">{totalC}</span>
                                <span className="ch-stat-lbl">Problems</span>
                            </div>
                            <div className="ch-stat">
                                <span className="ch-stat-val">{completedCount}</span>
                                <span className="ch-stat-lbl">Completed All</span>
                            </div>
                        </div>

                        <div className="ch-live-columns">
                            <div className="ch-sidebar-board">
                                <h3><Trophy size={16} /> Live Leaderboard</h3>
                                {leaderboard.length===0
                                    ? <p className="ch-sub">No submissions yet...</p>
                                    :leaderboard.slice(0, 15).map((p, i) => (
                                        <div className="ch-lb-row" key={i}>
                                            <span className="ch-lb-rank">{i===0? '1st':i===1? '2nd':i===2? '3rd':`#${p.rank}`}</span>
                                            <span className="ch-lb-name">{p.name}</span>
                                            <span className="ch-lb-score">{p.score} pts</span>
                                            <span className="ch-lb-solved">{p.solvedCount}/{totalC}</span>
                                            {p.violations>0&&(
                                                <span className="ch-lb-integrity" style={{color: p.integrityScore>60? '#f59e0b':'#ef4444'}}>
                                                    <AlertTriangle size={12} /> {p.integrityScore}%
                                                </span>
                                            )}
                                        </div>
                                    ))
                                }
                            </div>

                            <div className="ch-progress-panel">
                                <h3><BarChart3 size={16} /> Progress</h3>
                                {participantProgress.length===0
                                    ? <p className="ch-sub">Progress will appear as participants submit...</p>
                                    :participantProgress.map((p, i) =>
                                    {
                                        const pct=totalC>0? Math.round((p.solvedCount/totalC)*100):0;
                                        const done=p.solvedCount>=totalC;
                                        return (
                                            <div className={`ch-prog-row${done? ' done':''}`} key={i}>
                                                <span className="ch-prog-name">{p.name}</span>
                                                <div className="ch-prog-bar-wrap">
                                                    <div className="ch-prog-bar" style={{width: `${pct}%`}} />
                                                </div>
                                                <span className="ch-prog-count">{p.solvedCount}/{totalC}</span>
                                                <span className="ch-prog-score">{p.score} pts</span>
                                                {done&&<CheckCircle size={14} className="ch-prog-done" />}
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
                <div className="ch-body ch-ended">
                    <div className="ch-ended-card">
                        <h2><Trophy size={24} /> Contest Complete!</h2>
                        {endStats&&(
                            <div className="ch-stats-row">
                                <div className="ch-stat">
                                    <span className="ch-stat-val">{endStats.totalParticipants}</span>
                                    <span className="ch-stat-lbl">Participants</span>
                                </div>
                                <div className="ch-stat">
                                    <span className="ch-stat-val">{endStats.totalChallenges}</span>
                                    <span className="ch-stat-lbl">Problems</span>
                                </div>
                                <div className="ch-stat">
                                    <span className="ch-stat-val">{Math.floor((endStats.duration||0)/60)}m</span>
                                    <span className="ch-stat-lbl">Duration</span>
                                </div>
                            </div>
                        )}
                        <div className="ch-podium">
                            {leaderboard.slice(0, 3).map((p, i) => (
                                <div className={`ch-podium-place p${i+1}`} key={i}>
                                    <div className="ch-podium-medal">{i===0? '1st':i===1? '2nd':'3rd'}</div>
                                    <div className="ch-podium-name">{p.name}</div>
                                    <div className="ch-podium-score">{p.score} pts</div>
                                </div>
                            ))}
                        </div>
                        <div className="ch-full-lb">
                            {leaderboard.map((p, i) => (
                                <div className="ch-lb-row" key={i}>
                                    <span className="ch-lb-rank">#{p.rank}</span>
                                    <span className="ch-lb-name">{p.name}</span>
                                    <span className="ch-lb-score">{p.score} pts</span>
                                    <span className="ch-lb-solved">{p.solvedCount}/{totalC} solved</span>
                                </div>
                            ))}
                        </div>
                        <div className="ch-ended-actions">
                            <button className="ch-btn-next" onClick={() => navigate(`/contest/results/${contestId}`)}>
                                <BarChart3 size={16} /> Full Results
                            </button>
                            <button className="ch-btn-secondary" onClick={() => navigate('/contest/dashboard')}>
                                <ChevronRight size={16} /> Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
