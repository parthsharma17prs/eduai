import {useState, useEffect} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {Code2, Trophy, Users, Clock, BarChart3, ChevronLeft, CheckCircle, XCircle, Award} from 'lucide-react';
import {API_BASE_URL} from '../services/api';
import './ContestResults.css';

const API_URL = API_BASE_URL;

const DIFFICULTY_COLORS={easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444'};

export default function ContestResults()
{
    const {contestId}=useParams();
    const navigate=useNavigate();
    const [loading, setLoading]=useState(true);
    const [error, setError]=useState('');
    const [data, setData]=useState(null);

    useEffect(() =>
    {
        fetchResults();
    }, [contestId]);

    const fetchResults=async () =>
    {
        try
        {
            setLoading(true);
            const res=await fetch(`${API_URL}/api/contest/${contestId}/results`, {
                credentials: 'include',
            });
            const json=await res.json();
            if (!json.success) throw new Error(json.error);
            setData(json);
        } catch (e)
        {
            setError(e.message);
        } finally
        {
            setLoading(false);
        }
    };

    if (loading)
    {
        return (
            <div className="cr-root">
                <div className="cr-spinner">
                    <div className="cr-spin" />
                    <p>Loading results...</p>
                </div>
            </div>
        );
    }

    if (error)
    {
        return (
            <div className="cr-root">
                <div className="cr-error">
                    <p>{error}</p>
                    <button onClick={() => navigate('/contest/dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    const {contest, leaderboard, challengeStats}=data||{};

    return (
        <div className="cr-root">
            <header className="cr-header">
                <button className="cr-back" onClick={() => navigate('/contest/dashboard')}>
                    <ChevronLeft size={18} /> Back
                </button>
                <div className="cr-header-info">
                    <h1><Code2 size={24} /> {contest?.title}</h1>
                    <p>{contest?.topic} | #{contest?.code}</p>
                </div>
            </header>

            <main className="cr-main">
                {/* Stats */}
                <div className="cr-stats">
                    <div className="cr-stat">
                        <Users size={20} />
                        <span className="cr-stat-val">{contest?.totalParticipants}</span>
                        <span className="cr-stat-lbl">Participants</span>
                    </div>
                    <div className="cr-stat">
                        <Code2 size={20} />
                        <span className="cr-stat-val">{challengeStats?.length}</span>
                        <span className="cr-stat-lbl">Problems</span>
                    </div>
                    <div className="cr-stat">
                        <Clock size={20} />
                        <span className="cr-stat-val">
                            {contest?.startedAt&&contest?.endedAt
                                ? `${Math.round((new Date(contest.endedAt)-new Date(contest.startedAt))/60000)}m`
                                :'-'}
                        </span>
                        <span className="cr-stat-lbl">Duration</span>
                    </div>
                </div>

                <div className="cr-content">
                    {/* Leaderboard */}
                    <section className="cr-section cr-leaderboard-section">
                        <h2><Trophy size={18} /> Final Leaderboard</h2>
                        <div className="cr-podium">
                            {leaderboard?.slice(0, 3).map((p, i) => (
                                <div key={i} className={`cr-podium-place p${i+1}`}>
                                    <Award size={32} className="cr-medal" />
                                    <div className="cr-podium-rank">{i===0? '1st':i===1? '2nd':'3rd'}</div>
                                    <div className="cr-podium-name">{p.name}</div>
                                    <div className="cr-podium-score">{p.score} pts</div>
                                    <div className="cr-podium-solved">{p.solvedCount} solved</div>
                                </div>
                            ))}
                        </div>
                        <div className="cr-full-lb">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Name</th>
                                        <th>Score</th>
                                        <th>Solved</th>
                                        <th>Submissions</th>
                                        <th>Integrity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard?.map((p, i) => (
                                        <tr key={i} className={i<3? `top-${i+1}`:''}>
                                            <td>#{p.rank}</td>
                                            <td>{p.name}</td>
                                            <td className="cr-score">{p.score} pts</td>
                                            <td>{p.solvedCount}</td>
                                            <td>{p.submissions}</td>
                                            <td>
                                                {p.integrityScore<100? (
                                                    <span className={`cr-integrity ${p.integrityScore<70? 'low':'medium'}`}>
                                                        {p.integrityScore}%
                                                    </span>
                                                ):(
                                                    <span className="cr-integrity good">100%</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Problem Stats */}
                    <section className="cr-section cr-problems-section">
                        <h2><BarChart3 size={18} /> Problem Statistics</h2>
                        <div className="cr-problems-grid">
                            {challengeStats?.map((c, i) => (
                                <div key={i} className="cr-problem-card">
                                    <div className="cr-problem-header">
                                        <span className="cr-problem-num">#{i+1}</span>
                                        <span className="cr-problem-title">{c.title}</span>
                                        <span className="cr-problem-difficulty" style={{color: DIFFICULTY_COLORS[c.difficulty]}}>
                                            {c.difficulty}
                                        </span>
                                    </div>
                                    <div className="cr-problem-stats">
                                        <div className="cr-problem-stat">
                                            <span className="cr-problem-stat-val">{c.points}</span>
                                            <span className="cr-problem-stat-lbl">Points</span>
                                        </div>
                                        <div className="cr-problem-stat">
                                            <span className="cr-problem-stat-val">{c.totalSubmissions}</span>
                                            <span className="cr-problem-stat-lbl">Submissions</span>
                                        </div>
                                        <div className="cr-problem-stat">
                                            <span className="cr-problem-stat-val">{c.solvedCount}</span>
                                            <span className="cr-problem-stat-lbl">Solved</span>
                                        </div>
                                        <div className="cr-problem-stat">
                                            <span className="cr-problem-stat-val cr-solve-rate">{c.solveRate}%</span>
                                            <span className="cr-problem-stat-lbl">Solve Rate</span>
                                        </div>
                                    </div>
                                    <div className="cr-solve-bar">
                                        <div className="cr-solve-fill" style={{width: `${c.solveRate}%`}} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
