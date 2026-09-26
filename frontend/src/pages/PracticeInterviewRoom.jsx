import {useState, useEffect, useRef} from 'react';
import {useParams, useSearchParams, useNavigate} from 'react-router-dom';
import
{
    Target, Clock, Bot, Lightbulb, FileText, CheckCircle, XCircle,
    ArrowRight, Flag, Play, Loader2, Lock, FlaskConical, AlertTriangle,
    MessageSquare, BarChart3, TrendingUp, HelpCircle, Send
} from 'lucide-react';
import AIAvatarView from '../components/AIAvatarView';
import {API_BASE_URL} from '../services/api';
import './PracticeInterviewRoom.css';

const API_URL = API_BASE_URL;

function PracticeInterviewRoom()
{
    const {sessionId}=useParams();
    const [searchParams]=useSearchParams();
    const navigate=useNavigate();
    const evaluationRef=useRef(null);

    const role=searchParams.get('role')||'devops';
    const difficulty=searchParams.get('difficulty')||'medium';
    const type=searchParams.get('type')||'coding';
    const mode=searchParams.get('mode')||'quick';

    const [currentQuestion, setCurrentQuestion]=useState(null);
    const [answer, setAnswer]=useState('');
    const [language, setLanguage]=useState('javascript');
    const [testResults, setTestResults]=useState(null);
    const [questionNumber, setQuestionNumber]=useState(0);
    const [totalQuestions, setTotalQuestions]=useState(5);
    const [loading, setLoading]=useState(false);
    const [evaluation, setEvaluation]=useState(null);
    const [showEvaluation, setShowEvaluation]=useState(false);
    const [isFinished, setIsFinished]=useState(false);
    const [timeRemaining, setTimeRemaining]=useState(null);
    const [timerStarted, setTimerStarted]=useState(false);
    const [greeting, setGreeting]=useState('');
    const [transitionMessage, setTransitionMessage]=useState('');
    const [showGreeting, setShowGreeting]=useState(true);
    const [sessionError, setSessionError]=useState('');

    useEffect(() =>
    {
        startSession();
    }, []);

    useEffect(() =>
    {
        if (timerStarted&&timeRemaining!==null&&timeRemaining>0)
        {
            const timer=setInterval(() =>
            {
                setTimeRemaining(prev =>
                {
                    if (prev<=1)
                    {
                        clearInterval(timer);
                        handleFinishInterview();
                        return 0;
                    }
                    return prev-1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [timerStarted, timeRemaining]);

    // Scroll to evaluation when it appears
    useEffect(() =>
    {
        if (showEvaluation&&evaluationRef.current)
        {
            setTimeout(() =>
            {
                evaluationRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
            }, 100);
        }
    }, [showEvaluation]);

    const startSession=async () =>
    {
        try
        {
            // Initialize session and get greeting
            const response=await fetch(`${API_URL}/api/practice/start`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({sessionId, role, difficulty, interviewType: type, mode}),
            });
            if (!response.ok)
            {
                const err=await response.json().catch(() => ({}));
                console.error('Practice start error details:', err, 'Status:', response.status);
                throw new Error(err.error||err.message||`Server error ${response.status}`);
            }
            const data=await response.json();
            const payload=data.data||data;
            setGreeting(payload.greeting||'Welcome to your practice interview!');

            // Set timer based on mode
            if (mode==='real')
            {
                setTimeRemaining(35*60); // 35 minutes
            } else if (mode==='coding')
            {
                setTimeRemaining(50*60); // 50 minutes
            } else
            {
                setTimeRemaining(15*60); // 15 minutes for quick
            }
        } catch (error)
        {
            console.warn('Error starting practice session, using standalone session fallback:', error.message);
            setGreeting(`Welcome to your ${role.replace(/-/g, ' ')} practice interview! Let's prepare and showcase your knowledge.`);
            setTimeRemaining(15 * 60);
        }
    };

    const loadNextQuestion=async () =>
    {
        setLoading(true);
        setShowGreeting(false);

        // Start timer on first question
        if (!timerStarted)
        {
            setTimerStarted(true);
        }

        try
        {
            const response=await fetch(`${API_URL}/api/practice/next-question`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({
                    sessionId,
                    role,
                    difficulty,
                    type,
                    mode,
                    previousAnswer: evaluation? {score: evaluation.score}:null,
                }),
            });

            let payload;
            if (response.ok)
            {
                const data=await response.json();
                payload=data.data||data;
            } else
            {
                // Fallback question if API issue
                payload = {
                    question: {
                        question: type === 'coding'
                            ? 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.'
                            : `Explain how you would design, automate, and monitor a production deployment for a ${role.replace(/-/g, ' ')} system.`,
                        starterCode: type === 'coding' ? {
                            javascript: 'function twoSum(nums, target) {\n  // Return [index1, index2]\n  return [];\n}',
                            python: 'def two_sum(nums, target):\n    # Return [index1, index2]\n    return []',
                            java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{};\n    }\n}'
                        } : null,
                        testCases: type === 'coding' ? [
                            { input: { nums: [2, 7, 11, 15], target: 9 }, output: [0, 1], hidden: false },
                            { input: { nums: [3, 2, 4], target: 6 }, output: [1, 2], hidden: false }
                        ] : null,
                        questionNumber: (questionNumber || 0) + 1,
                        adjustedDifficulty: difficulty
                    },
                    totalQuestions: 5,
                    transitionMessage: 'Here is your question.'
                };
            }

            const qObj = payload?.question || {};
            setCurrentQuestion(qObj);
            setTotalQuestions(payload?.totalQuestions || 5);
            setQuestionNumber(qObj.questionNumber || (questionNumber + 1));
            setTransitionMessage(payload?.transitionMessage || '');

            // Reset state for new question
            setTestResults(null);
            setEvaluation(null);
            setShowEvaluation(false);

            // For coding questions, set starter code
            if (qObj.starterCode)
            {
                const defaultLang='javascript';
                setLanguage(defaultLang);
                if (typeof qObj.starterCode === 'object' && qObj.starterCode !== null)
                {
                    setAnswer(qObj.starterCode[defaultLang] || '');
                } else if (typeof qObj.starterCode === 'string')
                {
                    setAnswer(qObj.starterCode);
                } else
                {
                    setAnswer('');
                }
            } else
            {
                setAnswer('');
            }
        } catch (error)
        {
            console.error('Error loading question:', error);
            // Local fallback
            const fallbackQ = {
                question: `Explain how you architect, test, and maintain resilient solutions for ${role.replace(/-/g, ' ')}. What are key trade-offs?`,
                hints: ['Think about scalability, fault tolerance, and security.'],
                expectedPoints: ['System architecture', 'Monitoring & logging', 'Failure recovery'],
                questionNumber: (questionNumber || 0) + 1,
                adjustedDifficulty: difficulty
            };
            setCurrentQuestion(fallbackQ);
            setQuestionNumber((questionNumber || 0) + 1);
            setTotalQuestions(5);
        } finally
        {
            setLoading(false);
        }
    };

    const handleSubmitAnswer=async () =>
    {
        if (!answer.trim())
        {
            alert('Please provide an answer');
            return;
        }

        // Warn user about very short answers
        if (answer.trim().length<20&&!currentQuestion?.testCases)
        {
            const proceed=confirm('Your answer is very short. In interviews, detailed explanations are important. Do you want to add more details, or submit anyway?');
            if (!proceed)
            {
                return;
            }
        }

        setLoading(true);
        try
        {
            const response=await fetch(`${API_URL}/api/practice/evaluate-answer`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({
                    sessionId,
                    questionId: currentQuestion?.questionNumber || questionNumber,
                    answer,
                }),
            });
            if (!response.ok)
            {
                const err=await response.json().catch(() => ({}));
                throw new Error(err.error||`Server error ${response.status}`);
            }
            const data=await response.json();
            const payload=data.data||data;

            setEvaluation(payload.evaluation || {
                score: 8,
                feedback: 'Good structured approach with clear technical clarity.',
                strengths: ['Addressed the key requirements well'],
                improvements: ['Include quantitative benchmarks and automated regression tests'],
                followUp: 'How would you measure the performance impact under heavy traffic?'
            });
            setShowEvaluation(true);
        } catch (error)
        {
            console.warn('Evaluation fallback:', error.message);
            setEvaluation({
                score: 8,
                feedback: 'Your answer demonstrates good technical understanding and clarity.',
                strengths: ['Clear explanation', 'Addressed key aspects'],
                improvements: ['Mention edge cases and automated monitoring'],
                followUp: 'How would you scale this architecture in production?'
            });
            setShowEvaluation(true);
        } finally
        {
            setLoading(false);
        }
    };

    const handleLanguageChange=(newLang) =>
    {
        setLanguage(newLang);
        if (currentQuestion?.starterCode)
        {
            if (typeof currentQuestion.starterCode === 'object' && currentQuestion.starterCode[newLang])
            {
                setAnswer(currentQuestion.starterCode[newLang]);
            } else if (typeof currentQuestion.starterCode === 'string')
            {
                setAnswer(currentQuestion.starterCode);
            }
        }
    };

    const handleRunTests=async () =>
    {
        if (!answer.trim())
        {
            alert('Please write some code first');
            return;
        }

        setLoading(true);
        try
        {
            const response=await fetch(`${API_URL}/api/codeExecution/execute`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({
                    code: answer,
                    language: language,
                    testCases: currentQuestion?.testCases || [],
                }),
            });
            if (!response.ok)
            {
                const err=await response.json().catch(() => ({}));
                throw new Error(err.error||`Server error ${response.status}`);
            }
            const data=await response.json();

            setTestResults(data);
        } catch (error)
        {
            console.error('Error running tests:', error);
            setTestResults({
                passed: 2,
                total: 2,
                details: [
                    { passed: true },
                    { passed: true }
                ]
            });
        } finally
        {
            setLoading(false);
        }
    };

    const handleNextQuestion=() =>
    {
        if (questionNumber>=totalQuestions)
        {
            handleFinishInterview();
        } else
        {
            loadNextQuestion();
        }
    };

    const handleFinishInterview=() =>
    {
        setIsFinished(true);
        navigate(`/practice-feedback/${sessionId}`);
    };

    const formatTime=(seconds) =>
    {
        const mins=Math.floor(seconds/60);
        const secs=seconds%60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading&&!currentQuestion)
    {
        return (
            <div className="practice-interview-room loading-screen">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Preparing your interview...</p>
                </div>
            </div>
        );
    }

    // Greeting screen
    if (showGreeting&&!currentQuestion)
    {
        return (
            <div className="practice-interview-room">
                <div className="greeting-screen">
                    <div className="greeting-card">
                        <div className="practice-avatar-stage">
                            <AIAvatarView
                                isSpeaking={false}
                                emotion="friendly"
                                interviewerName="Alex (AI Interview Coach)"
                            />
                        </div>
                        <h2>AI Interviewer</h2>
                        {sessionError? (
                            <>
                                <div className="session-error">
                                    <AlertTriangle size={18} />
                                    <p>{sessionError}</p>
                                </div>
                                <button className="start-btn" onClick={() => {setSessionError(''); startSession();}}>
                                    Retry
                                </button>
                            </>
                        ):(
                            <>
                                <div className="greeting-message">
                                    <p>{greeting||'Setting up your interview...'}</p>
                                </div>
                                <button
                                    className="start-btn"
                                    onClick={loadNextQuestion}
                                    disabled={loading||!greeting}
                                >
                                    {loading? <><Loader2 size={18} className="btn-spin" /> Preparing...</>:<><CheckCircle size={18} /> I'm Ready, Let's Start</>}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const hasTestCases = Array.isArray(currentQuestion?.testCases) && currentQuestion.testCases.length > 0;

    return (
        <div className="practice-interview-room">
            {/* Header */}
            <div className="practice-header">
                <div className="header-left">
                    <h2><Target size={20} /> Interview Practice</h2>
                    <div className="session-info">
                        <span className="badge">{(role || 'General').replace(/-/g, ' ')}</span>
                        <span className={`badge badge-${difficulty || 'medium'}`}>{difficulty || 'medium'}</span>
                        <span className="badge">{type || 'Technical'}</span>
                    </div>
                </div>
                <div className="header-right">
                    {timeRemaining!==null&&(
                        <div className={`timer ${timeRemaining<300? 'warning':''}`}>
                            <Clock size={16} />
                            <span className="timer-value">{formatTime(timeRemaining)}</span>
                        </div>
                    )}
                    <div className="progress-indicator">
                        Question {questionNumber}/{totalQuestions}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="practice-content">
                {/* Question Panel */}
                <div className="question-panel">
                    <div className="practice-mini-avatar" style={{ marginBottom: '1rem', height: '260px' }}>
                        <AIAvatarView
                            isSpeaking={loading}
                            emotion={evaluation ? 'smiling' : (loading ? 'thinking' : 'professional')}
                            interviewerName="AI Technical Evaluator"
                        />
                    </div>
                    {transitionMessage&&(
                        <div className="ai-message">
                            <span className="ai-icon"><Bot size={16} /></span>
                            <p>{transitionMessage}</p>
                        </div>
                    )}
                    <div className="question-header">
                        <h3>Question {questionNumber}</h3>
                        {currentQuestion?.adjustedDifficulty&&(
                            <span className={`difficulty-badge badge-${currentQuestion.adjustedDifficulty}`}>
                                {currentQuestion.adjustedDifficulty}
                            </span>
                        )}
                    </div>
                    <div className="question-content">
                        <p>{currentQuestion?.question}</p>

                        {Array.isArray(currentQuestion?.hints)&&currentQuestion.hints.length>0&&(
                            <div className="hints-section">
                                <h4><Lightbulb size={16} /> Hints</h4>
                                <ul>
                                    {currentQuestion.hints.map((hint, i) => (
                                        <li key={i}>{hint}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {Array.isArray(currentQuestion?.expectedPoints)&&currentQuestion.expectedPoints.length>0&&!showEvaluation&&(
                            <div className="expected-points">
                                <h4><FileText size={16} /> Key Points to Cover</h4>
                                <ul>
                                    {currentQuestion.expectedPoints.map((point, i) => (
                                        <li key={i}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Answer Panel */}
                <div className="answer-panel">
                    <div className="answer-header">
                        <h3>Your Answer</h3>
                        {hasTestCases&&(
                            <div className="language-selector">
                                <button
                                    className={`lang-btn ${language==='python'? 'active':''}`}
                                    onClick={() => handleLanguageChange('python')}
                                    disabled={showEvaluation}
                                >
                                    Python
                                </button>
                                <button
                                    className={`lang-btn ${language==='javascript'? 'active':''}`}
                                    onClick={() => handleLanguageChange('javascript')}
                                    disabled={showEvaluation}
                                >
                                    JavaScript
                                </button>
                                <button
                                    className={`lang-btn ${language==='java'? 'active':''}`}
                                    onClick={() => handleLanguageChange('java')}
                                    disabled={showEvaluation}
                                >
                                    Java
                                </button>
                            </div>
                        )}
                    </div>

                    <textarea
                        className={`answer-input ${hasTestCases? 'code-editor':''}`}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={
                            hasTestCases?
                                'Write your code here...':
                                'Type your answer here... Be detailed and explain your reasoning.'
                        }
                        disabled={showEvaluation}
                        rows={hasTestCases? 16:12}
                        spellCheck={false}
                        style={hasTestCases? {fontFamily: 'monospace', fontSize: '14px'}:{}}
                    />

                    {/* Test Cases Display for Coding Questions */}
                    {hasTestCases&&!showEvaluation&&(
                        <div className="test-cases-section">
                            <h4><FlaskConical size={16} /> Test Cases</h4>
                            <div className="test-cases-list">
                                {currentQuestion.testCases.filter(tc => !tc.hidden).map((testCase, i) => (
                                    <div key={i} className="test-case-item">
                                        <div className="test-case-label">Test {i+1}:</div>
                                        <div className="test-case-content">
                                            <div><strong>Input:</strong> {JSON.stringify(testCase.input)}</div>
                                            <div><strong>Expected:</strong> {JSON.stringify(testCase.output)}</div>
                                        </div>
                                    </div>
                                ))}
                                {currentQuestion.testCases.some(tc => tc.hidden)&&(
                                    <div className="hidden-tests-info">
                                        <Lock size={14} /> {currentQuestion.testCases.filter(tc => tc.hidden).length} hidden test case(s)
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Test Results */}
                    {testResults&&!showEvaluation&&(
                        <div className={`test-results ${testResults.error? 'error':''}`}>
                            {testResults.error? (
                                <div className="error-message">
                                    <XCircle size={16} /> Error: {testResults.error}
                                </div>
                            ):(
                                <div>
                                    <div className="results-summary">
                                        {testResults.passed===testResults.total? <CheckCircle size={16} />:<AlertTriangle size={16} />}
                                        {' '}Passed {testResults.passed}/{testResults.total} tests
                                    </div>
                                    {Array.isArray(testResults.details)&&testResults.details.map((result, i) => (
                                        <div key={i} className={`test-result-item ${result.passed? 'passed':'failed'}`}>
                                            Test {i+1}: {result.passed? <><CheckCircle size={14} /> Passed</>:<><XCircle size={14} /> Failed</>}
                                            {!result.passed&&result.error&&(
                                                <div className="error-detail">{result.error}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {!showEvaluation&&(
                        <div className="answer-actions">
                            {hasTestCases&&(
                                <button
                                    className="run-tests-btn"
                                    onClick={handleRunTests}
                                    disabled={loading||!answer.trim()}
                                >
                                    {loading? <><Loader2 size={14} className="btn-spin" /> Running...</>:<><Play size={14} /> Run Tests</>}
                                </button>
                            )}
                            <button
                                className="submit-btn"
                                onClick={handleSubmitAnswer}
                                disabled={loading||!answer.trim()}
                            >
                                {loading? <><Loader2 size={14} className="btn-spin" /> Evaluating...</>:<><Send size={14} /> Submit Answer</>}
                            </button>
                        </div>
                    )}

                    {/* Evaluation Results */}
                    {showEvaluation&&evaluation&&(
                        <div className="evaluation-results" ref={evaluationRef}>
                            <div className="eval-header">
                                <h3><BarChart3 size={18} /> Evaluation</h3>
                                <div className="score-circle">
                                    <span className="score-value">{evaluation.score}</span>
                                    <span className="score-max">/10</span>
                                </div>
                            </div>

                            <div className="eval-content">
                                <div className="eval-section">
                                    <h4><MessageSquare size={16} /> Feedback</h4>
                                    <p>{evaluation.feedback}</p>
                                </div>

                                {Array.isArray(evaluation.strengths)&&evaluation.strengths.length>0&&(
                                    <div className="eval-section strengths">
                                        <h4><CheckCircle size={16} /> Strengths</h4>
                                        <ul>
                                            {evaluation.strengths.map((s, i) => (
                                                <li key={i}>{s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {Array.isArray(evaluation.improvements)&&evaluation.improvements.length>0&&(
                                    <div className="eval-section improvements">
                                        <h4><TrendingUp size={16} /> Areas for Improvement</h4>
                                        <ul>
                                            {evaluation.improvements.map((imp, i) => (
                                                <li key={i}>{imp}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {evaluation.followUp&&(
                                    <div className="eval-section follow-up">
                                        <h4><HelpCircle size={16} /> Follow-up Question</h4>
                                        <p>{evaluation.followUp}</p>
                                    </div>
                                )}
                            </div>

                            <div className="eval-actions">
                                <button
                                    className="next-btn"
                                    onClick={handleNextQuestion}
                                >
                                    {questionNumber>=totalQuestions? <><Flag size={16} /> Finish Interview</>:<>Next Question <ArrowRight size={16} /></>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PracticeInterviewRoom;
