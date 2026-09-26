import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {API_BASE_URL} from '../services/api';
import './QuizResults.css';

const API_URL = API_BASE_URL;

export default function QuizResults()
{
    const { quizId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('leaderboard'); // leaderboard | questions

    useEffect(() =>
    {
        async function fetchResults()
        {
            try
            {
                const res = await fetch(`${API_URL}/api/quiz/${quizId}/results`, {
                    credentials: 'include',
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                setData(json);
            } catch (e)
            {
                setError(e.message);
            } finally { setLoading(false); }
        }
        fetchResults();
    }, [quizId]);

    if (loading) return <div className="qr-root"><div className="qr-center qr-spinner">Loading results…</div></div>;
    if (error) return <div className="qr-root"><div className="qr-center qr-error">{error}</div></div>;
    if (!data) return null;

    const { quiz, leaderboard, questionStats } = data;
    const durationMins = quiz.startedAt ? Math.floor((new Date(quiz.endedAt) - new Date(quiz.startedAt)) / 60000) : '?';
    const avgAccuracy = questionStats.length ? Math.round(questionStats.reduce((s, q) => s + q.accuracy, 0) / questionStats.length) : 0;

    return (
        <div className="qr-root">
            {/* Header */}
            <header className="qr-header">
                <div>
                    <h1 className="qr-title">{quiz.title}</h1>
                    <p className="qr-meta">
                        Topic: {quiz.topic} ·
                        Code: <code>{quiz.code}</code> ·
                        {durationMins}m duration
                    </p>
                </div>
                <button className="qr-btn-back" onClick={() => navigate('/quiz/dashboard')}>‹ Dashboard</button>
            </header>

            {/* Summary cards */}
            <div className="qr-summary">
                <div className="qr-stat">
                    <span className="qr-stat-val">{quiz.totalParticipants}</span>
                    <span className="qr-stat-lbl">Players</span>
                </div>
                <div className="qr-stat">
                    <span className="qr-stat-val">{questionStats.length}</span>
                    <span className="qr-stat-lbl">Questions</span>
                </div>
                <div className="qr-stat">
                    <span className="qr-stat-val">{avgAccuracy}%</span>
                    <span className="qr-stat-lbl">Avg Accuracy</span>
                </div>
                <div className="qr-stat">
                    <span className="qr-stat-val">{leaderboard[0]?.score ?? '—'}</span>
                    <span className="qr-stat-lbl">Top Score</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="qr-tabs">
                <button className={`qr-tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
                <button className={`qr-tab ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveTab('questions')}>Questions</button>
            </div>

            {/* LEADERBOARD */}
            {activeTab === 'leaderboard' && (
                <div className="qr-body">
                    {/* Podium for top 3 */}
                    {leaderboard.length >= 1 && (
                        <div className="qr-podium">
                            {[1, 0, 2].map(idx => leaderboard[idx] && (
                                <div className={`qr-podium-spot qr-podium-${idx + 1}`} key={idx}>
                                    <div className="qr-podium-avatar">{leaderboard[idx].name.charAt(0).toUpperCase()}</div>
                                    <div className="qr-podium-medal">#{idx + 1}</div>
                                    <div className="qr-podium-name">{leaderboard[idx].name}</div>
                                    <div className="qr-podium-score">{leaderboard[idx].score} pts</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Full table */}
                    <div className="qr-table-wrap">
                        <table className="qr-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Player</th>
                                    <th>Score</th>
                                    <th>Answered</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((p, i) => (
                                    <tr key={i} className={i < 3 ? 'qr-top3' : ''}>
                                        <td className="qr-td-rank">{i < 3 ? `#${i + 1}` : `#${p.rank}`}</td>
                                        <td className="qr-td-name">{p.name}</td>
                                        <td className="qr-td-score">{p.score}</td>
                                        <td className="qr-td-ans">{p.answers}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* QUESTION STATS */}
            {activeTab === 'questions' && (
                <div className="qr-body">
                    <div className="qr-q-list">
                        {questionStats.map((q, i) => (
                            <div className="qr-q-card" key={i}>
                                <div className="qr-q-num">Q{i + 1}</div>
                                <div className="qr-q-content">
                                    <div className="qr-q-text">{q.text}</div>
                                    <div className="qr-q-answer">
                                        <span className="qr-correct-badge">✓ {q.correctAnswer}</span>
                                        {q.explanation && <span className="qr-explanation"> — {q.explanation}</span>}
                                    </div>
                                    <div className="qr-q-stats">
                                        <div className="qr-q-acc-bar">
                                            <div className="qr-q-acc-fill" style={{ width: `${q.accuracy}%` }} />
                                        </div>
                                        <span className="qr-q-acc-text">
                                            {q.correctCount}/{q.totalAnswered} correct ({q.accuracy}%)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
