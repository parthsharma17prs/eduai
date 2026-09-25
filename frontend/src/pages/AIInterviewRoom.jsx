import {useState, useEffect, useRef, useCallback} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import api from '../services/api';
import AIAvatarView from '../components/AIAvatarView';
import './AIInterviewRoom.css';

/* ── Text-to-Speech helper ── */
function speakText(text, onEnd)
{
  if (!window.speechSynthesis) {onEnd?.(); return;}
  window.speechSynthesis.cancel();
  const utter=new SpeechSynthesisUtterance(text);
  utter.rate=1;
  utter.pitch=1;
  // Pick a good English voice
  const voices=window.speechSynthesis.getVoices();
  const preferred=voices.find(v => v.lang.startsWith('en')&&v.name.includes('Female'))
    ||voices.find(v => v.lang.startsWith('en'))
    ||voices[0];
  if (preferred) utter.voice=preferred;
  utter.onend=() => onEnd?.();
  utter.onerror=() => onEnd?.();
  window.speechSynthesis.speak(utter);
}

function AIInterviewRoom()
{
  const {sessionId}=useParams();
  const navigate=useNavigate();
  const [sessionData, setSessionData]=useState(null);
  const [currentQuestion, setCurrentQuestion]=useState('');
  const [answer, setAnswer]=useState('');
  const [conversation, setConversation]=useState([]);
  const [loading, setLoading]=useState(true);
  const [submitting, setSubmitting]=useState(false);
  const [timeLeft, setTimeLeft]=useState(0);

  // Voice states
  const [isSpeaking, setIsSpeaking]=useState(false);
  const [emotion, setEmotion]=useState('friendly');
  const [isRecording, setIsRecording]=useState(false);
  const [voiceSupported, setVoiceSupported]=useState(false);
  const [micSupported, setMicSupported]=useState(false);
  const recognitionRef=useRef(null);
  const conversationEndRef=useRef(null);
  const initDone=useRef(false);

  // Detect if this interview was started from verification flow
  const isFromVerification=sessionStorage.getItem('fromVerification')==='true';

  // Check browser support
  useEffect(() =>
  {
    setVoiceSupported(!!window.speechSynthesis);
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    setMicSupported(!!SpeechRecognition);

    // Pre-load voices
    if (window.speechSynthesis)
    {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged=() => window.speechSynthesis.getVoices();
    }

    return () =>
    {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  // Auto-scroll conversation
  useEffect(() =>
  {
    conversationEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [conversation]);

  // Timer
  useEffect(() =>
  {
    if (timeLeft>0)
    {
      const timer=setTimeout(() => setTimeLeft(timeLeft-1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft===0&&sessionData&&!loading)
    {
      handleEndInterview();
    }
  }, [timeLeft, sessionData, loading]);

  // Init: fetch session + first question (once)
  useEffect(() =>
  {
    if (initDone.current) return;
    initDone.current=true;

    (async () =>
    {
      try
      {
        const res=await api.get(`/ai-interview/${sessionId}`);
        setSessionData(res.data);
        setTimeLeft(res.data.duration*60);

        // Fetch first question
        const qRes=await api.post(`/ai-interview/${sessionId}/question`, {});
        if (qRes.data.question)
        {
          setCurrentQuestion(qRes.data.question);
          setConversation([{role: 'assistant', content: qRes.data.question}]);
          // Speak the first question
          setIsSpeaking(true);
          speakText(qRes.data.question, () => setIsSpeaking(false));
        }
      } catch (error)
      {
        console.warn('Session not found in DB, using fallback interactive session:', error.message);
        const fallbackData = {
          role: 'Software Engineer',
          candidateName: 'Candidate',
          duration: 30
        };
        setSessionData(fallbackData);
        setTimeLeft(30 * 60);

        const firstQ = 'Welcome to your AI Interview session! Let\'s begin: Could you introduce yourself and describe your technical background and key engineering achievements?';
        setCurrentQuestion(firstQ);
        setConversation([{ role: 'assistant', content: firstQ }]);
        setIsSpeaking(true);
        speakText(firstQ, () => setIsSpeaking(false));
      } finally
      {
        setLoading(false);
      }
    })();
  }, [sessionId, navigate]);

  /* ── Speech Recognition (mic) ── */
  const startRecording=useCallback(() =>
  {
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop AI speaking if it is
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    const recognition=new SpeechRecognition();
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.lang='en-US';

    let finalTranscript=answer; // Keep existing text

    recognition.onresult=(event) =>
    {
      let interim='';
      for (let i=event.resultIndex;i<event.results.length;i++)
      {
        const transcript=event.results[i][0].transcript;
        if (event.results[i].isFinal)
        {
          finalTranscript+=(finalTranscript? ' ':'')+transcript;
        } else
        {
          interim+=transcript;
        }
      }
      setAnswer(finalTranscript+(interim? ' '+interim:''));
    };

    recognition.onerror=(e) =>
    {
      console.error('Speech recognition error:', e.error);
      setIsRecording(false);
    };

    recognition.onend=() =>
    {
      setIsRecording(false);
    };

    recognitionRef.current=recognition;
    recognition.start();
    setIsRecording(true);
  }, [answer]);

  const stopRecording=useCallback(() =>
  {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const toggleRecording=useCallback(() =>
  {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  /* ── Replay current question ── */
  const replayQuestion=useCallback(() =>
  {
    if (!currentQuestion) return;
    window.speechSynthesis?.cancel();
    setIsSpeaking(true);
    speakText(currentQuestion, () => setIsSpeaking(false));
  }, [currentQuestion]);

  /* ── Submit answer ── */
  const handleSubmitAnswer=async (e) =>
  {
    e.preventDefault();
    if (!answer.trim()) return;

    // Stop any recording/speaking
    recognitionRef.current?.stop();
    setIsRecording(false);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);

    setSubmitting(true);
    const userAnswer=answer.trim();
    setConversation(prev => [...prev, {role: 'user', content: userAnswer}]);
    setAnswer('');

    try
    {
      const response=await api.post(`/ai-interview/${sessionId}/answer`, {
        question: currentQuestion,
        answer: userAnswer,
      });

      if (response.data.interviewComplete)
      {
        setConversation(prev => [...prev, {role: 'assistant', content: response.data.message}]);
        speakText(response.data.message, () =>
        {
          if (isFromVerification)
          {
            // Completed all questions from verification flow — go to report with verification flag
            sessionStorage.setItem('verificationInterviewComplete', 'true');
            sessionStorage.setItem('verificationSessionId', sessionId);
            navigate(`/ai-interview-report/${sessionId}`);
          } else
          {
            navigate(`/ai-interview-report/${sessionId}`);
          }
        });
        return;
      }

      // Determine next question text
      const nextQ=response.data.followUpQuestion||response.data.question||response.data.nextQuestion;
      const transitionMsg=response.data.message||'';

      if (nextQ)
      {
        setCurrentQuestion(nextQ);
        if (transitionMsg)
        {
          setConversation(prev => [...prev, {role: 'assistant', content: `${transitionMsg}\n\n${nextQ}`}]);
        } else
        {
          setConversation(prev => [...prev, {role: 'assistant', content: nextQ}]);
        }
        // Speak transition + question
        const fullSpeak=transitionMsg? `${transitionMsg} ${nextQ}`:nextQ;
        setIsSpeaking(true);
        speakText(fullSpeak, () => setIsSpeaking(false));
      }
    } catch (error)
    {
      console.error('Error submitting answer:', error);
    } finally
    {
      setSubmitting(false);
    }
  };

  /* ── End interview ── */
  const handleEndInterview=async () =>
  {
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
    try
    {
      await api.post(`/ai-interview/${sessionId}/end`);

      if (isFromVerification)
      {
        // Ended early from verification flow — mark as incomplete, redirect to verification
        try
        {
          const stored=localStorage.getItem('user');
          if (stored)
          {
            const u=JSON.parse(stored);
            const userId=u.id||u._id;
            await api.post(`/verification/${userId}/verify-interview-result`, {sessionId});
          }
        } catch (e)
        {
          console.error('Failed to update verification status:', e);
        }
        sessionStorage.removeItem('fromVerification');
        sessionStorage.removeItem('verificationInterviewComplete');
        sessionStorage.removeItem('verificationSessionId');
        navigate('/resume-verification');
      } else
      {
        navigate(`/ai-interview-report/${sessionId}`);
      }
    } catch (error)
    {
      console.error('Error ending interview:', error);
      if (isFromVerification)
      {
        sessionStorage.removeItem('fromVerification');
        navigate('/resume-verification');
      } else
      {
        navigate(`/ai-interview-report/${sessionId}`);
      }
    }
  };

  const formatTime=(seconds) =>
  {
    const mins=Math.floor(seconds/60);
    const secs=seconds%60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading)
  {
    return <div className="loading">Loading interview session...</div>;
  }

  return (
    <div className="ai-interview-room">
      <div className="interview-header">
        <div className="header-info">
          <h2>AI Interview - {sessionData?.role}</h2>
          <p>Candidate: {sessionData?.candidateName}</p>
        </div>
        <div className="timer">
          <span>Time Left: </span>
          <strong>{formatTime(timeLeft)}</strong>
        </div>
        <button onClick={handleEndInterview} className="end-button">
          End Interview
        </button>
      </div>

      <div className="interview-content">
        <div className="avatar-and-conversation-col">
          <div className="avatar-stage-card">
            <AIAvatarView
              isSpeaking={isSpeaking}
              emotion={emotion}
              interviewerName={`${sessionData?.role || 'Technical'} AI Interviewer`}
            />
          </div>
          <div className="conversation-panel">
            <h3>Interview Conversation</h3>
            <div className="conversation">
              {conversation.map((msg, index) => (
                <div key={index} className={`message ${msg.role}`}>
                  <div className="message-label">
                    {msg.role==='assistant'? 'AI Interviewer':'You'}
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
              <div ref={conversationEndRef} />
            </div>
          </div>
        </div>

        <div className="answer-panel">
          <h3>Current Question</h3>
          <div className="current-question">
            {currentQuestion}
            {voiceSupported&&(
              <button
                className={`speak-btn ${isSpeaking? 'speaking':''}`}
                onClick={replayQuestion}
                title={isSpeaking? 'Speaking...':'Replay question'}
                type="button"
              >
                {isSpeaking? 'Speaking':'Replay'}
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitAnswer} className="answer-form">
            <div className="answer-input-wrapper">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={isRecording? 'Listening... speak now':'Type your answer or click the mic to speak...'}
                rows="6"
                disabled={submitting}
                className={isRecording? 'recording':''}
              />
              {micSupported&&(
                <button
                  type="button"
                  className={`mic-btn ${isRecording? 'recording':''}`}
                  onClick={toggleRecording}
                  disabled={submitting}
                  title={isRecording? 'Stop recording':'Start voice recording'}
                >
                  {isRecording? (
                    <span className="mic-icon recording-icon">Stop</span>
                  ):(
                    <span className="mic-icon">Mic</span>
                  )}
                </button>
              )}
            </div>
            {isRecording&&(
              <div className="recording-indicator">
                <span className="pulse-dot" />
                <span>Recording... speak your answer</span>
              </div>
            )}
            <button type="submit" disabled={submitting||!answer.trim()}>
              {submitting? 'Submitting...':'Submit Answer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AIInterviewRoom;
