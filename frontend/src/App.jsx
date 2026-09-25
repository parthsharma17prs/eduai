import {BrowserRouter as Router, Routes, Route, useLocation} from 'react-router-dom'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import InterviewRoom from './pages/InterviewRoom'
import InterviewReport from './pages/InterviewReport'
import PracticeMode from './pages/PracticeMode'
import SecondaryCameraView from './pages/SecondaryCameraView'
import ProctorDashboard from './pages/ProctorDashboard'
import PracticeSessionSetup from './pages/PracticeSessionSetup'
import PracticeInterviewRoom from './pages/PracticeInterviewRoom'
import PracticeFeedback from './pages/PracticeFeedback'
import AxiomChat from './pages/AxiomChat'
import AIInterviewSetup from './pages/AIInterviewSetup'
import AIInterviewRoom from './pages/AIInterviewRoom'
import AIInterviewReport from './pages/AIInterviewReport'
import AIAvatarInterview from './pages/AIAvatarInterview'
import RecruiterDashboard from './pages/RecruiterDashboard'
import RecruiterCandidates from './pages/RecruiterCandidates'
import RecruiterAnalysis from './pages/RecruiterAnalysis'
import RecruiterReport from './pages/RecruiterReport'
import RecruiterComparison from './pages/RecruiterComparison'
import CandidateApply from './pages/CandidateApply'
import ApplicationSuccess from './pages/ApplicationSuccess'
import CandidateStatus from './pages/CandidateStatus'
import MultiProjectDashboard from './pages/MultiProjectDashboard'
import CodingPractice from './pages/CodingPractice'
import CandidateDashboard from './pages/CandidateDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import AdminScoring from './pages/AdminScoring'
import AdminDashboard from './pages/AdminDashboard'
import CandidateResults from './pages/CandidateResults'
import CandidateAnalytics from './pages/CandidateAnalytics'
import CandidateProfile from './pages/CandidateProfile'
import ResumeVerification from './pages/ResumeVerification'
import QuizDashboard from './pages/QuizDashboard'
import QuizHost from './pages/QuizHost'
import QuizPlay from './pages/QuizPlay'
import QuizResults from './pages/QuizResults'
import ContestDashboard from './pages/ContestDashboard'
import ContestHost from './pages/ContestHost'
import ContestPlay from './pages/ContestPlay'
import ContestResults from './pages/ContestResults'
import {FeatureProvider} from './services/FeatureContext'
import './App.css'

// Pages that render their own navbar (dashboards)
const HIDE_NAVBAR_PATHS=['/candidate-dashboard', '/company-dashboard', '/admin-dashboard', '/admin-scoring', '/candidate-results', '/candidate-analytics', '/candidate-profile', '/resume-verification', '/quiz', '/contest', '/recruiter-dashboard', '/recruiter/', '/jobs/', '/application/', '/candidate/status'];

function AppLayout()
{
    const location=useLocation();
    const hideNavbar=location.pathname==='/'||HIDE_NAVBAR_PATHS.some(p => location.pathname.startsWith(p));

    return (
        <div className="App">
            {!hideNavbar&&<Navbar />}
            <div className={!hideNavbar? 'page-content':''}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/interview/:interviewId" element={<InterviewRoom />} />
                    <Route path="/interview-report/:interviewId" element={<InterviewReport />} />
                    <Route path="/practice" element={<PracticeMode />} />
                    <Route path="/practice-setup" element={<PracticeSessionSetup />} />
                    <Route path="/practice-interview/:sessionId" element={<PracticeInterviewRoom />} />
                    <Route path="/practice-feedback/:sessionId" element={<PracticeFeedback />} />
                    <Route path="/secondary-camera" element={<SecondaryCameraView />} />
                    <Route path="/proctor-dashboard" element={<ProctorDashboard />} />
                    <Route path="/axiom-chat" element={<AxiomChat />} />
                    <Route path="/ai-interview-setup" element={<AIInterviewSetup />} />
                    <Route path="/ai-interview/:sessionId" element={<AIInterviewRoom />} />
                    <Route path="/ai-interview-report/:sessionId" element={<AIInterviewReport />} />
                    <Route path="/recruiter-dashboard" element={<RecruiterDashboard />} />
                    <Route path="/coding-practice" element={<CodingPractice />} />
                    <Route path="/candidate-dashboard" element={<FeatureProvider role="student"><CandidateDashboard /></FeatureProvider>} />
                    <Route path="/company-dashboard" element={<FeatureProvider role="company"><CompanyDashboard /></FeatureProvider>} />
                    <Route path="/admin-scoring" element={<FeatureProvider role="company"><AdminScoring /></FeatureProvider>} />
                    <Route path="/admin-dashboard" element={<AdminDashboard />} />
                    <Route path="/candidate-results" element={<FeatureProvider role="student"><CandidateResults /></FeatureProvider>} />
                    <Route path="/candidate-analytics" element={<FeatureProvider role="student"><CandidateAnalytics /></FeatureProvider>} />
                    <Route path="/candidate-profile" element={<CandidateProfile />} />
                    <Route path="/resume-verification" element={<FeatureProvider role="student"><ResumeVerification /></FeatureProvider>} />
                    <Route path="/quiz/dashboard" element={<FeatureProvider role="company"><QuizDashboard /></FeatureProvider>} />
                    <Route path="/quiz/host/:quizId" element={<FeatureProvider role="company"><QuizHost /></FeatureProvider>} />
                    <Route path="/quiz/join" element={<FeatureProvider role="company"><QuizDashboard /></FeatureProvider>} />
                    <Route path="/quiz/play" element={<QuizPlay />} />
                    <Route path="/quiz/results/:quizId" element={<FeatureProvider role="company"><QuizResults /></FeatureProvider>} />
                    <Route path="/contest/dashboard" element={<FeatureProvider role="company"><ContestDashboard /></FeatureProvider>} />
                    <Route path="/contest/host/:contestId" element={<FeatureProvider role="company"><ContestHost /></FeatureProvider>} />
                    <Route path="/contest/join" element={<FeatureProvider role="company"><ContestDashboard /></FeatureProvider>} />
                    <Route path="/contest/play" element={<ContestPlay />} />
                    <Route path="/contest/results/:contestId" element={<FeatureProvider role="company"><ContestResults /></FeatureProvider>} />
                    <Route path="/axiom-chat" element={<FeatureProvider role="student"><AxiomChat /></FeatureProvider>} />
                    <Route path="/ai-interview-setup" element={<FeatureProvider role="student"><AIInterviewSetup /></FeatureProvider>} />
                    <Route path="/ai-avatar-interview" element={<FeatureProvider role="student"><AIAvatarInterview /></FeatureProvider>} />
                    <Route path="/ai-interview" element={<FeatureProvider role="student"><AIAvatarInterview /></FeatureProvider>} />
                    <Route path="/ai-interview/:sessionId" element={<FeatureProvider role="student"><AIInterviewRoom /></FeatureProvider>} />
                    <Route path="/ai-interview-report/:sessionId" element={<FeatureProvider role="student"><AIInterviewReport /></FeatureProvider>} />
                    <Route path="/coding-practice" element={<FeatureProvider role="student"><CodingPractice /></FeatureProvider>} />
                    <Route path="/practice" element={<FeatureProvider role="student"><PracticeMode /></FeatureProvider>} />
                    <Route path="/practice-setup" element={<FeatureProvider role="student"><PracticeSessionSetup /></FeatureProvider>} />
                    <Route path="/practice-interview/:sessionId" element={<FeatureProvider role="student"><PracticeInterviewRoom /></FeatureProvider>} />
                    <Route path="/practice-feedback/:sessionId" element={<FeatureProvider role="student"><PracticeFeedback /></FeatureProvider>} />
                    <Route path="/proctor-dashboard" element={<FeatureProvider role="company"><ProctorDashboard /></FeatureProvider>} />
                    <Route path="/recruiter-dashboard" element={<FeatureProvider role="company"><RecruiterDashboard /></FeatureProvider>} />
                    <Route path="/recruiter/candidates" element={<FeatureProvider role="company"><RecruiterCandidates /></FeatureProvider>} />
                    <Route path="/recruiter/analysis/:candidateId" element={<FeatureProvider role="company"><RecruiterAnalysis /></FeatureProvider>} />
                    <Route path="/recruiter/report/:candidateId" element={<FeatureProvider role="company"><RecruiterReport /></FeatureProvider>} />
                    <Route path="/recruiter/compare" element={<FeatureProvider role="company"><RecruiterComparison /></FeatureProvider>} />
                    <Route path="/jobs/:jobId/apply" element={<CandidateApply />} />
                    <Route path="/jobs/apply" element={<CandidateApply />} />
                    <Route path="/application/success" element={<ApplicationSuccess />} />
                    <Route path="/candidate/status" element={<CandidateStatus />} />
                    <Route path="/recruiter/projects/:candidateId" element={<FeatureProvider role="company"><MultiProjectDashboard /></FeatureProvider>} />
                </Routes>
            </div>
        </div>
    )
}

function App()
{
    return (
        <ErrorBoundary>
            <Router future={{v7_startTransition: true, v7_relativeSplatPath: true}}>
                <AppLayout />
            </Router>
        </ErrorBoundary>
    )
}

export default App
