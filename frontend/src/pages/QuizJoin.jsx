import {useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {API_BASE_URL} from '../services/api';
import './QuizJoin.css';

const API_URL = API_BASE_URL;

export default function QuizJoin()
{
    const navigate=useNavigate();
    const [searchParams]=useSearchParams();
    const [code, setCode]=useState(searchParams.get('code')||'');
    const [name, setName]=useState('');
    const [loading, setLoading]=useState(false);
    const [error, setError]=useState('');
    const [quizInfo, setQuizInfo]=useState(null);

    const handleLookup=async (e) =>
    {
        e.preventDefault();
        if (!code.trim()) return setError('Enter a room code');
        setError('');
        setLoading(true);
        try
        {
            const res=await fetch(`${API_URL}/api/quiz/room/${code.trim().toUpperCase()}`, {
                credentials: 'include',
            });
            const data=await res.json();
            if (!data.success) throw new Error(data.error);
            setQuizInfo(data.quiz);
        } catch (e)
        {
            setError(e.message);
        } finally {setLoading(false);}
    };

    const handleJoin=(e) =>
    {
        e.preventDefault();
        if (!name.trim()) return setError('Enter your name');
        navigate(`/quiz/play?code=${code.trim().toUpperCase()}&name=${encodeURIComponent(name.trim())}`);
    };

    return (
        <div className="qj-root">
            <div className="qj-card">
                <div className="qj-logo"><span style={{display: 'inline-block', width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--accent-primary, #FF6B35)'}} /></div>
                <h1 className="qj-title">Join Quiz</h1>

                {error&&<div className="qj-error">{error}</div>}

                {!quizInfo
                    ? (
                        <form className="qj-form" onSubmit={handleLookup}>
                            <input
                                className="qj-code-input"
                                value={code}
                                onChange={e => setCode(e.target.value.toUpperCase())}
                                placeholder="ROOM CODE"
                                maxLength={6}
                                autoFocus
                            />
                            <button className="qj-btn" type="submit" disabled={loading}>
                                {loading? 'Checking…':'Find Quiz →'}
                            </button>
                        </form>
                    )
                    :(
                        <div className="qj-found">
                            <div className="qj-quiz-info">
                                <div className="qj-quiz-title">{quizInfo.title}</div>
                                <div className="qj-quiz-meta">
                                    <span className={`qj-diff qj-diff-${quizInfo.difficulty}`}>{quizInfo.difficulty}</span>
                                    <span>{quizInfo.questionCount} questions</span>
                                    <span>Host: {quizInfo.hostName}</span>
                                </div>
                            </div>
                            <form className="qj-form" onSubmit={handleJoin}>
                                <input
                                    className="qj-name-input"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Your name"
                                    maxLength={30}
                                    autoFocus
                                />
                                <button className="qj-btn" type="submit">Join Now</button>
                                <button className="qj-btn-secondary" type="button" onClick={() => {setQuizInfo(null); setCode('');}}>
                                    ‹ Different code
                                </button>
                            </form>
                        </div>
                    )
                }

                <p className="qj-hint">Ask the quiz host for the room code</p>
            </div>
        </div>
    );
}
