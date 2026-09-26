import {useState, useEffect, useRef, useCallback} from 'react';
import {useParams, useSearchParams, useNavigate} from 'react-router-dom';
import socketService from '../services/socket';
import proctoringService from '../services/proctoring';
import {getInterview, createInterview, getQuestion, executeCode, submitCode, endInterview, API_BASE_URL} from '../services/api';
import CodeEditor from '../components/CodeEditor';
import VideoPanel from '../components/VideoPanel';
import ProctoringMonitor from '../components/ProctoringMonitor';
import SecondaryCamera from '../components/SecondaryCamera';
import ChatPanel from '../components/ChatPanel';
import QuestionPanel from '../components/QuestionPanel';
import QuestionSelector from '../components/QuestionSelector';
import {Target as TargetIcon, FileText as DocumentIcon, Lock as LockIcon, MessageCircle as ChatIcon, AlertCircle as AlertIcon, FlaskConical as BeakerIcon, Play as PlayIcon, Check as CheckIcon, LogOut as EndIcon, Star as StarIcon, ThumbsUp as ThumbsUpIcon, ThumbsDown as ThumbsDownIcon, HelpCircle as MaybeIcon} from 'lucide-react';
import './InterviewRoom.css';

function InterviewRoom()
{
    const {interviewId}=useParams();
    const [searchParams]=useSearchParams();
    const navigate=useNavigate();
    const mode=searchParams.get('mode');
    const userName=searchParams.get('name');
    const role=searchParams.get('role');

    const [interview, setInterview]=useState(null);
    const [currentQuestion, setCurrentQuestion]=useState(null);
    const [showQuestionSelector, setShowQuestionSelector]=useState(false);
    const [code, setCode]=useState('');
    const [language, setLanguage]=useState('javascript');
    const [output, setOutput]=useState('');
    const [loading, setLoading]=useState(false);
    const [showChat, setShowChat]=useState(false);
    const [proctoringEvents, setProctoringEvents]=useState([]);
    const [suspicionScore, setSuspicionScore]=useState(0);
    const [integrityScore, setIntegrityScore]=useState(100);
    const [securityAlert, setSecurityAlert]=useState(null);
    const [showSecurityNotice, setShowSecurityNotice]=useState(false);
    const [showEndConfirm, setShowEndConfirm]=useState(false);
    const [secondaryCamSnapshot, setSecondaryCamSnapshot]=useState(null);
    const [interviewStarted, setInterviewStarted]=useState(false);
    const [isScreenShareActive, setIsScreenShareActive]=useState(false);
    const [needsFullscreenPrompt, setNeedsFullscreenPrompt]=useState(false);
    const [secondaryCamActive, setSecondaryCamActive]=useState(false);
    // Recruiter scoring state (all out of 10)
    const [recruiterScores, setRecruiterScores]=useState({
        technical: 0,
        problemSolving: 0,
        communication: 0,
        domain: 0,
        aptitude: 0,
        overallScore: 0,
    });
    const [recruiterFeedback, setRecruiterFeedback]=useState('');
    const [recruiterNotes, setRecruiterNotes]=useState('');
    const [hiringDecision, setHiringDecision]=useState('');
    const videoRef=useRef(null);
    // Ref to track latest language for use inside socket callbacks (avoids stale closure)
    const languageRef=useRef(language);
    // Debounce timer ref for code updates
    const codeUpdateTimerRef=useRef(null);
    // Flag to prevent echo loops when receiving remote code updates
    const isRemoteUpdateRef=useRef(false);

    // Keep languageRef in sync with language state
    useEffect(() =>
    {
        languageRef.current=language;
    }, [language]);

    useEffect(() =>
    {
        // Load interview
        loadInterview();

        // Connect socket
        const socket=socketService.connect();
        socketService.joinInterview(interviewId, userName, role);

        // Listen for code updates from other participants
        const handleCodeUpdate=(data) =>
        {
            isRemoteUpdateRef.current=true;
            setCode(data.code);
            if (data.language)
            {
                setLanguage(data.language);
                languageRef.current=data.language;
            }
            // Reset flag after React processes the update
            setTimeout(() => {isRemoteUpdateRef.current=false;}, 50);
        };

        // Listen for language changes from other participants
        const handleLanguageUpdate=(data) =>
        {
            if (data.language)
            {
                setLanguage(data.language);
                languageRef.current=data.language;
            }
            if (data.code!==undefined)
            {
                isRemoteUpdateRef.current=true;
                setCode(data.code);
                setTimeout(() => {isRemoteUpdateRef.current=false;}, 50);
            }
        };

        // Listen for output updates (when other participant runs code)
        const handleOutputUpdate=(data) =>
        {
            if (data.output!==undefined) setOutput(data.output);
        };

        // Listen for question updates (from interviewer)
        // Uses languageRef to avoid stale closure on `language`
        const handleQuestionUpdate=(data) =>
        {
            if (data.question)
            {
                setCurrentQuestion(data.question);
                setCode(data.question.starterCode?.[languageRef.current]||'');
            }
        };

        // Listen for proctoring alerts
        const handleProctoringAlert=(data) =>
        {
            if (!data.event) return;
            setProctoringEvents(prev => [...prev, data.event]);

            const scoreImpact={
                low: 5,
                medium: 10,
                high: 20,
                critical: 30,
            };

            setSuspicionScore(prev =>
            {
                const newScore=Math.min(100, prev+(scoreImpact[data.event.severity]||10));
                setIntegrityScore(Math.max(0, 100-newScore));
                return newScore;
            });

            handleShowSecurityAlert(data.event);
        };

        // Listen for secondary camera snapshots (recruiter sees candidate's 2nd cam)
        const handleSecondarySnapshot=(data) =>
        {
            if (data&&data.snapshot)
            {
                setSecondaryCamSnapshot(data.snapshot);
                setSecondaryCamActive(true);
            }
        };

        // Listen for secondary camera disconnect (phone closed/disconnected)
        const handleSecondaryCamDisconnected=(data) =>
        {
            console.log('[Interview] Secondary camera disconnected:', data?.reason);
            setSecondaryCamSnapshot(null);
            setSecondaryCamActive(false);
        };

        // Listen for interview start (recruiter controls when interview begins)
        const handleInterviewStarted=() =>
        {
            console.log('[Interview] Interview started by recruiter');
            setInterviewStarted(true);
            // Show fullscreen prompt — requires a user gesture (click) to enter fullscreen
            setNeedsFullscreenPrompt(true);
        };

        // Listen for interview end (recruiter ended the interview)
        const handleInterviewEnded=(data) =>
        {
            console.log('[Interview] Interview ended by recruiter');
            proctoringService.stopMonitoring();
            // Navigate candidate to report page
            navigate(`/interview-report/${interviewId}?role=${role}`);
        };

        socket.on('code-update', handleCodeUpdate);
        socket.on('language-update', handleLanguageUpdate);
        socket.on('output-update', handleOutputUpdate);
        socket.on('question-update', handleQuestionUpdate);
        socket.on('proctoring-alert', handleProctoringAlert);
        socket.on('secondary-snapshot', handleSecondarySnapshot);
        socket.on('secondary-camera-disconnected', handleSecondaryCamDisconnected);
        socket.on('interview-started', handleInterviewStarted);
        socket.on('interview-ended', handleInterviewEnded);

        // Ensure we re-join the room on socket reconnection
        const handleReconnect=() =>
        {
            console.log('[Interview] Socket reconnected, re-joining interview room...');
            socketService.joinInterview(interviewId, userName, role);
        };
        socket.on('reconnect', handleReconnect);

        // Show non-blocking security notice for candidates
        if (role==='candidate')
        {
            setTimeout(() => setShowSecurityNotice(true), 1000);
        }

        return () =>
        {
            // Clean up socket listeners to avoid memory leaks
            socket.off('code-update', handleCodeUpdate);
            socket.off('language-update', handleLanguageUpdate);
            socket.off('output-update', handleOutputUpdate);
            socket.off('question-update', handleQuestionUpdate);
            socket.off('proctoring-alert', handleProctoringAlert);
            socket.off('secondary-snapshot', handleSecondarySnapshot);
            socket.off('secondary-camera-disconnected', handleSecondaryCamDisconnected);
            socket.off('interview-started', handleInterviewStarted);
            socket.off('interview-ended', handleInterviewEnded);
            socket.off('reconnect', handleReconnect);
            socketService.leaveInterview(interviewId);
            proctoringService.stopMonitoring();
            // Clear any pending debounce timer
            if (codeUpdateTimerRef.current)
            {
                clearTimeout(codeUpdateTimerRef.current);
            }
        };
    }, [interviewId, userName, role]);

    const loadInterview=async () =>
    {
        try
        {
            let response;
            try
            {
                response=await getInterview(interviewId);
            } catch (fetchErr)
            {
                // If interview not found (Quick Join flow), auto-create it
                if (fetchErr?.response?.status===404)
                {
                    console.log('Interview not found, auto-creating...');
                    response=await createInterview({
                        candidateName: role==='recruiter'? 'Pending Candidate':(userName||'Anonymous'),
                        role: 'Software Engineer',
                        experience: 'entry',
                        topics: [],
                        duration: 30,
                        notes: `Auto-created via ${role==='recruiter'? 'Recruiter':'Quick Join'} (code: ${interviewId})`,
                        sessionId: interviewId,
                    });
                } else
                {
                    throw fetchErr;
                }
            }
            if (!response?.data)
            {
                console.error('No interview data returned');
                return;
            }
            setInterview(response.data.data||response.data);

            // Load first question (only for candidates - recruiters will select)
            if (role==='candidate')
            {
                try
                {
                    const questionResponse=await getQuestion('q_two_sum');
                    const qData=questionResponse?.data?.data||questionResponse?.data;
                    if (qData)
                    {
                        setCurrentQuestion(qData);
                        setCode(qData.starterCode?.[language]||'');
                    }
                } catch (qErr)
                {
                    console.error('Failed to load initial question:', qErr);
                    // Non-fatal — candidate can wait for recruiter to push a question
                }
            } else
            {
                // Show question selector for recruiters
                setShowQuestionSelector(true);
            }

            // Register session with proctoring backend (candidate only)
            if (role==='candidate')
            {
                try
                {
                    await fetch(`${API_BASE_URL}/api/proctoring/session`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        credentials: 'include',
                        body: JSON.stringify({
                            interviewId,
                            candidateName: userName,
                            candidateEmail: searchParams.get('email')||'',
                            recruiterName: response.data?.recruiterName||'Unknown',
                            startTime: new Date(),
                        }),
                    });
                } catch (error)
                {
                    console.error('Failed to register session:', error);
                }
            }
        } catch (error)
        {
            console.error('Error loading interview:', error);
        }
    };

    const handleQuestionSelected=(question) =>
    {
        setCurrentQuestion(question);
        setCode(question.starterCode?.[language]||'');
        setShowQuestionSelector(false);

        // Broadcast question change to candidate via socket
        const socket=socketService.connect();
        if (socket)
        {
            socket.emit('question-update', {
                interviewId,
                question,
            });
        }
    };

    const handleChangeQuestion=() =>
    {
        if (role==='recruiter')
        {
            setShowQuestionSelector(true);
        }
    };

    // Handle video stream ready - start proctoring only when interview has started
    const handleVideoReady=async (stream) =>
    {
        console.log('Video ready callback triggered, role:', role, 'interviewStarted:', interviewStarted);

        if (role==='candidate'&&videoRef.current)
        {
            // Don't start proctoring yet — it will start when recruiter clicks "Start Interview"
            console.log('Video ready — proctoring will start when interview begins');
        }
    };

    // Start proctoring when interview starts (candidate only)
    useEffect(() =>
    {
        if (interviewStarted&&role==='candidate'&&videoRef.current)
        {
            const startProctoring=async () =>
            {
                try
                {
                    console.log('Interview started — beginning proctoring');
                    await proctoringService.startMonitoring(
                        videoRef.current,
                        interviewId,
                        handleViolationDetected,
                        socketService
                    );
                    console.log('Proctoring started successfully');
                } catch (error)
                {
                    console.error('Failed to start proctoring:', error);
                }
            };
            startProctoring();
        }
    }, [interviewStarted]);

    // Notify proctoring service when screen share state changes
    const handleScreenShareChange=(active) =>
    {
        setIsScreenShareActive(active);
        proctoringService.isScreenShareActive=active;
    };

    // Recruiter starts the interview
    const handleStartInterview=() =>
    {
        setInterviewStarted(true);
        const socket=socketService.socket;
        if (socket)
        {
            socket.emit('start-interview', {interviewId});
        }
    };

    // Handle violation detected
    const handleViolationDetected=(violation, newSuspicionScore) =>
    {
        console.log('Violation detected:', violation);
        console.log('New suspicion score:', newSuspicionScore);

        setProctoringEvents(prev => [...prev, violation]);
        setSuspicionScore(newSuspicionScore);
        setIntegrityScore(Math.max(0, 100-newSuspicionScore));

        // Show alert for critical violations
        if (violation.severity==='critical')
        {
            handleShowSecurityAlert(violation);
        }
    };

    // Show security alert (non-blocking overlay)
    const handleShowSecurityAlert=(violation) =>
    {
        setSecurityAlert(violation);
        setTimeout(() => setSecurityAlert(null), 5000);
    };

    const handleCodeChange=(newCode) =>
    {
        setCode(newCode);
        // Skip emitting if this change came from a remote update (prevent echo loop)
        if (isRemoteUpdateRef.current) return;
        // Debounce socket emit — send code update after 300ms of no typing
        if (codeUpdateTimerRef.current)
        {
            clearTimeout(codeUpdateTimerRef.current);
        }
        codeUpdateTimerRef.current=setTimeout(() =>
        {
            socketService.sendCodeUpdate(interviewId, newCode, language);
        }, 300);
    };

    const handleLanguageChange=(newLanguage) =>
    {
        setLanguage(newLanguage);
        languageRef.current=newLanguage;
        const newCode=currentQuestion?.starterCode?.[newLanguage]||'';
        if (currentQuestion) setCode(newCode);
        // Sync language change to other participant
        socketService.sendLanguageUpdate(interviewId, newLanguage, currentQuestion? newCode:undefined);
    };

    // End interview handler (recruiter only)
    const handleEndInterview=async () =>
    {
        setShowEndConfirm(false);
        try
        {
            const totalScore=recruiterScores.overallScore*10;

            await endInterview(interviewId, {
                feedback: recruiterFeedback,
                notes: recruiterNotes,
                score: totalScore,
                rating: recruiterScores.overallScore,
                recruiterScores,
                hiringDecision,
            });

            // Broadcast end to all participants in the room
            const socket=socketService.socket;
            if (socket)
            {
                socket.emit('end-interview', {interviewId});
            }

            socketService.leaveInterview(interviewId);
            proctoringService.stopMonitoring();
            navigate(`/interview-report/${interviewId}?role=${role}`);
        } catch (error)
        {
            console.error('Failed to end interview:', error);
        }
    };

    const renderStarRating=(category, value) =>
    {
        return (
            <div className="star-rating">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                    <button
                        key={star}
                        className={`star-btn ${star<=value? 'star-active':''}`}
                        onClick={() => setRecruiterScores(prev => ({...prev, [category]: star}))}
                        type="button"
                    >
                        <StarIcon size={16} fill={star<=value? '#f59e0b':'none'} />
                    </button>
                ))}
                <span className="star-value">{value}/10</span>
            </div>
        );
    };

    const handleRunCode=async () =>
    {
        if (!code.trim())
        {
            setOutput('No code to run.');
            return;
        }
        setLoading(true);
        try
        {
            const response=await executeCode({code, language, questionId: currentQuestion?.id||currentQuestion?._id||undefined, interviewId});
            const data=response?.data?.data||response?.data;
            const result=data?.output||'No output';
            setOutput(result);
            // Sync output to other participant
            socketService.sendOutputUpdate(interviewId, result);
        } catch (error)
        {
            const errMsg=`Error executing code: ${error?.response?.data?.error||error.message}`;
            setOutput(errMsg);
            socketService.sendOutputUpdate(interviewId, errMsg);
        } finally
        {
            setLoading(false);
        }
    };

    const handleSubmitCode=async () =>
    {
        if (!currentQuestion)
        {
            setOutput('No question selected.');
            return;
        }
        setLoading(true);
        try
        {
            const response=await submitCode({
                code,
                language,
                questionId: currentQuestion.id||currentQuestion._id,
                interviewId,
            });

            const results=response?.data?.data||response?.data;
            if (results?.results)
            {
                const summary=`Test Results: ${results.passed}/${results.total} passed\n\n`+
                    results.results.map((r, i) =>
                        `Test Case ${i+1}: ${r.passed? '✓ Passed':'✗ Failed'}\n`+
                        `Expected: ${r.expected}\nActual: ${r.actual}\nRuntime: ${r.runtime}`
                    ).join('\n\n');
                setOutput(summary);
                socketService.sendOutputUpdate(interviewId, summary);
            } else
            {
                const msg=results?.message||'Submission received.';
                setOutput(msg);
                socketService.sendOutputUpdate(interviewId, msg);
            }
        } catch (error)
        {
            const errMsg=`Error submitting code: ${error?.response?.data?.error||error.message}`;
            setOutput(errMsg);
            socketService.sendOutputUpdate(interviewId, errMsg);
        } finally
        {
            setLoading(false);
        }
    };

    return (
        <div className="interview-room">
            {/* Fullscreen Prompt — shown when recruiter starts the interview */}
            {needsFullscreenPrompt&&role==='candidate'&&(
                <div className="security-notice-overlay" style={{zIndex: 10000}}>
                    <div className="security-notice-modal">
                        <h3><AlertIcon size={20} /> Interview Has Started</h3>
                        <p>The interviewer has started the session. You will now enter <strong>fullscreen mode</strong>.</p>
                        <p>This interview is being monitored for integrity:</p>
                        <ul>
                            <li>Face detection active</li>
                            <li>Face identity verification (matched against your registration)</li>
                            <li>Eye tracking and gaze monitoring</li>
                            <li>Tab switching monitored</li>
                            <li>Fullscreen enforced</li>
                            <li>Copy-paste disabled</li>
                            <li>AI-generated code detection</li>
                        </ul>
                        <p className="notice-warning">Exiting fullscreen or switching tabs will be flagged as violations.</p>
                        <button className="btn btn-primary" onClick={() =>
                        {
                            setNeedsFullscreenPrompt(false);
                            setShowSecurityNotice(false);
                            if (document.documentElement.requestFullscreen&&!document.fullscreenElement)
                            {
                                document.documentElement.requestFullscreen().catch(err =>
                                {
                                    console.warn('Fullscreen failed:', err);
                                });
                            }
                        }}>Enter Fullscreen &amp; Begin</button>
                    </div>
                </div>
            )}

            {/* Security Notice Modal (pre-start, non-blocking) */}
            {showSecurityNotice&&!needsFullscreenPrompt&&(
                <div className="security-notice-overlay">
                    <div className="security-notice-modal">
                        <h3><AlertIcon size={20} /> Security Notice</h3>
                        <p>This interview is being monitored for integrity:</p>
                        <ul>
                            <li>Face detection active</li>
                            <li>Face identity verification</li>
                            <li>Eye tracking and gaze monitoring</li>
                            <li>Tab switching monitored</li>
                            <li>Fullscreen enforced</li>
                            <li>Copy-paste disabled</li>
                            <li>AI-generated code detection</li>
                            <li>Multiple faces detection</li>
                            <li>Secondary camera required (use your phone)</li>
                        </ul>
                        <p className="notice-warning">Violations will be reported and may result in interview termination.</p>
                        <button className="btn btn-primary" onClick={() => setShowSecurityNotice(false)}>I Accept &amp; Continue</button>
                    </div>
                </div>
            )}

            {/* End Interview — Recruiter gets scoring panel, Candidate gets simple confirm */}
            {showEndConfirm&&role==='recruiter'&&(
                <div className="security-notice-overlay">
                    <div className="scoring-modal">
                        <h3><StarIcon size={20} /> Rate Candidate &amp; End Interview</h3>
                        <p className="scoring-subtitle">Score the candidate before ending. This will be included in the final report.</p>

                        <div className="scoring-grid">
                            <div className="scoring-row">
                                <label>Technical</label>
                                {renderStarRating('technical', recruiterScores.technical)}
                            </div>
                            <div className="scoring-row">
                                <label>Problem Solving</label>
                                {renderStarRating('problemSolving', recruiterScores.problemSolving)}
                            </div>
                            <div className="scoring-row">
                                <label>Communication</label>
                                {renderStarRating('communication', recruiterScores.communication)}
                            </div>
                            <div className="scoring-row">
                                <label>Domain</label>
                                {renderStarRating('domain', recruiterScores.domain)}
                            </div>
                            <div className="scoring-row">
                                <label>Aptitude</label>
                                {renderStarRating('aptitude', recruiterScores.aptitude)}
                            </div>
                            <div className="scoring-row scoring-row-overall">
                                <label>Overall Score</label>
                                {renderStarRating('overallScore', recruiterScores.overallScore)}
                            </div>
                        </div>

                        <div className="scoring-feedback">
                            <label>Feedback (shared with candidate)</label>
                            <textarea
                                value={recruiterFeedback}
                                onChange={(e) => setRecruiterFeedback(e.target.value)}
                                placeholder="Strengths, weaknesses, and suggestions for the candidate..."
                                rows={3}
                            />
                        </div>

                        <div className="scoring-feedback">
                            <label>Internal Notes (company only)</label>
                            <textarea
                                value={recruiterNotes}
                                onChange={(e) => setRecruiterNotes(e.target.value)}
                                placeholder="Hiring recommendation, internal notes..."
                                rows={2}
                            />
                        </div>

                        <div className="hiring-decision-section">
                            <label>Hiring Recommendation</label>
                            <div className="hiring-decision-options">
                                <button
                                    type="button"
                                    className={`hiring-option hire ${hiringDecision==='strong-hire'? 'selected':''}`}
                                    onClick={() => setHiringDecision('strong-hire')}
                                >
                                    <ThumbsUpIcon size={18} />
                                    <span>Strong Hire</span>
                                </button>
                                <button
                                    type="button"
                                    className={`hiring-option hire ${hiringDecision==='hire'? 'selected':''}`}
                                    onClick={() => setHiringDecision('hire')}
                                >
                                    <ThumbsUpIcon size={16} />
                                    <span>Hire</span>
                                </button>
                                <button
                                    type="button"
                                    className={`hiring-option maybe ${hiringDecision==='maybe'? 'selected':''}`}
                                    onClick={() => setHiringDecision('maybe')}
                                >
                                    <MaybeIcon size={16} />
                                    <span>Maybe</span>
                                </button>
                                <button
                                    type="button"
                                    className={`hiring-option no-hire ${hiringDecision==='no-hire'? 'selected':''}`}
                                    onClick={() => setHiringDecision('no-hire')}
                                >
                                    <ThumbsDownIcon size={16} />
                                    <span>No Hire</span>
                                </button>
                                <button
                                    type="button"
                                    className={`hiring-option no-hire ${hiringDecision==='strong-no-hire'? 'selected':''}`}
                                    onClick={() => setHiringDecision('strong-no-hire')}
                                >
                                    <ThumbsDownIcon size={18} />
                                    <span>Strong No</span>
                                </button>
                            </div>
                        </div>

                        <div className="confirm-actions">
                            <button className="btn btn-secondary" onClick={() => setShowEndConfirm(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleEndInterview}>
                                <EndIcon size={16} /> End &amp; Submit Scores
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {false&&showEndConfirm&&role!=='recruiter'&&(
                <div className="security-notice-overlay">
                    <div className="security-notice-modal">
                        <h3><AlertIcon size={20} /> End Interview?</h3>
                        <p>Are you sure you want to end this interview? This action cannot be undone.</p>
                        <div className="confirm-actions">
                            <button className="btn btn-secondary" onClick={() => setShowEndConfirm(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleEndInterview}>End Interview</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Question Selector Modal (for recruiters) */}
            {showQuestionSelector&&role==='recruiter'&&(
                <QuestionSelector
                    onQuestionSelected={handleQuestionSelected}
                    onClose={() => setShowQuestionSelector(false)}
                />
            )}

            {/* Security Alert Overlay */}
            {securityAlert&&(
                <div className={`security-alert security-alert-${securityAlert.severity}`}>
                    <div className="security-alert-content">
                        <span className="security-alert-icon"><AlertIcon size={24} /></span>
                        <div>
                            <strong>SECURITY VIOLATION</strong>
                            <p>{securityAlert.description}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Integrity Score Display for Candidate */}
            {role==='candidate'&&(
                <div className="integrity-score-badge">
                    <span className="integrity-label">Integrity Score:</span>
                    <span className={`integrity-value ${integrityScore<50? 'text-danger':integrityScore<80? 'text-warning':'text-success'}`}>
                        {integrityScore}/100
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="interview-header">
                <div className="interview-info">
                    <h2><TargetIcon size={20} /> Interview Room</h2>
                    <span className="interview-id">ID: {interviewId?.length>12? `...${interviewId.slice(-8)}`:interviewId}</span>
                    <span className="badge badge-easy">{mode? mode.charAt(0).toUpperCase()+mode.slice(1):'Interview'} Mode</span>
                    {role==='candidate'&&(
                        <span className="badge badge-secure"><LockIcon size={14} /> Monitored</span>
                    )}
                </div>
                <div className="interview-controls">
                    {role==='recruiter'&&!interviewStarted&&(
                        <button
                            className="btn btn-success"
                            onClick={handleStartInterview}
                            title="Start the interview — enables proctoring and shows questions to candidate"
                        >
                            <PlayIcon size={16} /> Start Interview
                        </button>
                    )}
                    {role==='recruiter'&&interviewStarted&&(
                        <span className="badge badge-secure" style={{background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)'}}>● Live</span>
                    )}
                    {role==='recruiter'&&(
                        <button
                            className="btn btn-primary"
                            onClick={handleChangeQuestion}
                            title="Change or select a new question"
                        >
                            <DocumentIcon size={16} /> Change Question
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => setShowChat(!showChat)}>
                        <ChatIcon size={16} /> Chat
                    </button>
                    {role==='recruiter'&&(
                        <button className="btn btn-danger" onClick={() => setShowEndConfirm(true)}>
                            <EndIcon size={16} /> End Interview
                        </button>
                    )}
                </div>
            </div>

            <div className="interview-content">
                {/* Left Panel - Video & Proctoring */}
                <div className="left-panel">
                    <VideoPanel
                        interviewId={interviewId}
                        userName={userName}
                        role={role}
                        videoRef={videoRef}
                        onVideoReady={handleVideoReady}
                        secondaryCamSnapshot={secondaryCamSnapshot}
                        onScreenShareChange={handleScreenShareChange}
                    />

                    {/* Secondary Camera Setup (for candidates) */}
                    {role==='candidate'&&(
                        <SecondaryCamera
                            interviewId={interviewId}
                            userName={userName}
                            isPhone={false}
                        />
                    )}

                    {role==='recruiter'&&(
                        <ProctoringMonitor
                            interviewId={interviewId}
                            events={proctoringEvents}
                            suspicionScore={suspicionScore}
                            integrityScore={integrityScore}
                            secondaryCamActive={secondaryCamActive}
                        />
                    )}
                </div>

                {/* Middle Panel - Question & Code Editor */}
                <div className="middle-panel">
                    {/* For candidates: show waiting message until interview starts */}
                    {role==='candidate'&&!interviewStarted? (
                        <div className="no-question-placeholder" style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px'}}>
                            <LockIcon size={32} style={{opacity: 0.4}} />
                            <h3>Waiting for Interview to Begin</h3>
                            <p>The interviewer will start the session shortly. Please ensure your camera and microphone are working.</p>
                        </div>
                    ):(
                        <>
                            {currentQuestion? (
                                <QuestionPanel question={currentQuestion} />
                            ):(
                                <div className="no-question-placeholder">
                                    <h3><DocumentIcon size={20} /> No Question Selected</h3>
                                    {role==='recruiter'? (
                                        <p>Click &quot;Change Question&quot; to select or create a question</p>
                                    ):(
                                        <p>Waiting for interviewer to select a question...</p>
                                    )}
                                </div>
                            )}

                            <div className="editor-section">
                                <div className="editor-header">
                                    <select
                                        className="select language-select"
                                        value={language}
                                        onChange={(e) => handleLanguageChange(e.target.value)}
                                    >
                                        <option value="javascript">JavaScript</option>
                                        <option value="python">Python</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                    </select>

                                    <div className="editor-actions">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={handleRunCode}
                                            disabled={loading}
                                        >
                                            <PlayIcon size={16} /> Run Code
                                        </button>
                                        <button
                                            className="btn btn-success"
                                            onClick={handleSubmitCode}
                                            disabled={loading}
                                        >
                                            <CheckIcon size={16} /> Submit
                                        </button>
                                    </div>
                                </div>

                                <CodeEditor
                                    code={code}
                                    language={language}
                                    onChange={handleCodeChange}
                                />

                                <div className="output-panel">
                                    <div className="output-header">Output:</div>
                                    <pre className="output-content">{output||'Run your code to see output...'}</pre>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Right Panel - Chat */}
                {showChat&&(
                    <div className="right-panel">
                        <ChatPanel
                            interviewId={interviewId}
                            userName={userName}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default InterviewRoom;
