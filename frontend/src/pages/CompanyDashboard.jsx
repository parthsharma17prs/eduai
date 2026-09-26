import {useState, useEffect, useMemo} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import
{
  Search, Bell, LogOut, Plus, Users, BarChart3, Briefcase,
  FileText, Video, Zap, Eye, TrendingUp, Star, ChevronRight,
  Calendar, Clock, MapPin, Building2, CheckCircle2, XCircle,
  Timer, PlayCircle, Settings, Award, Target, Filter,
  ArrowUpRight, Activity, Trophy,
  Bot, Loader, Check, X, Sparkles, RefreshCw, Trash2, Terminal, Code,
  Brain, FileBarChart, ExternalLink, Phone, Mail, Crown, Hash, GitBranch
} from 'lucide-react';
import Chart from 'react-apexcharts';
import api, {createInterview, scheduleInterview, getJobInterviews, API_BASE_URL} from '../services/api';
import {useFeatures} from '../services/FeatureContext';
import './CompanyDashboard.css';

const TABS=[
  {key: 'overview', label: 'Overview', icon: <BarChart3 size={16} />},
  {key: 'jobs', label: 'Job Postings', icon: <Briefcase size={16} />},
  {key: 'candidates', label: 'Candidates', icon: <Users size={16} />, featureId: 'company.candidates.ats_screening'},
  {key: 'quiz', label: 'Live Quiz', icon: <Zap size={16} />, featureId: 'company.quiz.management'},
  {key: 'contest', label: 'Coding Contest', icon: <Terminal size={16} />, featureId: 'company.contest.management'},
  {key: 'interviews', label: 'Interviews', icon: <Video size={16} />, featureId: 'company.interviews.start'},
];

function CompanyDashboard()
{
  const navigate=useNavigate();
  const [user, setUser]=useState(null);
  const [activeTab, setActiveTab]=useState('overview');
  const [searchQuery, setSearchQuery]=useState('');
  const {features}=useFeatures();

  // Filter tabs based on feature toggles
  const visibleTabs=TABS.filter(t => !t.featureId||features[t.featureId]!==false);
  const [showPostJobModal, setShowPostJobModal]=useState(false);
  const [jobForm, setJobForm]=useState({title: '', department: '', location: 'Remote', type: 'Full-Time', description: '', requirements: '', skills: '', minCGPA: '', requiredSkills: '', preferredSkills: '', minExperience: '', maxExperience: '', requiredEducation: '', autoShortlist: false, minATSScore: 60, salaryMin: '', salaryMax: ''});
  const [jobs, setJobs]=useState([]);
  const [candidates, setCandidates]=useState([]);
  const [candidateSort, setCandidateSort]=useState('atsScore');
  const [candidateFilter, setCandidateFilter]=useState('all');
  const [shortlistThreshold, setShortlistThreshold]=useState(60);
  const [shortlisting, setShortlisting]=useState(false);
  const [rescoring, setRescoring]=useState(false);
  const [selectedCandidate, setSelectedCandidate]=useState(null);
  const [quizzes, setQuizzes]=useState([]);
  const [loadingQuizzes, setLoadingQuizzes]=useState(false);
  const [showCreateQuiz, setShowCreateQuiz]=useState(false);
  const [quizForm, setQuizForm]=useState({title: '', topic: '', description: '', difficulty: 'medium', questionTimeLimit: 20, questionCount: 5});
  const [creatingQuiz, setCreatingQuiz]=useState(false);
  const [wizardStep, setWizardStep]=useState(1); // 1=details, 2=questions, 3=review
  const [generatingAI, setGeneratingAI]=useState(false);
  const [generatedQuestions, setGeneratedQuestions]=useState([]);
  const [quizError, setQuizError]=useState('');
  const [createdQuizId, setCreatedQuizId]=useState(null);
  const [companyStats, setCompanyStats]=useState({activeJobs: 0, totalApplicants: 0, inInterview: 0, offered: 0, hired: 0});
  const [loadingJobs, setLoadingJobs]=useState(true);
  const [selectedJobApplicants, setSelectedJobApplicants]=useState(null);
  const [startingInterview, setStartingInterview]=useState(false);
  const [scheduledInterviews, setScheduledInterviews]=useState([]);
  const [schedulingCandidate, setSchedulingCandidate]=useState(null);
  const [copiedLink, setCopiedLink]=useState(null);
  const [jobWiseCandidates, setJobWiseCandidates]=useState({});
  const [loadingAllCandidates, setLoadingAllCandidates]=useState(false);
  // Leaderboard state
  const [leaderboard, setLeaderboard]=useState([]);
  const [leaderboardJobs, setLeaderboardJobs]=useState([]);
  const [leaderboardFilter, setLeaderboardFilter]=useState('all');
  const [loadingLeaderboard, setLoadingLeaderboard]=useState(false);
  // Contest state
  const [contests, setContests]=useState([]);
  const [loadingContests, setLoadingContests]=useState(false);
  const [showCreateContest, setShowCreateContest]=useState(false);
  const [contestForm, setContestForm]=useState({title: '', topic: '', description: '', difficulty: 'medium', duration: 60, challengeCount: 3});
  const [creatingContest, setCreatingContest]=useState(false);
  const [contestWizardStep, setContestWizardStep]=useState(1);
  const [generatingContestAI, setGeneratingContestAI]=useState(false);
  const [generatedChallenges, setGeneratedChallenges]=useState([]);
  const [contestError, setContestError]=useState('');
  const [createdContestId, setCreatedContestId]=useState(null);

  const fetchCompanyQuizzes=async () =>
  {
    setLoadingQuizzes(true);
    try
    {
      const res=await fetch(`${API_BASE_URL}/api/quiz/my-quizzes`, {credentials: 'include'});
      if (res.ok) {const data=await res.json(); setQuizzes(data.quizzes||[]);}
    } catch (e) {console.error('Fetch quizzes error:', e);}
    finally {setLoadingQuizzes(false);}
  };

  const API_URL=API_BASE_URL;

  const resetQuizWizard=() =>
  {
    setShowCreateQuiz(false);
    setWizardStep(1);
    setQuizForm({title: '', topic: '', description: '', difficulty: 'medium', questionTimeLimit: 20, questionCount: 5});
    setGeneratedQuestions([]);
    setQuizError('');
    setCreatedQuizId(null);
    setCreatingQuiz(false);
    setGeneratingAI(false);
  };

  // Step 1 → Step 2: Create the quiz shell in DB
  const handleCreateQuizShell=async () =>
  {
    if (!quizForm.title.trim()||!quizForm.topic.trim()) return;
    setCreatingQuiz(true);
    setQuizError('');
    try
    {
      const res=await fetch(`${API_URL}/api/quiz/create`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify(quizForm),
      });
      const data=await res.json();
      if (res.ok&&data.success)
      {
        setCreatedQuizId(data.quiz.id);
        setWizardStep(2);
      } else {setQuizError(data.error||'Failed to create quiz. Check your connection.');}
    } catch (e) {setQuizError('Network error — is the backend running?');}
    finally {setCreatingQuiz(false);}
  };

  // Step 2: Generate questions with AI
  const handleAIGenerate=async () =>
  {
    setGeneratingAI(true);
    setQuizError('');
    try
    {
      const res=await fetch(`${API_URL}/api/quiz/generate-questions`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify({
          topic: quizForm.topic,
          count: quizForm.questionCount,
          difficulty: quizForm.difficulty,
          type: 'mcq',
          existingQuestions: generatedQuestions,
        }),
      });
      const data=await res.json();
      if (res.ok&&data.success)
      {
        setGeneratedQuestions(prev => [...prev, ...data.questions]);
        setWizardStep(3);
      } else {setQuizError(data.error||'AI generation failed. Try again.');}
    } catch (e) {setQuizError('Network error calling AI.');}
    finally {setGeneratingAI(false);}
  };

  // Step 3 → Finish: Save questions to quiz and optionally publish
  const handleFinishQuiz=async (publish=false) =>
  {
    if (!createdQuizId||generatedQuestions.length===0) return;
    setCreatingQuiz(true);
    setQuizError('');
    try
    {
      // Add questions
      const addRes=await fetch(`${API_URL}/api/quiz/${createdQuizId}/questions`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify({questions: generatedQuestions, replace: true}),
      });
      if (!addRes.ok) {const e=await addRes.json().catch(() => ({})); setQuizError(e.error||'Failed to save questions'); return;}

      // Optionally publish
      if (publish)
      {
        const pubRes=await fetch(`${API_URL}/api/quiz/${createdQuizId}/publish`, {
          method: 'POST', credentials: 'include',
        });
        if (!pubRes.ok) {const e=await pubRes.json().catch(() => ({})); setQuizError(e.error||'Failed to publish'); return;}
      }

      resetQuizWizard();
      fetchCompanyQuizzes();
      if (publish) navigate(`/quiz/host/${createdQuizId}`);
    } catch (e) {setQuizError('Network error');}
    finally {setCreatingQuiz(false);}
  };

  const removeQuestion=(idx) => setGeneratedQuestions(prev => prev.filter((_, i) => i!==idx));

  // Fetch quizzes when tab switches to quiz
  useEffect(() => {if (activeTab==='quiz') fetchCompanyQuizzes();}, [activeTab]);

  // ═══ Contest Functions ═══
  const fetchCompanyContests=async () =>
  {
    setLoadingContests(true);
    try
    {
      const res=await fetch(`${API_URL}/api/contest/my-contests`, {credentials: 'include'});
      if (res.ok) {const data=await res.json(); setContests(data.contests||[]);}
    } catch (e) {console.error('Fetch contests error:', e);}
    finally {setLoadingContests(false);}
  };

  const resetContestWizard=() =>
  {
    setShowCreateContest(false);
    setContestWizardStep(1);
    setContestForm({title: '', topic: '', description: '', difficulty: 'medium', duration: 60, challengeCount: 3});
    setGeneratedChallenges([]);
    setContestError('');
    setCreatedContestId(null);
    setCreatingContest(false);
    setGeneratingContestAI(false);
  };

  // Step 1 → Step 2: Create the contest shell in DB
  const handleCreateContestShell=async () =>
  {
    if (!contestForm.title.trim()||!contestForm.topic.trim()) return;
    setCreatingContest(true);
    setContestError('');
    try
    {
      const res=await fetch(`${API_URL}/api/contest/create`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify(contestForm),
      });
      const data=await res.json();
      if (res.ok&&data.success)
      {
        setCreatedContestId(data.contest.id);
        setContestWizardStep(2);
      } else {setContestError(data.error||'Failed to create contest.');}
    } catch (e) {setContestError('Network error — is the backend running?');}
    finally {setCreatingContest(false);}
  };

  // Step 2: Generate challenges with AI
  const handleContestAIGenerate=async () =>
  {
    setGeneratingContestAI(true);
    setContestError('');
    try
    {
      const res=await fetch(`${API_URL}/api/contest/generate-challenges`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify({topic: contestForm.topic, difficulty: contestForm.difficulty, count: contestForm.challengeCount}),
      });
      const data=await res.json();
      if (res.ok&&data.success)
      {
        setGeneratedChallenges(prev => [...prev, ...data.challenges]);
        setContestWizardStep(3);
      } else {setContestError(data.error||'Failed to generate challenges');}
    } catch (e) {setContestError('Network error while generating challenges');}
    finally {setGeneratingContestAI(false);}
  };

  // Step 3: Save challenges and optionally publish
  const handleFinishContest=async (publish) =>
  {
    if (!createdContestId||generatedChallenges.length===0) return;
    setCreatingContest(true);
    setContestError('');
    try
    {
      // Add challenges
      const addRes=await fetch(`${API_URL}/api/contest/${createdContestId}/challenges`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify({challenges: generatedChallenges, replace: true}),
      });
      if (!addRes.ok) {const e=await addRes.json().catch(() => ({})); setContestError(e.error||'Failed to save challenges'); return;}

      // Optionally publish
      if (publish)
      {
        const pubRes=await fetch(`${API_URL}/api/contest/${createdContestId}/publish`, {
          method: 'POST', credentials: 'include',
        });
        if (!pubRes.ok) {const e=await pubRes.json().catch(() => ({})); setContestError(e.error||'Failed to publish'); return;}
      }

      resetContestWizard();
      fetchCompanyContests();
      if (publish) navigate(`/contest/host/${createdContestId}`);
    } catch (e) {setContestError('Network error');}
    finally {setCreatingContest(false);}
  };

  const removeChallenge=(idx) => setGeneratedChallenges(prev => prev.filter((_, i) => i!==idx));

  // Fetch contests when tab switches to contest
  useEffect(() => {if (activeTab==='contest') fetchCompanyContests();}, [activeTab]);

  const handleStartInterview=async () =>
  {
    if (startingInterview) return;
    setStartingInterview(true);
    try
    {
      const sessionId=`interview-${Date.now()}`;
      await createInterview({
        candidateName: 'Pending Candidate',
        role: 'Software Engineer',
        experience: 'entry',
        topics: [],
        duration: 30,
        notes: 'Created by recruiter from Company Dashboard',
        sessionId,
      });
      navigate(`/interview/${sessionId}?mode=recruiter&name=${encodeURIComponent(user?.username||user?.name||'Recruiter')}&role=recruiter`);
    } catch (error)
    {
      console.error('Failed to start interview:', error);
      alert('Failed to start interview session. Please try again.');
    } finally
    {
      setStartingInterview(false);
    }
  };

  const handleScheduleInterview=async (candidateObj, jobId, applicationId) =>
  {
    if (schedulingCandidate) return;
    const candId=candidateObj?.candidate?.id||candidateObj?.candidateId;
    const appId=applicationId||candidateObj?.id;
    if (!candId||!jobId) return alert('Missing candidate or job information');
    setSchedulingCandidate(candId);
    try
    {
      const res=await scheduleInterview({
        candidateId: candId,
        jobId,
        applicationId: appId,
        duration: 30,
      });
      const data=res.data?.data||res.data;
      const link=data.interviewLink||data.interview?.sessionId;
      alert(`Interview scheduled!\nLink: ${link}\nCandidate: ${data.candidateName}`);
      // Refresh applicants
      if (selectedJobApplicants) fetchApplicants(selectedJobApplicants);
      fetchScheduledInterviews();
    } catch (err)
    {
      console.error('Schedule interview error:', err);
      alert(err.response?.data?.error||'Failed to schedule interview');
    } finally
    {
      setSchedulingCandidate(null);
    }
  };

  const handleCopyLink=(sessionId) =>
  {
    const fullLink=`${window.location.origin}/interview/${sessionId}?mode=candidate`;
    navigator.clipboard.writeText(fullLink).then(() =>
    {
      setCopiedLink(sessionId);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  };

  const handleJoinAsRecruiter=(sessionId) =>
  {
    navigate(`/interview/${sessionId}?mode=recruiter&name=${encodeURIComponent(user?.username||user?.name||'Recruiter')}&role=recruiter`);
  };

  const fetchScheduledInterviews=async () =>
  {
    try
    {
      // Fetch interviews for all user's jobs
      const jobsRes=await api.get(`/jobs/company/${user?.id}`).catch(() => ({data: {jobs: []}}));
      const realJobs=jobsRes.data.jobs||[];
      const allInterviews=[];
      for (const j of realJobs.slice(0, 10))
      {
        try
        {
          const res=await getJobInterviews(j.id||j._id);
          const ivs=(res.data?.data||res.data||[]).map(iv => ({...iv, jobTitle: j.title}));
          allInterviews.push(...ivs);
        } catch {}
      }
      setScheduledInterviews(allInterviews);
    } catch (err)
    {
      console.error('Fetch scheduled interviews error:', err);
    }
  };

  useEffect(() =>
  {
    try
    {
      const stored=localStorage.getItem('user');
      if (stored)
      {
        const u=JSON.parse(stored);
        setUser(u);
        fetchCompanyData(u.id);
      } else
      {
        navigate('/login');
      }
    } catch
    {
      navigate('/login');
    }
  }, [navigate]);

  // Fetch scheduled interviews once user is loaded
  useEffect(() =>
  {
    if (user?.id) fetchScheduledInterviews();
  }, [user?.id]);

  // Fetch all candidates job-wise when switching to candidates tab
  useEffect(() =>
  {
    if (activeTab==='candidates'&&jobs.length>0&&!selectedJobApplicants)
    {
      fetchAllCandidatesByJob(jobs);
    }
  }, [activeTab, jobs.length]);

  const fetchCompanyData=async (userId) =>
  {
    try
    {
      const [jobsRes, statsRes]=await Promise.all([
        api.get(`/jobs/company/${userId}`).catch(() => ({data: {jobs: []}})),
        api.get(`/jobs/company-stats/${userId}`).catch(() => ({data: {}})),
      ]);
      const realJobs=jobsRes.data.jobs||[];
      setJobs(realJobs);
      const s=statsRes.data;
      setCompanyStats({
        activeJobs: s.activeJobs||realJobs.filter(j => j.status==='active').length,
        totalApplicants: s.totalApplicants||realJobs.reduce((sum, j) => sum+(j.applicantCount||0), 0),
        inInterview: s.inInterview||0,
        offered: s.offered||0,
        hired: s.hired||0,
      });
    } catch (err)
    {
      console.error('Fetch company data error:', err);
    } finally
    {
      setLoadingJobs(false);
    }
  };

  // ─── Fetch Leaderboard ───
  const fetchLeaderboard=async (userId, jobFilter) =>
  {
    setLoadingLeaderboard(true);
    try
    {
      const params=jobFilter&&jobFilter!=='all'? `?jobId=${jobFilter}&limit=50`:'?limit=50';
      const res=await api.get(`/jobs/leaderboard/${userId}${params}`);
      setLeaderboard(res.data.leaderboard||[]);
      setLeaderboardJobs(res.data.jobs||[]);
    } catch (err)
    {
      console.error('Fetch leaderboard error:', err);
    } finally
    {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() =>
  {
    if (user&&activeTab==='overview') fetchLeaderboard(user.id, leaderboardFilter);
  }, [user, activeTab, leaderboardFilter]);

  const fetchAllCandidatesByJob=async (_jobsList) =>
  {
    if (!user?.id) return;
    setLoadingAllCandidates(true);
    try
    {
      const res=await api.get(`/jobs/company/${user.id}/all-applicants`);
      const applicants=res.data.applicants||[];
      // Group by jobId → { [jobId]: { title, applicants[] } }
      const result={};
      for (const app of applicants)
      {
        const jid=String(app.jobId);
        if (!result[jid]) result[jid]={title: app.jobTitle, applicants: []};
        result[jid].applicants.push(app);
      }
      setJobWiseCandidates(result);
    } catch (err)
    {
      console.error('fetchAllCandidatesByJob error:', err);
    } finally
    {
      setLoadingAllCandidates(false);
    }
  };

  const handleLogout=() =>
  {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('storage'));
    navigate('/login');
  };

  const handlePostJob=async () =>
  {
    if (!jobForm.title||!jobForm.department) return;
    try
    {
      const skillsArray=jobForm.skills? jobForm.skills.split(',').map(s => s.trim()).filter(Boolean):[];
      const requiredSkillsArray=jobForm.requiredSkills? jobForm.requiredSkills.split(',').map(s => s.trim()).filter(Boolean):[];
      const preferredSkillsArray=jobForm.preferredSkills? jobForm.preferredSkills.split(',').map(s => s.trim()).filter(Boolean):[];
      const educationArray=jobForm.requiredEducation? jobForm.requiredEducation.split(',').map(s => s.trim()).filter(Boolean):[];

      const res=await api.post('/jobs', {
        title: jobForm.title,
        department: jobForm.department,
        location: jobForm.location,
        type: jobForm.type,
        description: jobForm.description,
        requirements: jobForm.requirements,
        skills: skillsArray,
        salary: {
          min: jobForm.salaryMin? parseInt(jobForm.salaryMin):0,
          max: jobForm.salaryMax? parseInt(jobForm.salaryMax):0,
          currency: 'INR',
        },
        eligibilityCriteria: {
          minCGPA: jobForm.minCGPA? parseFloat(jobForm.minCGPA):0,
          requiredSkills: requiredSkillsArray,
          preferredSkills: preferredSkillsArray,
          minExperience: jobForm.minExperience? parseInt(jobForm.minExperience):0,
          maxExperience: jobForm.maxExperience? parseInt(jobForm.maxExperience):0,
          requiredEducation: educationArray,
          autoShortlist: jobForm.autoShortlist,
          minATSScore: jobForm.minATSScore? parseInt(jobForm.minATSScore):60,
        },
        userId: user.id,
        companyName: user.companyName||user.username,
      });
      setJobs([res.data.job, ...jobs]);
      setJobForm({title: '', department: '', location: 'Remote', type: 'Full-Time', description: '', requirements: '', skills: '', minCGPA: '', requiredSkills: '', preferredSkills: '', minExperience: '', maxExperience: '', requiredEducation: '', autoShortlist: false, minATSScore: 60, salaryMin: '', salaryMax: ''});
      setShowPostJobModal(false);
      // Refresh stats
      fetchCompanyData(user.id);
    } catch (err)
    {
      alert(err.response?.data?.message||'Failed to post job');
    }
  };

  const handleBulkShortlist=async (jobId) =>
  {
    setShortlisting(true);
    try
    {
      const res=await api.post(`/jobs/${jobId}/shortlist`, {minATSScore: shortlistThreshold, changedBy: user.id});
      alert(res.data.message||'Shortlisting complete');
      fetchApplicants(jobId);
    } catch (err)
    {
      alert(err.response?.data?.message||'Shortlisting failed');
    } finally {setShortlisting(false);}
  };

  const handleRescore=async (jobId) =>
  {
    setRescoring(true);
    try
    {
      const res=await api.post(`/jobs/${jobId}/rescore`);
      alert(res.data.message||'Re-scoring complete');
      fetchApplicants(jobId);
    } catch (err)
    {
      alert(err.response?.data?.message||'Re-scoring failed');
    } finally {setRescoring(false);}
  };

  const fetchApplicants=async (jobId) =>
  {
    try
    {
      const res=await api.get(`/jobs/${jobId}/applicants`, {params: {sortBy: candidateSort, filterStatus: candidateFilter}});
      setCandidates(res.data.applicants||[]);
    } catch (err)
    {
      console.error('Fetch applicants error:', err);
    }
  };

  const getScoreColor=(score) =>
  {
    if (score>=80) return '#22c55e';
    if (score>=60) return '#f59e0b';
    if (score>=40) return '#f97316';
    return '#ef4444';
  };

  const getScoreClass=(score) =>
  {
    if (score>=80) return 'high';
    if (score>=60) return 'mid';
    return 'low';
  };

  const timeAgo=(dateStr) =>
  {
    const diff=Date.now()-new Date(dateStr).getTime();
    const days=Math.floor(diff/86400000);
    if (days===0) return 'Today';
    if (days===1) return 'Yesterday';
    if (days<7) return `${days}d ago`;
    return `${Math.floor(days/7)}w ago`;
  };

  const initials=(user?.username||'C').charAt(0).toUpperCase();

  const hireRateNum=companyStats.totalApplicants>0? Math.round((companyStats.hired/companyStats.totalApplicants)*100):0;

  // ─── ApexCharts: Sparkline data (30-day simulated trends) ───
  const sparkData=useMemo(() => ({
    jobs: [2, 3, 2, 4, 3, 5, 4, 6, 5, 4, 6, 5, 7, 6, 5, 7, 6, 8, 7, 6, 8, 7, 9, 8, 7, 9, 8, 10, 9, companyStats.activeJobs||jobs.length||3],
    applicants: [5, 8, 6, 12, 10, 14, 11, 18, 15, 20, 17, 22, 19, 25, 21, 28, 24, 30, 26, 32, 28, 35, 31, 38, 34, 40, 36, 42, 38, companyStats.totalApplicants||0],
    offered: [0, 0, 1, 0, 1, 1, 0, 1, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 2, 3, 2, 2, 3, 2, 3, 3, 2, 3, 3, companyStats.offered||0],
    hireRate: [0, 0, 5, 3, 8, 6, 10, 8, 12, 10, 14, 12, 15, 13, 16, 14, 18, 15, 20, 17, 22, 18, 24, 20, 26, 22, 28, 24, 30, hireRateNum],
  }), [companyStats, jobs.length, hireRateNum]);

  const makeSparkOpts=(color) => ({
    chart: {type: 'area', sparkline: {enabled: true}, animations: {enabled: true, easing: 'easeinout', speed: 800}},
    stroke: {curve: 'smooth', width: 2, colors: [color]},
    fill: {type: 'gradient', gradient: {shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100], colorStops: [{offset: 0, color, opacity: 0.35}, {offset: 100, color, opacity: 0.05}]}},
    tooltip: {enabled: false},
    colors: [color],
  });

  // ─── ApexCharts: Radial Bar for AI Fit Score ───
  const aiFitScore=85;
  const radialOpts=useMemo(() => ({
    chart: {type: 'radialBar', sparkline: {enabled: true}},
    plotOptions: {
      radialBar: {
        startAngle: -135, endAngle: 135,
        hollow: {size: '60%'},
        track: {background: 'rgba(255,107,53,0.12)', strokeWidth: '100%'},
        dataLabels: {
          name: {show: true, fontSize: '11px', color: '#FFB366', offsetY: 18, fontFamily: 'inherit'},
          value: {show: true, fontSize: '1.5rem', fontWeight: 800, color: '#FFE0CC', offsetY: -12, fontFamily: 'inherit', formatter: (v) => `${v}%`},
        },
      }
    },
    stroke: {lineCap: 'round'},
    fill: {type: 'gradient', gradient: {shade: 'dark', type: 'horizontal', shadeIntensity: 0.5, gradientToColors: ['#FF8C42'], stops: [0, 100]}},
    colors: ['#FF6B35'],
    labels: ['AI Fit'],
  }), []);

  // ─── ApexCharts: Funnel (Hiring Pipeline) ───
  const funnelSeries=useMemo(() => [{
    data: [
      companyStats.totalApplicants||11,
      Math.max(Math.round((companyStats.totalApplicants||11)*0.8), companyStats.inInterview||10),
      companyStats.inInterview||8,
      companyStats.offered||3,
      companyStats.hired||1,
    ],
  }], [companyStats]);
  const funnelOpts=useMemo(() => ({
    chart: {type: 'bar', toolbar: {show: false}, background: 'transparent'},
    plotOptions: {bar: {borderRadius: 4, horizontal: true, barHeight: '70%', distributed: true, isFunnel: true}},
    colors: ['#7A2E10', '#B8431A', '#FF6B35', '#FF8C42', '#FFB366'],
    dataLabels: {enabled: true, formatter: (v, {dataPointIndex: i}) => `${['Applied', 'Assessment', 'Interview', 'Offered', 'Hired'][i]}: ${v}`, style: {fontSize: '12px', fontFamily: 'inherit', colors: ['#fff']}, dropShadow: {enabled: false}},
    xaxis: {categories: ['Applied', 'Assessment', 'Interview', 'Offered', 'Hired'], labels: {show: false}},
    yaxis: {labels: {show: false}},
    grid: {show: false},
    legend: {show: false},
    tooltip: {enabled: true, theme: 'dark', style: {fontFamily: 'inherit'}},
    states: {hover: {filter: {type: 'lighten', value: 0.15}}},
  }), []);

  // ─── ApexCharts: Radar (AI Skill Gap) ───
  const radarSeries=useMemo(() => [
    {name: 'Required', data: [90, 85, 70, 80, 75]},
    {name: 'Candidate Pool Avg', data: [72, 68, 55, 62, 80]},
  ], []);
  const radarOpts=useMemo(() => ({
    chart: {type: 'radar', toolbar: {show: false}, background: 'transparent', dropShadow: {enabled: true, blur: 4, top: 1, left: 0, opacity: 0.12}},
    stroke: {width: 2},
    fill: {opacity: 0.2},
    markers: {size: 3, strokeWidth: 1},
    colors: ['#FF6B35', '#E5E5E5'],
    xaxis: {categories: ['React', 'Node.js', 'System Design', 'Algorithms', 'Communication']},
    yaxis: {show: false, min: 0, max: 100},
    legend: {position: 'bottom', fontSize: '11px', fontFamily: 'inherit', labels: {colors: '#a1a1aa'}, markers: {size: 8, shape: 'circle'}},
    tooltip: {enabled: true, theme: 'dark', style: {fontFamily: 'inherit'}},
    plotOptions: {radar: {polygons: {strokeColors: 'rgba(255,255,255,0.06)', connectorColors: 'rgba(255,255,255,0.06)', fill: {colors: ['rgba(255,255,255,0.01)', 'transparent']}}}},
  }), []);

  // ─── ApexCharts: Heatmap (Assessment Performance) ───
  const heatSeries=useMemo(() => [
    {name: 'Senior React Dev', data: [{x: 'Live Quiz', y: 78}, {x: 'Coding Contest', y: 92}, {x: 'AI Interview', y: 85}, {x: 'System Design', y: 70}]},
    {name: 'Junior Developer', data: [{x: 'Live Quiz', y: 65}, {x: 'Coding Contest', y: 58}, {x: 'AI Interview', y: 72}, {x: 'System Design', y: 45}]},
    {name: 'Full Stack Eng', data: [{x: 'Live Quiz', y: 82}, {x: 'Coding Contest', y: 88}, {x: 'AI Interview', y: 79}, {x: 'System Design', y: 84}]},
    {name: 'DevOps Engineer', data: [{x: 'Live Quiz', y: 70}, {x: 'Coding Contest', y: 65}, {x: 'AI Interview', y: 75}, {x: 'System Design', y: 90}]},
  ], []);
  const heatOpts=useMemo(() => ({
    chart: {type: 'heatmap', toolbar: {show: false}, background: 'transparent'},
    dataLabels: {enabled: true, style: {fontSize: '12px', fontFamily: 'inherit', colors: ['#fff']}},
    colors: ['#FF6B35'],
    plotOptions: {
      heatmap: {
        radius: 4, enableShades: true, shadeIntensity: 0.8, colorScale: {
          ranges: [
            {from: 0, to: 40, color: '#241710', name: 'Low'},
            {from: 41, to: 60, color: '#5C2410', name: 'Medium'},
            {from: 61, to: 80, color: '#B8431A', name: 'Good'},
            {from: 81, to: 100, color: '#FF6B35', name: 'Excellent'},
          ]
        }
      }
    },
    xaxis: {labels: {style: {colors: '#a1a1aa', fontSize: '11px', fontFamily: 'inherit'}}},
    yaxis: {labels: {style: {colors: '#a1a1aa', fontSize: '11px', fontFamily: 'inherit'}}},
    grid: {show: false},
    legend: {show: false},
    tooltip: {theme: 'dark', style: {fontFamily: 'inherit'}},
    stroke: {width: 2, colors: ['#121212']},
  }), []);

  // ─── ApexCharts: Conversion Funnel (real data, horizontal bar) ───
  const convFunnelSeries=useMemo(() => [{
    name: 'Candidates',
    data: [
      companyStats.totalApplicants||0,
      companyStats.inInterview||0,
      companyStats.offered||0,
      companyStats.hired||0,
    ],
  }], [companyStats]);
  const convFunnelOpts=useMemo(() => ({
    chart: {type: 'bar', toolbar: {show: false}, background: 'transparent'},
    plotOptions: {bar: {borderRadius: 6, horizontal: true, barHeight: '60%', distributed: true}},
    colors: ['#FF6B35', '#FFB366', '#22c55e', '#eab308'],
    dataLabels: {enabled: true, style: {fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', colors: ['#fff']}, formatter: (v) => v, offsetX: 8},
    xaxis: {categories: ['Applied', 'Interview', 'Offered', 'Hired'], labels: {show: false}, axisBorder: {show: false}, axisTicks: {show: false}},
    yaxis: {labels: {style: {colors: '#a1a1aa', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit'}}},
    grid: {show: false},
    legend: {show: false},
    tooltip: {enabled: true, theme: 'dark', style: {fontFamily: 'inherit'}, y: {formatter: (v) => `${v} candidates`}},
    states: {hover: {filter: {type: 'lighten', value: 0.12}}},
  }), []);

  // ─── ApexCharts: Applicants per Job (horizontal bar) ───
  const jobApplicantSeries=useMemo(() => [{
    name: 'Applicants',
    data: jobs.slice(0, 8).map(j => j.applicantCount||0),
  }], [jobs]);
  const jobApplicantOpts=useMemo(() => ({
    chart: {type: 'bar', toolbar: {show: false}, background: 'transparent'},
    plotOptions: {bar: {borderRadius: 5, horizontal: true, barHeight: '55%', distributed: true}},
    colors: ['#B8431A', '#CC5429', '#FF6B35', '#FF8049', '#FF8C42', '#FFA35C', '#FFB366', '#FFC999'],
    dataLabels: {enabled: true, style: {fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', colors: ['#fff']}, offsetX: 5},
    xaxis: {categories: jobs.slice(0, 8).map(j => j.title? (j.title.length>22? j.title.substring(0, 22)+'…':j.title):'—'), labels: {show: false}, axisBorder: {show: false}, axisTicks: {show: false}},
    yaxis: {labels: {style: {colors: '#a1a1aa', fontSize: '11px', fontWeight: 500, fontFamily: 'inherit'}, maxWidth: 140}},
    grid: {show: false},
    legend: {show: false},
    tooltip: {enabled: true, theme: 'dark', style: {fontFamily: 'inherit'}, y: {formatter: (v) => `${v} applicants`}},
    states: {hover: {filter: {type: 'lighten', value: 0.12}}},
  }), [jobs]);

  // ─── Conversion rate helpers ───
  const interviewRate=companyStats.totalApplicants>0? Math.round((companyStats.inInterview/companyStats.totalApplicants)*100):0;
  const offerRate=companyStats.totalApplicants>0? Math.round((companyStats.offered/companyStats.totalApplicants)*100):0;

  if (!user) return null;

  return (
    <div className="cmpd-page">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="cmpd-navbar">
        <div className="cmpd-navbar-inner">
          <Link to="/company-dashboard" className="cmpd-logo">EDU-AI</Link>
          <div className="cmpd-nav-tabs">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                className={`cmpd-tab ${activeTab===t.key? 'active':''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <div className="cmpd-nav-right">
            <div className="cmpd-search-box">
              <Search size={16} />
              <input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button className="cmpd-icon-btn" title="Notifications"><Bell size={18} /></button>
            <button className="cmpd-icon-btn" title="Logout" onClick={handleLogout}><LogOut size={18} /></button>
            <div className="cmpd-avatar">{initials}</div>
          </div>
        </div>
      </nav>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="cmpd-main">
        <div className="cmpd-container">

          {/* OVERVIEW TAB */}
          {activeTab==='overview'&&(
            <>
              <div className="cmpd-welcome">
                <div>
                  <h1>Company Dashboard</h1>
                  <p>Welcome back, {user.username}. Here's your hiring overview.</p>
                </div>
                {features['company.overview.scoring_link'] !== false && (
                  <button className="cmpd-btn-secondary" onClick={() => navigate('/admin-scoring')}>
                    <Trophy size={16} /> Scoring & Rankings
                  </button>
                )}
                <button className="cmpd-btn-primary" onClick={() => {setActiveTab('jobs'); setShowPostJobModal(true);}}>
                  <Plus size={16} /> Post New Job
                </button>
              </div>

              {/* ═══ KPI CARDS ROW (5 Cards with Sparklines) ═══ */}
              <div className="ov-kpi-row">
                {features['company.overview.kpi_cards'] !== false && (
                  <>
                    {/* Active Jobs */}
                    <div className="ov-kpi-card">
                      <div className="ov-kpi-top">
                        <div className="ov-kpi-icon" style={{background: 'rgba(255,107,53,0.12)', color: '#FF8C42'}}><Briefcase size={18} /></div>
                        <div className="ov-kpi-trend up"><TrendingUp size={12} /> +15%</div>
                      </div>
                      <div className="ov-kpi-value">{companyStats.activeJobs||jobs.length}</div>
                      <div className="ov-kpi-label">Active Jobs</div>
                      <div className="ov-kpi-spark">
                        <Chart options={makeSparkOpts('#FF6B35')} series={[{data: sparkData.jobs}]} type="area" height={48} width="100%" />
                      </div>
                    </div>

                    {/* Applicants */}
                    <div className="ov-kpi-card">
                      <div className="ov-kpi-top">
                        <div className="ov-kpi-icon" style={{background: 'rgba(255,179,102,0.12)', color: '#FFB366'}}><Users size={18} /></div>
                        <div className="ov-kpi-trend up"><TrendingUp size={12} /> +23%</div>
                      </div>
                      <div className="ov-kpi-value">{companyStats.totalApplicants}</div>
                      <div className="ov-kpi-label">Applicants</div>
                      <div className="ov-kpi-spark">
                        <Chart options={makeSparkOpts('#FFB366')} series={[{data: sparkData.applicants}]} type="area" height={48} width="100%" />
                      </div>
                    </div>

                    {/* Offered */}
                    <div className="ov-kpi-card">
                      <div className="ov-kpi-top">
                        <div className="ov-kpi-icon" style={{background: 'rgba(255,140,66,0.12)', color: '#FF8C42'}}><Award size={18} /></div>
                        <div className="ov-kpi-trend up"><TrendingUp size={12} /> +8%</div>
                      </div>
                      <div className="ov-kpi-value">{companyStats.offered}</div>
                      <div className="ov-kpi-label">Offered</div>
                      <div className="ov-kpi-spark">
                        <Chart options={makeSparkOpts('#FF8C42')} series={[{data: sparkData.offered}]} type="area" height={48} width="100%" />
                      </div>
                    </div>

                    {/* Hire Rate */}
                    <div className="ov-kpi-card">
                      <div className="ov-kpi-top">
                        <div className="ov-kpi-icon" style={{background: 'rgba(34,197,94,0.12)', color: '#4ade80'}}><TrendingUp size={18} /></div>
                        <div className={`ov-kpi-trend ${hireRateNum>10? 'up':'down'}`}>
                          {hireRateNum>10? <TrendingUp size={12} />:<TrendingUp size={12} style={{transform: 'scaleY(-1)'}} />}
                          {hireRateNum>10? '+5%':'-2%'}
                        </div>
                      </div>
                      <div className="ov-kpi-value">{hireRateNum}%</div>
                      <div className="ov-kpi-label">Hire Rate</div>
                      <div className="ov-kpi-spark">
                        <Chart options={makeSparkOpts('#22c55e')} series={[{data: sparkData.hireRate}]} type="area" height={48} width="100%" />
                      </div>
                    </div>
                  </>
                )}

                {/* Avg AI Fit Score — Radial Bar */}
                {features['company.overview.ai_fit_score'] !== false && (
                  <div className="ov-kpi-card ov-kpi-radial">
                    <div className="ov-kpi-top">
                      <div className="ov-kpi-icon" style={{background: 'rgba(255,107,53,0.12)', color: '#FF8C42'}}><Brain size={18} /></div>
                    </div>
                    <div className="ov-kpi-label" style={{marginBottom: 4}}>Avg. AI Fit Score</div>
                    <div className="ov-kpi-radial-chart">
                      <Chart options={radialOpts} series={[aiFitScore]} type="radialBar" height={140} width={140} />
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ MIDDLE SECTION: Pipeline, Radar, Heatmap ═══ */}
              <div className="ov-mid-row">
                {/* Widget A: Hiring Pipeline Funnel */}
                {features['company.overview.hiring_pipeline'] !== false && (
                  <div className="ov-panel">
                    <div className="ov-panel-header">
                      <div className="ov-panel-title"><Activity size={16} /> Hiring Pipeline</div>
                      <span className="ov-panel-badge">{companyStats.totalApplicants||0} total</span>
                    </div>
                    <div className="ov-panel-body">
                      <Chart options={funnelOpts} series={funnelSeries} type="bar" height={260} />
                    </div>
                  </div>
                )}

                {/* Widget B: AI Skill Gap Radar */}
                {features['company.overview.skill_gap_radar'] !== false && (
                  <div className="ov-panel">
                    <div className="ov-panel-header">
                      <div className="ov-panel-title"><Target size={16} /> AI Skill Gap Radar</div>
                      <span className="ov-panel-badge-purple">Required vs Pool</span>
                    </div>
                    <div className="ov-panel-body">
                      <Chart options={radarOpts} series={radarSeries} type="radar" height={280} />
                    </div>
                  </div>
                )}

                {/* Widget C: Assessment Heatmap */}
                {features['company.overview.assessment_heatmap'] !== false && (
                  <div className="ov-panel">
                    <div className="ov-panel-header">
                      <div className="ov-panel-title"><BarChart3 size={16} /> Assessment Heatmap</div>
                      <span className="ov-panel-badge-green">Performance</span>
                    </div>
                    <div className="ov-panel-body">
                      <Chart options={heatOpts} series={heatSeries} type="heatmap" height={260} />
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ ANALYTICS SECTION: Funnel + Applicants per Job + Rates ═══ */}
              <div className="ov-analytics-row">
                {/* Hiring Funnel */}
                {features['company.overview.hiring_funnel'] !== false && (
                  <div className="ov-panel">
                    <div className="ov-panel-header">
                      <div className="ov-panel-title"><Activity size={16} /> Hiring Funnel</div>
                      <span className="ov-panel-badge">{companyStats.totalApplicants||0} applicants</span>
                    </div>
                    <div className="ov-panel-body">
                      {companyStats.totalApplicants===0? (
                        <div className="ov-empty">No applicants yet — post a job to populate the funnel</div>
                      ):(
                        <Chart options={convFunnelOpts} series={convFunnelSeries} type="bar" height={220} />
                      )}
                    </div>
                  </div>
                )}

                {/* Applicants per Job */}
                {features['company.overview.applicants_per_job'] !== false && (
                  <div className="ov-panel">
                    <div className="ov-panel-header">
                      <div className="ov-panel-title"><Briefcase size={16} /> Applicants per Job</div>
                      <span className="ov-panel-badge-purple">{jobs.length} job{jobs.length!==1? 's':''}</span>
                    </div>
                    <div className="ov-panel-body">
                      {jobs.length===0? (
                        <div className="ov-empty">No jobs posted yet</div>
                      ):(
                        <Chart options={jobApplicantOpts} series={jobApplicantSeries} type="bar" height={Math.max(180, jobs.slice(0, 8).length*40)} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ CONVERSION RATE CARDS ═══ */}
              {features['company.overview.conversion_rates'] !== false && (
                <div className="ov-rates-row">
                  <div className="ov-rate-card">
                    <div className="ov-rate-icon" style={{background: 'rgba(255,107,53,0.1)', color: '#FF8C42'}}><Users size={18} /></div>
                    <div className="ov-rate-info">
                      <span className="ov-rate-value">{interviewRate}%</span>
                      <span className="ov-rate-label">Interview Rate</span>
                    </div>
                    <div className="ov-rate-bar"><div className="ov-rate-fill" style={{width: `${interviewRate}%`, background: '#FF6B35'}} /></div>
                  </div>
                  <div className="ov-rate-card">
                    <div className="ov-rate-icon" style={{background: 'rgba(34,197,94,0.1)', color: '#4ade80'}}><Award size={18} /></div>
                    <div className="ov-rate-info">
                      <span className="ov-rate-value">{offerRate}%</span>
                      <span className="ov-rate-label">Offer Rate</span>
                    </div>
                    <div className="ov-rate-bar"><div className="ov-rate-fill" style={{width: `${offerRate}%`, background: '#22c55e'}} /></div>
                  </div>
                  <div className="ov-rate-card">
                    <div className="ov-rate-icon" style={{background: 'rgba(234,179,8,0.1)', color: '#facc15'}}><TrendingUp size={18} /></div>
                    <div className="ov-rate-info">
                      <span className="ov-rate-value">{hireRateNum}%</span>
                      <span className="ov-rate-label">Hire Rate</span>
                    </div>
                    <div className="ov-rate-bar"><div className="ov-rate-fill" style={{width: `${hireRateNum}%`, background: '#eab308'}} /></div>
                  </div>
                </div>
              )}

              {/* ═══ BOTTOM SECTION: Recent Postings & Upcoming Interviews ═══ */}
              <div className="ov-bottom-row">
                {/* Recent Postings */}
                {features['company.overview.recent_postings'] !== false && (
                  <div className="ov-panel">
                    <div className="ov-panel-header">
                      <div className="ov-panel-title"><Briefcase size={16} /> Recent Postings</div>
                      <button className="cmpd-link-btn" onClick={() => setActiveTab('jobs')}>View All <ArrowUpRight size={14} /></button>
                    </div>
                    <div className="ov-panel-list">
                      {jobs.length===0? (
                        <div className="ov-empty">No jobs posted yet</div>
                      ):jobs.slice(0, 4).map((job) => (
                        <div className="ov-list-item" key={job._id||job.id}>
                          <div className="ov-list-icon"><Briefcase size={16} /></div>
                          <div className="ov-list-info">
                            <div className="ov-list-title">{job.title}</div>
                            <div className="ov-list-sub">{job.department} · {job.location} · {timeAgo(job.createdAt)}</div>
                          </div>
                          <div className="ov-list-right">
                            <span className="ov-applicant-pill"><Users size={12} /> {job.applicantCount||0}</span>
                            <span className={`ov-status-badge ${job.status}`}>{job.status}</span>
                            <button className="ov-ai-insights-btn" title="AI Insights"><Brain size={13} /> Insights</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Interviews */}
                {features['company.overview.upcoming_interviews'] !== false && (
                  <div className="ov-panel">
                    <div className="ov-panel-header">
                      <div className="ov-panel-title"><Calendar size={16} /> Upcoming Interviews</div>
                      <button className="cmpd-link-btn" onClick={() => setActiveTab('interviews')}>View All <ArrowUpRight size={14} /></button>
                    </div>
                    <div className="ov-panel-list">
                      {scheduledInterviews.filter(iv => iv.status==='scheduled'||iv.status==='active').length===0? (
                        <div className="ov-empty">
                          <Calendar size={28} style={{opacity: 0.15, marginBottom: 6}} />
                          <span>No upcoming interviews</span>
                        </div>
                      ):scheduledInterviews
                        .filter(iv => iv.status==='scheduled'||iv.status==='active')
                        .slice(0, 4)
                        .map((iv) => (
                          <div className="ov-list-item" key={iv.sessionId}>
                            <div className="ov-list-icon ov-list-icon-interview"><Video size={16} /></div>
                            <div className="ov-list-info">
                              <div className="ov-list-title">{iv.candidateName||'Candidate'}</div>
                              <div className="ov-list-sub">
                                <Clock size={11} /> {iv.scheduledAt? new Date(iv.scheduledAt).toLocaleString():'TBD'}
                                {iv.jobTitle&&<> · {iv.jobTitle}</>}
                              </div>
                            </div>
                            <div className="ov-list-right">
                              <span className="ov-ai-match-badge">{Math.floor(70+Math.random()*25)}% Match</span>
                              <button className="ov-iv-action-btn" title="View AI Report" onClick={() => setSelectedCandidate(iv)}>
                                <FileBarChart size={14} />
                              </button>
                              <button className="ov-iv-action-btn ov-iv-join" title="Join Room" onClick={() => handleJoinAsRecruiter(iv.sessionId)}>
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ CANDIDATE LEADERBOARD ═══ */}
              {features['company.overview.leaderboard'] !== false && (
                <div className="ov-panel ov-leaderboard-panel">
                  <div className="ov-panel-header">
                    <div className="ov-panel-title"><Crown size={16} /> Candidate Leaderboard</div>
                    <div className="ov-lb-controls">
                      <select
                        className="ov-lb-filter"
                        value={leaderboardFilter}
                        onChange={(e) => setLeaderboardFilter(e.target.value)}
                      >
                        <option value="all">All Jobs</option>
                        {leaderboardJobs.map(j => (
                          <option key={j.id} value={j.id}>{j.title}</option>
                        ))}
                      </select>
                      <span className="ov-panel-badge">{leaderboard.length} candidates</span>
                    </div>
                  </div>

                  {loadingLeaderboard? (
                    <div className="ov-empty"><Loader size={20} className="ov-spin" /> Loading leaderboard...</div>
                  ):leaderboard.length===0? (
                    <div className="ov-empty">
                      <Users size={28} style={{opacity: 0.15, marginBottom: 6}} />
                      <span>No candidates yet — applicants will appear here ranked by score</span>
                    </div>
                  ):(
                    <div className="ov-lb-table-wrap">
                      <table className="ov-lb-table">
                        <thead>
                          <tr>
                            <th style={{width: 48}}><Hash size={13} /></th>
                            <th>Candidate</th>
                            <th>Applied For</th>
                            <th>ATS</th>
                            <th>Skill Match</th>
                            <th>CGPA</th>
                            <th>Composite</th>
                            <th>Status</th>
                            <th style={{width: 120}}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((c) => (
                            <tr key={c.candidateId} className={c.rank<=3? `ov-lb-top${c.rank}`:''}>
                              <td>
                                <span className={`ov-lb-rank ${c.rank<=3? 'ov-lb-rank-top':''}`}>
                                  {c.rank<=3? <Crown size={12} />:c.rank}
                                </span>
                              </td>
                              <td>
                                <div className="ov-lb-candidate">
                                  <div className="ov-lb-avatar">{(c.name||'?').charAt(0).toUpperCase()}</div>
                                  <div className="ov-lb-cinfo">
                                    <span className="ov-lb-cname">{c.name}</span>
                                    <span className="ov-lb-cemail">{c.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td><span className="ov-lb-job">{c.jobTitle}</span></td>
                              <td><span className={`ov-lb-score ${c.atsScore>=70? 'high':c.atsScore>=40? 'mid':'low'}`}>{c.atsScore}</span></td>
                              <td><span className={`ov-lb-score ${c.skillMatchScore>=70? 'high':c.skillMatchScore>=40? 'mid':'low'}`}>{c.skillMatchScore}</span></td>
                              <td className="ov-lb-cgpa">{c.cgpa>0? c.cgpa.toFixed(1):'—'}</td>
                              <td><span className="ov-lb-composite">{c.compositeScore}</span></td>
                              <td>
                                <span className={`ov-status-badge ${c.status}`}>{c.status}</span>
                              </td>
                              <td>
                                <div className="ov-lb-actions">
                                  {c.phone? (
                                    <a href={`tel:${c.phone}`} className="ov-lb-call-btn" title={`Call ${c.phone}`}>
                                      <Phone size={13} /> Call
                                    </a>
                                  ):(
                                    <a href={`mailto:${c.email}`} className="ov-lb-call-btn ov-lb-mail" title={`Email ${c.email}`}>
                                      <Mail size={13} /> Email
                                    </a>
                                  )}
                                  <button className="ov-lb-view-btn" title="View Profile" onClick={() => setSelectedCandidate({candidateId: c.candidateId, candidateName: c.name, candidateEmail: c.email})}>
                                    <Eye size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* JOBS TAB */}
          {activeTab==='jobs'&&(
            <>
              <div className="cmpd-welcome">
                <div>
                  <h1>Job Postings</h1>
                  <p>Manage your active job listings</p>
                </div>
                <button className="cmpd-btn-primary" onClick={() => setShowPostJobModal(true)}>
                  <Plus size={16} /> Post New Job
                </button>
              </div>

              <div className="cmpd-jobs-grid">
                {jobs.length===0? (
                  <div style={{padding: '40px', textAlign: 'center', color: '#737373', gridColumn: '1 / -1'}}>
                    <Briefcase size={48} style={{marginBottom: 12, opacity: 0.3}} />
                    <h3 style={{color: '#a3a3a3'}}>No jobs posted yet</h3>
                    <p>Click "Post New Job" to create your first listing</p>
                  </div>
                ):jobs.map((job) => (
                  <div className="cmpd-job-card" key={job._id||job.id}>
                    <div className="cmpd-job-top">
                      <div className="cmpd-job-icon"><Briefcase size={20} /></div>
                      <span className={`cmpd-status-pill ${job.status}`}>{job.status}</span>
                    </div>
                    <h3>{job.title}</h3>
                    <div className="cmpd-job-tags">
                      <span><Building2 size={13} /> {job.department}</span>
                      <span><MapPin size={13} /> {job.location}</span>
                      <span><Clock size={13} /> {job.type}</span>
                    </div>
                    <div className="cmpd-job-footer">
                      <span><Users size={14} /> {job.applicantCount||0} applicants</span>
                      <span className="cmpd-job-date">{timeAgo(job.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CANDIDATES TAB */}
          {activeTab==='candidates'&&(
            <>
              <div className="cmpd-welcome ats-welcome">
                <div>
                  <h1><Target size={24} /> Candidate Management & ATS Screening</h1>
                  <p>AI-powered applicant tracking with skill matching, eligibility scoring, and auto-shortlisting</p>
                </div>
                <div className="ats-top-actions">
                  <div className="ats-job-pills">
                    <button className={`ats-pill ${!selectedJobApplicants? 'active':''}`} onClick={() => {setSelectedJobApplicants(null); setCandidates([]); fetchAllCandidatesByJob(jobs);}}>
                      <Users size={14} /> All Jobs
                    </button>
                    {jobs.map((j) => (
                      <button key={j.id||j._id} className={`ats-pill ${selectedJobApplicants===(j.id||j._id)? 'active':''}`} onClick={() => {setSelectedJobApplicants(j.id||j._id); fetchApplicants(j.id||j._id);}}>
                        <Briefcase size={13} /> {j.title.substring(0, 20)}{j.title.length>20? '…':''} <span className="ats-pill-count">{j.applicantCount||0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Single-job view with ATS */}
              {selectedJobApplicants? (
                <>
                  {/* ATS Action Bar */}
                  <div className="ats-action-bar">
                    <div className="ats-action-left">
                      <div className="ats-select-wrap">
                        <Filter size={14} />
                        <select className="ats-select" value={candidateSort} onChange={(e) => {setCandidateSort(e.target.value); setTimeout(() => fetchApplicants(selectedJobApplicants), 0);}}>
                          <option value="atsScore">Sort: ATS Score</option>
                          <option value="skillMatch">Sort: Skill Match</option>
                          <option value="cgpa">Sort: CGPA</option>
                          <option value="date">Sort: Date Applied</option>
                        </select>
                      </div>
                      <div className="ats-select-wrap">
                        <Activity size={14} />
                        <select className="ats-select" value={candidateFilter} onChange={(e) => {setCandidateFilter(e.target.value); setTimeout(() => fetchApplicants(selectedJobApplicants), 0);}}>
                          <option value="all">All Status</option>
                          <option value="applied">Applied</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="not_eligible">Not Eligible</option>
                          <option value="rejected">Rejected</option>
                          <option value="interview">Interview</option>
                        </select>
                      </div>
                    </div>
                    <div className="ats-action-right">
                      <div className="ats-threshold-group">
                        <label>Min Score:</label>
                        <input type="number" min="0" max="100" value={shortlistThreshold} onChange={(e) => setShortlistThreshold(parseInt(e.target.value)||0)} className="ats-threshold-input" />
                        <span className="ats-threshold-pct">%</span>
                      </div>
                      {features['company.candidates.bulk_shortlist'] !== false && (
                        <button className="ats-btn ats-btn-shortlist" onClick={() => handleBulkShortlist(selectedJobApplicants)} disabled={shortlisting}>
                          <CheckCircle2 size={14} /> {shortlisting? 'Processing...':'Bulk Shortlist'}
                        </button>
                      )}
                      {features['company.candidates.rescore'] !== false && (
                        <button className="ats-btn ats-btn-rescore" onClick={() => handleRescore(selectedJobApplicants)} disabled={rescoring}>
                          <RefreshCw size={14} className={rescoring? 'spin':''} /> {rescoring? 'Rescoring...':'Re-score All'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Candidates Table */}
                  <div className="ats-table-wrapper">
                    <div className="ats-table-header">
                      <h3><Users size={16} /> {jobs.find(j => (j.id||j._id)===selectedJobApplicants)?.title||'Job'}</h3>
                      <span className="ats-table-count">{candidates.length} applicant{candidates.length!==1? 's':''}</span>
                    </div>
                    <div className="cmpd-table-responsive">
                      <table className="ats-table">
                        <thead>
                          <tr>
                            <th>Candidate</th>
                            <th style={{textAlign: 'center'}}>ATS Score</th>
                            <th>Skill Match</th>
                            <th style={{textAlign: 'center'}}>CGPA</th>
                            <th>Skills</th>
                            <th style={{textAlign: 'center'}}>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidates.length===0? (
                            <tr><td colSpan="7" className="ats-empty-row">
                              <Users size={32} style={{opacity: 0.2, marginBottom: 8}} />
                              <div>No applicants yet for this job</div>
                            </td></tr>
                          ):candidates.map((c) => (
                            <tr key={c.id} className={`ats-row ${!c.eligible? 'ineligible':c.atsScore>=70? 'good':c.atsScore>=40? 'mid':''}`}>
                              <td>
                                <div className="ats-cand-cell">
                                  <div className="ats-cand-avatar" style={{background: `linear-gradient(135deg, ${getScoreColor(c.atsScore)}44, ${getScoreColor(c.atsScore)})`}}>
                                    {(c.candidate?.name||'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="ats-cand-name">{c.candidate?.name||'Unknown'}</div>
                                    <div className="ats-cand-email">{c.candidate?.email||''}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{textAlign: 'center'}}>
                                <div className="ats-score-ring" style={{'--score-color': getScoreColor(c.atsScore), '--score-pct': `${(c.atsScore||0)*3.6}deg`}}>
                                  <span className="ats-score-num">{c.atsScore||0}</span>
                                </div>
                              </td>
                              <td>
                                <div className="ats-match-bar-cell">
                                  <div className="ats-match-track">
                                    <div className="ats-match-fill" style={{width: `${c.skillMatchScore||0}%`, background: `linear-gradient(90deg, ${getScoreColor(c.skillMatchScore)}88, ${getScoreColor(c.skillMatchScore)})`}}></div>
                                  </div>
                                  <span className="ats-match-pct" style={{color: getScoreColor(c.skillMatchScore)}}>{c.skillMatchScore||0}%</span>
                                </div>
                              </td>
                              <td style={{textAlign: 'center'}}>
                                <span className={`ats-cgpa-badge ${c.cgpa>=8? 'high':c.cgpa>=6? 'mid':c.cgpa>0? 'low':'none'}`}>
                                  {c.cgpa>0? c.cgpa.toFixed(1):'—'}
                                </span>
                              </td>
                              <td>
                                <div className="ats-skills-cell">
                                  {(c.matchedSkills||[]).slice(0, 3).map((s, i) => (
                                    <span key={i} className="ats-chip matched"><Check size={10} /> {s}</span>
                                  ))}
                                  {(c.missingSkills||[]).slice(0, 2).map((s, i) => (
                                    <span key={`m${i}`} className="ats-chip missing"><X size={10} /> {s}</span>
                                  ))}
                                  {((c.matchedSkills?.length||0)+(c.missingSkills?.length||0))>5&&(
                                    <span className="ats-chip more">+{(c.matchedSkills?.length||0)+(c.missingSkills?.length||0)-5}</span>
                                  )}
                                </div>
                              </td>
                              <td style={{textAlign: 'center'}}>
                                <span className={`ats-status-badge ${c.status}`}>
                                  {(c.status||'').replace(/_/g, ' ')}
                                </span>
                                {!c.eligible&&<div className="ats-not-eligible-tag">Not Eligible</div>}
                              </td>
                              <td>
                                <div className="ats-actions">
                                  <button className="ats-act-btn view" title="View Details" onClick={() => setSelectedCandidate(c)}><Eye size={14} /></button>
                                  {c.resumeUrl&&(
                                    <a className="ats-act-btn resume" href={c.resumeUrl} target="_blank" rel="noopener noreferrer" title="View Resume" onClick={(e) => e.stopPropagation()}><FileText size={14} /></a>
                                  )}
                                  {c.status!=='interview'&&c.status!=='rejected'&&c.eligible&&features['company.candidates.schedule_interview'] !== false&&(
                                    <button className="ats-act-btn schedule" onClick={() => handleScheduleInterview(c, selectedJobApplicants, c.id)} disabled={schedulingCandidate===c.candidate?.id} title="Schedule Interview">
                                      <Video size={14} />
                                    </button>
                                  )}
                                  {c.status==='interview'&&<span className="ats-scheduled-tag">Scheduled</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ):(
                /* Job-wise view (All Jobs selected) */
                features['company.candidates.job_wise_view'] === false ? (
                  <div className="ats-empty-state">
                    <Users size={48} />
                    <h3>Job-wise Overview Disabled</h3>
                    <p>The job-wise overview is disabled by the administrator. Please select a specific job to view applicants.</p>
                  </div>
                ) : (
                  <div className="ats-overview-grid">
                    {loadingAllCandidates? (
                      <div className="ats-loading-state">
                        <Loader size={28} className="spin" />
                        <span>Loading candidates across all jobs...</span>
                      </div>
                  ):Object.keys(jobWiseCandidates).length===0? (
                    <div className="ats-empty-state">
                      <Users size={48} />
                      <h3>No Applicants Yet</h3>
                      <p>Candidates who apply for your jobs will appear here with ATS scores</p>
                    </div>
                  ):Object.entries(jobWiseCandidates).map(([jobId, data]) => (
                    <div className="ats-job-section" key={jobId}>
                      <div className="ats-job-section-header">
                        <div className="ats-job-section-title">
                          <div className="ats-job-icon"><Briefcase size={16} /></div>
                          <div>
                            <h3>{data.title}</h3>
                            <span>{data.applicants.length} applicant{data.applicants.length!==1? 's':''}</span>
                          </div>
                        </div>
                        <button className="ats-view-all-btn" onClick={() => {setSelectedJobApplicants(jobId); fetchApplicants(jobId);}}>
                          View All <ChevronRight size={14} />
                        </button>
                      </div>
                      <div className="ats-candidates-grid">
                        {data.applicants.map((c) => (
                          <div className={`ats-candidate-card ${!c.eligible? 'ineligible':c.atsScore>=70? 'good':''}`} key={c.id} onClick={() => setSelectedCandidate(c)}>
                            {/* Card Header with Score */}
                            <div className="ats-card-top">
                              <div className="ats-card-identity">
                                <div className="ats-card-avatar" style={{background: `linear-gradient(135deg, ${getScoreColor(c.atsScore||c.score)}66, ${getScoreColor(c.atsScore||c.score)})`}}>
                                  {(c.candidate?.name||'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="ats-card-name">{c.candidate?.name||'Unknown'}</div>
                                  <div className="ats-card-email">{c.candidate?.email||''}</div>
                                </div>
                              </div>
                              <div className="ats-card-score-ring" style={{'--ring-color': getScoreColor(c.atsScore||c.score)}}>
                                <span>{c.atsScore||c.score||0}</span>
                              </div>
                            </div>

                            {/* Score Bars */}
                            <div className="ats-card-metrics">
                              <div className="ats-card-metric">
                                <div className="ats-metric-label">
                                  <span>Skill Match</span>
                                  <span style={{color: getScoreColor(c.skillMatchScore)}}>{c.skillMatchScore||0}%</span>
                                </div>
                                <div className="ats-metric-track">
                                  <div className="ats-metric-fill" style={{width: `${c.skillMatchScore||0}%`, background: `linear-gradient(90deg, ${getScoreColor(c.skillMatchScore)}88, ${getScoreColor(c.skillMatchScore)})`}}></div>
                                </div>
                              </div>
                              {c.cgpa>0&&(
                                <div className="ats-card-metric">
                                  <div className="ats-metric-label">
                                    <span>CGPA</span>
                                    <span className={c.cgpa>=8? 'text-green':c.cgpa>=6? 'text-amber':'text-red'}>{c.cgpa.toFixed(1)}/10</span>
                                  </div>
                                  <div className="ats-metric-track">
                                    <div className="ats-metric-fill" style={{width: `${(c.cgpa/10)*100}%`, background: c.cgpa>=8? '#22c55e':c.cgpa>=6? '#f59e0b':'#ef4444'}}></div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Skills Chips */}
                            {(c.matchedSkills?.length>0||c.missingSkills?.length>0)&&(
                              <div className="ats-card-chips">
                                {(c.matchedSkills||[]).slice(0, 3).map((s, i) => (
                                  <span key={i} className="ats-chip matched"><Check size={9} /> {s}</span>
                                ))}
                                {(c.missingSkills||[]).slice(0, 2).map((s, i) => (
                                  <span key={`m${i}`} className="ats-chip missing"><X size={9} /> {s}</span>
                                ))}
                              </div>
                            )}

                            {/* Footer */}
                            <div className="ats-card-footer">
                              <div className="ats-card-status-row">
                                <span className={`ats-status-badge ${c.status}`}>{(c.status||'').replace(/_/g, ' ')}</span>
                                {!c.eligible&&<span className="ats-not-eligible-tag">Not Eligible</span>}
                              </div>
                              <div className="ats-card-actions">
                                <button className="ats-act-btn view" title="View Details" onClick={(e) => {e.stopPropagation(); setSelectedCandidate(c);}}><Eye size={14} /></button>
                                {c.resumeUrl&&(
                                  <a className="ats-act-btn resume" href={c.resumeUrl} target="_blank" rel="noopener noreferrer" title="View Resume" onClick={(e) => e.stopPropagation()}><FileText size={14} /></a>
                                )}
                                {c.candidate?.id&&(
                                  <button className="ats-act-btn github" title="GitHub Verification Report" onClick={(e) => {e.stopPropagation(); navigate(`/recruiter/projects/${c.candidate.id}`);}}>
                                    <GitBranch size={14} />
                                  </button>
                                )}
                                {c.status!=='interview'&&c.status!=='rejected'&&c.eligible!==false&&features['company.candidates.schedule_interview'] !== false&&(
                                  <button className="ats-act-btn schedule" onClick={(e) => {e.stopPropagation(); handleScheduleInterview(c, jobId, c.id);}} disabled={schedulingCandidate===c.candidate?.id} title="Schedule Interview">
                                    <Video size={14} />
                                  </button>
                                )}
                                {c.status==='interview'&&<span className="ats-scheduled-tag" title="Scheduled" style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#FF6B35'}} />}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                )
              )}
            </>
          )}

          {/* QUIZ TAB */}
          {activeTab==='quiz'&&(
            <>
              <div className="cmpd-welcome">
                <div>
                  <h1>Live Quiz Management</h1>
                  <p>Create and manage quizzes for each hiring round</p>
                </div>
                <div style={{display: 'flex', gap: '10px'}}>
                  {features['company.quiz.full_manager'] !== false && (
                    <button className="cmpd-btn-secondary" onClick={() => navigate('/quiz/dashboard')}>
                      <Settings size={16} /> Full Quiz Manager
                    </button>
                  )}
                  {features['company.quiz.create_wizard'] !== false && (
                    <button className="cmpd-btn-primary" onClick={() => setShowCreateQuiz(true)}>
                      <Plus size={16} /> Create Quiz
                    </button>
                  )}
                </div>
              </div>

              {/* Create Quiz Wizard Modal */}
              {showCreateQuiz&&(
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999}} onClick={e => {if (e.target===e.currentTarget&&!creatingQuiz&&!generatingAI) resetQuizWizard();}}>
                  <div style={{background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '16px', padding: '28px', width: '94%', maxWidth: wizardStep===3? '720px':'520px', maxHeight: '88vh', overflowY: 'auto', transition: 'max-width 0.3s'}}>

                    {/* Step indicator */}
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px'}}>
                      {[1, 2, 3].map(s => (
                        <div key={s} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <div style={{width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, background: wizardStep>=s? '#FF6B35':'var(--bg-primary, #0f0f1a)', color: wizardStep>=s? '#fff':'#64748b', border: `2px solid ${wizardStep>=s? '#FF6B35':'#334155'}`, transition: 'all 0.3s'}}>{wizardStep>s? '✓':s}</div>
                          <span style={{fontSize: '0.78rem', color: wizardStep===s? '#e2e8f0':'#64748b', fontWeight: wizardStep===s? 600:400}}>{s===1? 'Details':s===2? 'Questions':'Review'}</span>
                          {s<3&&<div style={{width: '30px', height: '2px', background: wizardStep>s? '#FF6B35':'#334155', borderRadius: '1px'}} />}
                        </div>
                      ))}
                    </div>

                    {/* Error banner */}
                    {quizError&&(
                      <div style={{background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fca5a5'}}>
                        <XCircle size={16} /> {quizError}
                        <button onClick={() => setQuizError('')} style={{marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer'}}><X size={14} /></button>
                      </div>
                    )}

                    {/* ─── Step 1: Quiz Details ─── */}
                    {wizardStep===1&&(
                      <>
                        <h2 style={{margin: '0 0 18px', fontSize: '1.25rem'}}>Quiz Details</h2>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
                          <div>
                            <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Title *</label>
                            <input value={quizForm.title} onChange={e => setQuizForm(f => ({...f, title: e.target.value}))} placeholder="e.g. JavaScript Fundamentals" style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                          </div>
                          <div>
                            <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Topic *</label>
                            <input value={quizForm.topic} onChange={e => setQuizForm(f => ({...f, topic: e.target.value}))} placeholder="e.g. React, Node.js, SQL, Data Structures..." style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                          </div>
                          <div>
                            <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Description</label>
                            <textarea value={quizForm.description} onChange={e => setQuizForm(f => ({...f, description: e.target.value}))} rows={2} placeholder="Optional description" style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box'}} />
                          </div>
                          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px'}}>
                            <div>
                              <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Difficulty</label>
                              <select value={quizForm.difficulty} onChange={e => setQuizForm(f => ({...f, difficulty: e.target.value}))} style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem'}}>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>
                            <div>
                              <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Time/Q (sec)</label>
                              <input type="number" min={10} max={120} value={quizForm.questionTimeLimit} onChange={e => setQuizForm(f => ({...f, questionTimeLimit: Number(e.target.value)}))} style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                            </div>
                            <div>
                              <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}># Questions</label>
                              <input type="number" min={1} max={30} value={quizForm.questionCount} onChange={e => setQuizForm(f => ({...f, questionCount: Math.min(30, Math.max(1, Number(e.target.value)))}))} style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                            </div>
                          </div>
                        </div>
                        <div style={{display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end'}}>
                          <button className="cmpd-btn-secondary" onClick={resetQuizWizard}>Cancel</button>
                          <button className="cmpd-btn-primary" onClick={handleCreateQuizShell} disabled={creatingQuiz||!quizForm.title.trim()||!quizForm.topic.trim()}>
                            {creatingQuiz? <><Loader size={14} style={{animation: 'spin 1s linear infinite'}} /> Creating...</>:'Next → Add Questions'}
                          </button>
                        </div>
                      </>
                    )}

                    {/* ─── Step 2: Generate / Add Questions ─── */}
                    {wizardStep===2&&(
                      <>
                        <h2 style={{margin: '0 0 6px', fontSize: '1.25rem'}}>Add Questions</h2>
                        <p style={{color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 20px'}}>Choose how to add questions to your quiz</p>

                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                          {/* AI Generate Card */}
                          <div
                            onClick={!generatingAI? handleAIGenerate:undefined}
                            style={{background: 'linear-gradient(135deg, rgba(255,107,53,0.1), rgba(255,140,66,0.1))', border: '2px solid rgba(255,107,53,0.3)', borderRadius: '14px', padding: '24px', cursor: generatingAI? 'wait':'pointer', textAlign: 'center', transition: 'all 0.2s'}}
                            onMouseEnter={e => {if (!generatingAI) e.currentTarget.style.borderColor='#FF6B35';}}
                            onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,107,53,0.3)'}
                          >
                            {generatingAI? (
                              <>
                                <Loader size={36} style={{color: '#FF8C42', marginBottom: '12px', animation: 'spin 1s linear infinite'}} />
                                <h3 style={{fontSize: '1rem', margin: '0 0 6px', color: '#FFB366'}}>AI is thinking...</h3>
                                <p style={{fontSize: '0.8rem', color: '#94a3b8', margin: 0}}>Generating {quizForm.questionCount} {quizForm.difficulty} questions about {quizForm.topic}</p>
                              </>
                            ):(
                              <>
                                <Sparkles size={36} style={{color: '#FF8C42', marginBottom: '12px'}} />
                                <h3 style={{fontSize: '1rem', margin: '0 0 6px'}}>Generate with AI</h3>
                                <p style={{fontSize: '0.8rem', color: '#94a3b8', margin: 0}}>{quizForm.questionCount} MCQ questions about "{quizForm.topic}" • {quizForm.difficulty}</p>
                              </>
                            )}
                          </div>

                          {/* Manual / Quiz Dashboard Card */}
                          <div
                            onClick={() => {resetQuizWizard(); navigate('/quiz/dashboard');}}
                            style={{background: 'var(--bg-primary, #0f0f1a)', border: '2px solid var(--border-color, #2a2a3a)', borderRadius: '14px', padding: '24px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'}}
                            onMouseEnter={e => e.currentTarget.style.borderColor='#FF6B35'}
                            onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-color, #2a2a3a)'}
                          >
                            <FileText size={36} style={{color: '#64748b', marginBottom: '12px'}} />
                            <h3 style={{fontSize: '1rem', margin: '0 0 6px'}}>Add Manually</h3>
                            <p style={{fontSize: '0.8rem', color: '#94a3b8', margin: 0}}>Open the quiz editor to type your own questions</p>
                          </div>
                        </div>

                        <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                          <button className="cmpd-btn-secondary" onClick={resetQuizWizard}>Cancel</button>
                        </div>
                      </>
                    )}

                    {/* ─── Step 3: Review AI Questions ─── */}
                    {wizardStep===3&&(
                      <>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                          <div>
                            <h2 style={{margin: '0 0 4px', fontSize: '1.25rem'}}>Review Questions ({generatedQuestions.length})</h2>
                            <p style={{color: '#94a3b8', fontSize: '0.82rem', margin: 0}}>Review, remove unwanted questions, or generate more</p>
                          </div>
                          <button
                            className="cmpd-btn-secondary"
                            onClick={handleAIGenerate}
                            disabled={generatingAI}
                            style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem'}}
                          >
                            {generatingAI? <Loader size={14} style={{animation: 'spin 1s linear infinite'}} />:<RefreshCw size={14} />}
                            {generatingAI? 'Generating...':'+ Generate More'}
                          </button>
                        </div>

                        <div style={{maxHeight: '42vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px'}}>
                          {generatedQuestions.map((q, i) => (
                            <div key={i} style={{background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '10px', padding: '14px'}}>
                              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px'}}>
                                <span style={{fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0}}>Q{i+1}.</span>
                                <p style={{fontSize: '0.88rem', color: '#e2e8f0', margin: 0, flex: 1}}>{q.text}</p>
                                <button onClick={() => removeQuestion(i)} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0, padding: '2px'}}><Trash2 size={14} /></button>
                              </div>
                              {q.options&&q.options.length>0&&(
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px', marginLeft: '28px'}}>
                                  {q.options.map((opt, oi) => (
                                    <div key={oi} style={{fontSize: '0.8rem', padding: '6px 10px', borderRadius: '6px', background: opt===q.correctAnswer? 'rgba(34,197,94,0.12)':'rgba(148,163,184,0.06)', color: opt===q.correctAnswer? '#86efac':'#94a3b8', border: `1px solid ${opt===q.correctAnswer? 'rgba(34,197,94,0.3)':'transparent'}`}}>
                                      {String.fromCharCode(65+oi)}. {opt} {opt===q.correctAnswer&&<Check size={12} style={{marginLeft: '4px', verticalAlign: 'middle'}} />}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.explanation&&<p style={{fontSize: '0.75rem', color: '#64748b', margin: '8px 0 0 28px', fontStyle: 'italic'}}>{q.explanation}</p>}
                            </div>
                          ))}
                        </div>

                        <div style={{display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
                          <button className="cmpd-btn-secondary" onClick={resetQuizWizard} style={{marginRight: 'auto'}}>Cancel</button>
                          <button className="cmpd-btn-secondary" onClick={() => handleFinishQuiz(false)} disabled={creatingQuiz||generatedQuestions.length===0}>
                            {creatingQuiz? 'Saving...':'Save as Draft'}
                          </button>
                          <button className="cmpd-btn-primary" onClick={() => handleFinishQuiz(true)} disabled={creatingQuiz||generatedQuestions.length===0} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                            {creatingQuiz? <><Loader size={14} style={{animation: 'spin 1s linear infinite'}} /> Publishing...</>:<><Zap size={14} /> Publish & Go Live</>}
                          </button>
                        </div>
                      </>
                    )}

                  </div>
                </div>
              )}

              <div className="cmpd-quiz-grid">
                {loadingQuizzes? (
                  <div style={{padding: '40px', textAlign: 'center', color: '#737373', gridColumn: '1 / -1'}}>Loading quizzes...</div>
                ):quizzes.length===0? (
                  <div style={{padding: '40px', textAlign: 'center', color: '#737373', gridColumn: '1 / -1'}}>
                    <Zap size={40} style={{marginBottom: 12, opacity: 0.3}} />
                    <h3 style={{color: '#a3a3a3'}}>No quizzes created yet</h3>
                    <p>Click "Create Quiz" to set up a live quiz round for candidates</p>
                  </div>
                ):quizzes.map((q) => (
                  <div className="cmpd-quiz-card" key={q.id||q._id}>
                    <div className="cmpd-quiz-top">
                      <div className="cmpd-quiz-icon"><Zap size={20} /></div>
                      <span className={`cmpd-status-pill ${q.status}`}>{q.status}</span>
                    </div>
                    <h3>{q.title}</h3>
                    <span className="cmpd-quiz-round">{q.topic} · {q.difficulty}</span>
                    <div className="cmpd-quiz-meta">
                      <span><FileText size={13} /> {q.questionCount} questions</span>
                      <span><Timer size={13} /> {q.questionTimeLimit}s/Q</span>
                      <span><Users size={13} /> {q.participantCount} joined</span>
                    </div>
                    <div style={{fontSize: '0.78rem', color: '#FFB366', fontFamily: 'monospace', margin: '6px 0'}}>Room: {q.code}</div>
                    <div className="cmpd-quiz-actions">
                      {q.status==='draft'&&(
                        <>
                          <button className="cmpd-btn-secondary cmpd-btn-sm" onClick={() => navigate('/quiz/dashboard')}><Settings size={14} /> Edit</button>
                          {q.questionCount>0&&<button className="cmpd-btn-primary cmpd-btn-sm" onClick={async () => {try {await fetch(`${API_BASE_URL}/api/quiz/${q.id}/publish`, {method: 'POST', credentials: 'include'}); fetchCompanyQuizzes();} catch {} }}>Publish</button>}
                        </>
                      )}
                      {q.status==='waiting'&&features['company.quiz.host'] !== false&&(
                        <button className="cmpd-btn-primary cmpd-btn-sm" onClick={() => navigate(`/quiz/host/${q.id}`)}><PlayCircle size={14} /> Open Lobby</button>
                      )}
                      {['active', 'question_open', 'question_closed'].includes(q.status)&&features['company.quiz.host'] !== false&&(
                        <button className="cmpd-btn-primary cmpd-btn-sm" onClick={() => navigate(`/quiz/host/${q.id}`)}><PlayCircle size={14} /> Rejoin Live</button>
                      )}
                      {q.status==='completed'&&(
                        <button className="cmpd-btn-secondary cmpd-btn-sm" onClick={() => navigate(`/quiz/results/${q.id}`)}><BarChart3 size={14} /> View Results</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CONTEST TAB */}
          {activeTab==='contest'&&(
            <>
              <div className="cmpd-welcome">
                <div>
                  <h1>Coding Contest Management</h1>
                  <p>Create and manage live coding contests with real-time code execution</p>
                </div>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button className="cmpd-btn-secondary" onClick={() => navigate('/contest/dashboard')}>
                    <Settings size={16} /> Full Contest Manager
                  </button>
                  {features['company.contest.create_wizard'] !== false && (
                    <button className="cmpd-btn-primary" onClick={() => setShowCreateContest(true)}>
                      <Plus size={16} /> Create Contest
                    </button>
                  )}
                </div>
              </div>

              {/* Create Contest Wizard Modal */}
              {showCreateContest&&(
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999}} onClick={e => {if (e.target===e.currentTarget&&!creatingContest&&!generatingContestAI) resetContestWizard();}}>
                  <div style={{background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '16px', padding: '28px', width: '94%', maxWidth: contestWizardStep===3? '720px':'520px', maxHeight: '88vh', overflowY: 'auto', transition: 'max-width 0.3s'}}>

                    {/* Step indicator */}
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px'}}>
                      {[1, 2, 3].map(s => (
                        <div key={s} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <div style={{width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, background: contestWizardStep>=s? '#10b981':'var(--bg-primary, #0f0f1a)', color: contestWizardStep>=s? '#fff':'#64748b', border: `2px solid ${contestWizardStep>=s? '#10b981':'#334155'}`, transition: 'all 0.3s'}}>{contestWizardStep>s? '✓':s}</div>
                          <span style={{fontSize: '0.78rem', color: contestWizardStep===s? '#e2e8f0':'#64748b', fontWeight: contestWizardStep===s? 600:400}}>{s===1? 'Details':s===2? 'Challenges':'Review'}</span>
                          {s<3&&<div style={{width: '30px', height: '2px', background: contestWizardStep>s? '#10b981':'#334155', borderRadius: '1px'}} />}
                        </div>
                      ))}
                    </div>

                    {/* Error banner */}
                    {contestError&&(
                      <div style={{background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fca5a5'}}>
                        <XCircle size={16} /> {contestError}
                        <button onClick={() => setContestError('')} style={{marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer'}}><X size={14} /></button>
                      </div>
                    )}

                    {/* ─── Step 1: Contest Details ─── */}
                    {contestWizardStep===1&&(
                      <>
                        <h2 style={{margin: '0 0 18px', fontSize: '1.25rem'}}>Contest Details</h2>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '14px'}}>
                          <div>
                            <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Title *</label>
                            <input value={contestForm.title} onChange={e => setContestForm(f => ({...f, title: e.target.value}))} placeholder="e.g. JavaScript Coding Challenge" style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                          </div>
                          <div>
                            <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Topic *</label>
                            <input value={contestForm.topic} onChange={e => setContestForm(f => ({...f, topic: e.target.value}))} placeholder="e.g. Arrays, Dynamic Programming, Trees..." style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                          </div>
                          <div>
                            <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Description</label>
                            <textarea value={contestForm.description} onChange={e => setContestForm(f => ({...f, description: e.target.value}))} rows={2} placeholder="Optional description" style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box'}} />
                          </div>
                          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px'}}>
                            <div>
                              <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Difficulty</label>
                              <select value={contestForm.difficulty} onChange={e => setContestForm(f => ({...f, difficulty: e.target.value}))} style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem'}}>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>
                            <div>
                              <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}>Duration (min)</label>
                              <input type="number" min={15} max={180} value={contestForm.duration} onChange={e => setContestForm(f => ({...f, duration: Number(e.target.value)}))} style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                            </div>
                            <div>
                              <label style={{fontSize: '0.82rem', color: '#94a3b8', display: 'block', marginBottom: '4px'}}># Challenges</label>
                              <input type="number" min={1} max={10} value={contestForm.challengeCount} onChange={e => setContestForm(f => ({...f, challengeCount: Math.min(10, Math.max(1, Number(e.target.value)))}))} style={{width: '100%', padding: '10px 12px', background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box'}} />
                            </div>
                          </div>
                        </div>
                        <div style={{display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end'}}>
                          <button className="cmpd-btn-secondary" onClick={resetContestWizard}>Cancel</button>
                          <button className="cmpd-btn-primary" onClick={handleCreateContestShell} disabled={creatingContest||!contestForm.title.trim()||!contestForm.topic.trim()} style={{background: '#10b981'}}>
                            {creatingContest? <><Loader size={14} style={{animation: 'spin 1s linear infinite'}} /> Creating...</>:'Next → Add Challenges'}
                          </button>
                        </div>
                      </>
                    )}

                    {/* ─── Step 2: Generate / Add Challenges ─── */}
                    {contestWizardStep===2&&(
                      <>
                        <h2 style={{margin: '0 0 6px', fontSize: '1.25rem'}}>Add Challenges</h2>
                        <p style={{color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 20px'}}>Choose how to add coding challenges to your contest</p>

                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                          {/* AI Generate Card */}
                          <div
                            onClick={!generatingContestAI? handleContestAIGenerate:undefined}
                            style={{background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))', border: '2px solid rgba(16,185,129,0.3)', borderRadius: '14px', padding: '24px', cursor: generatingContestAI? 'wait':'pointer', textAlign: 'center', transition: 'all 0.2s'}}
                            onMouseEnter={e => {if (!generatingContestAI) e.currentTarget.style.borderColor='#10b981';}}
                            onMouseLeave={e => e.currentTarget.style.borderColor='rgba(16,185,129,0.3)'}
                          >
                            {generatingContestAI? (
                              <>
                                <Loader size={36} style={{color: '#10b981', marginBottom: '12px', animation: 'spin 1s linear infinite'}} />
                                <h3 style={{fontSize: '1rem', margin: '0 0 6px', color: '#86efac'}}>AI is thinking...</h3>
                                <p style={{fontSize: '0.8rem', color: '#94a3b8', margin: 0}}>Generating {contestForm.challengeCount} {contestForm.difficulty} challenges about {contestForm.topic}</p>
                              </>
                            ):(
                              <>
                                <Sparkles size={36} style={{color: '#10b981', marginBottom: '12px'}} />
                                <h3 style={{fontSize: '1rem', margin: '0 0 6px'}}>Generate with AI</h3>
                                <p style={{fontSize: '0.8rem', color: '#94a3b8', margin: 0}}>{contestForm.challengeCount} coding challenges about "{contestForm.topic}" • {contestForm.difficulty}</p>
                              </>
                            )}
                          </div>

                          {/* Manual / Contest Dashboard Card */}
                          <div
                            onClick={() => {resetContestWizard(); navigate('/contest/dashboard');}}
                            style={{background: 'var(--bg-primary, #0f0f1a)', border: '2px solid var(--border-color, #2a2a3a)', borderRadius: '14px', padding: '24px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'}}
                            onMouseEnter={e => e.currentTarget.style.borderColor='#10b981'}
                            onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-color, #2a2a3a)'}
                          >
                            <Code size={36} style={{color: '#64748b', marginBottom: '12px'}} />
                            <h3 style={{fontSize: '1rem', margin: '0 0 6px'}}>Add Manually</h3>
                            <p style={{fontSize: '0.8rem', color: '#94a3b8', margin: 0}}>Open the contest editor to write your own challenges</p>
                          </div>
                        </div>

                        <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                          <button className="cmpd-btn-secondary" onClick={resetContestWizard}>Cancel</button>
                        </div>
                      </>
                    )}

                    {/* ─── Step 3: Review AI Challenges ─── */}
                    {contestWizardStep===3&&(
                      <>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                          <div>
                            <h2 style={{margin: '0 0 4px', fontSize: '1.25rem'}}>Review Challenges ({generatedChallenges.length})</h2>
                            <p style={{color: '#94a3b8', fontSize: '0.82rem', margin: 0}}>Review, remove unwanted challenges, or generate more</p>
                          </div>
                          <button
                            className="cmpd-btn-secondary"
                            onClick={handleContestAIGenerate}
                            disabled={generatingContestAI}
                            style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem'}}
                          >
                            {generatingContestAI? <Loader size={14} style={{animation: 'spin 1s linear infinite'}} />:<RefreshCw size={14} />}
                            {generatingContestAI? 'Generating...':'+ Generate More'}
                          </button>
                        </div>

                        <div style={{maxHeight: '42vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px'}}>
                          {generatedChallenges.map((c, i) => (
                            <div key={i} style={{background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border-color, #2a2a3a)', borderRadius: '10px', padding: '14px'}}>
                              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px'}}>
                                <span style={{fontSize: '0.82rem', color: '#10b981', fontWeight: 600, flexShrink: 0}}>#{i+1}</span>
                                <div style={{flex: 1}}>
                                  <p style={{fontSize: '0.92rem', color: '#e2e8f0', margin: '0 0 4px', fontWeight: 600}}>{c.title}</p>
                                  <p style={{fontSize: '0.8rem', color: '#94a3b8', margin: 0}}>{c.description?.slice(0, 150)||''}...</p>
                                </div>
                                <button onClick={() => removeChallenge(i)} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0, padding: '2px'}}><Trash2 size={14} /></button>
                              </div>
                              <div style={{display: 'flex', gap: '12px', marginTop: '10px', marginLeft: '24px', fontSize: '0.75rem', color: '#64748b'}}>
                                <span style={{color: c.difficulty==='easy'? '#22c55e':c.difficulty==='hard'? '#ef4444':'#f59e0b'}}>● {c.difficulty}</span>
                                <span>{c.points||100} pts</span>
                                <span>{c.testCases?.length||0} test cases</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
                          <button className="cmpd-btn-secondary" onClick={resetContestWizard} style={{marginRight: 'auto'}}>Cancel</button>
                          <button className="cmpd-btn-secondary" onClick={() => handleFinishContest(false)} disabled={creatingContest||generatedChallenges.length===0}>
                            {creatingContest? 'Saving...':'Save as Draft'}
                          </button>
                          <button className="cmpd-btn-primary" onClick={() => handleFinishContest(true)} disabled={creatingContest||generatedChallenges.length===0} style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#10b981'}}>
                            {creatingContest? <><Loader size={14} style={{animation: 'spin 1s linear infinite'}} /> Publishing...</>:<><Terminal size={14} /> Publish & Go Live</>}
                          </button>
                        </div>
                      </>
                    )}

                  </div>
                </div>
              )}

              <div className="cmpd-quiz-grid">
                {loadingContests? (
                  <div style={{padding: '40px', textAlign: 'center', color: '#737373', gridColumn: '1 / -1'}}>Loading contests...</div>
                ):contests.length===0? (
                  <div style={{padding: '40px', textAlign: 'center', color: '#737373', gridColumn: '1 / -1'}}>
                    <Terminal size={40} style={{marginBottom: 12, opacity: 0.3}} />
                    <h3 style={{color: '#a3a3a3'}}>No coding contests created yet</h3>
                    <p>Click "Create Contest" to set up a live coding contest for candidates</p>
                  </div>
                ):contests.map((c) => (
                  <div className="cmpd-quiz-card" key={c.id||c._id} style={{borderColor: 'rgba(16,185,129,0.2)'}}>
                    <div className="cmpd-quiz-top">
                      <div className="cmpd-quiz-icon" style={{background: 'rgba(16,185,129,0.1)', color: '#10b981'}}><Terminal size={20} /></div>
                      <span className={`cmpd-status-pill ${c.status}`}>{c.status}</span>
                    </div>
                    <h3>{c.title}</h3>
                    <span className="cmpd-quiz-round">{c.topic} · {c.difficulty}</span>
                    <div className="cmpd-quiz-meta">
                      <span><Code size={13} /> {c.challengeCount} challenges</span>
                      <span><Timer size={13} /> {c.duration} min</span>
                      <span><Users size={13} /> {c.participantCount} joined</span>
                    </div>
                    <div style={{fontSize: '0.78rem', color: '#10b981', fontFamily: 'monospace', margin: '6px 0'}}>Code: {c.code}</div>
                    <div className="cmpd-quiz-actions">
                      {c.status==='draft'&&(
                        <>
                          <button className="cmpd-btn-secondary cmpd-btn-sm" onClick={() => navigate('/contest/dashboard')}><Settings size={14} /> Edit</button>
                          {c.challengeCount>0&&<button className="cmpd-btn-primary cmpd-btn-sm" style={{background: '#10b981'}} onClick={async () => {try {await fetch(`${API_URL}/api/contest/${c.id}/publish`, {method: 'POST', credentials: 'include'}); fetchCompanyContests();} catch {} }}>Publish</button>}
                        </>
                      )}
                      {c.status==='waiting'&&features['company.contest.host'] !== false&&(
                        <button className="cmpd-btn-primary cmpd-btn-sm" style={{background: '#10b981'}} onClick={() => navigate(`/contest/host/${c.id}`)}><PlayCircle size={14} /> Open Lobby</button>
                      )}
                      {c.status==='active'&&features['company.contest.host'] !== false&&(
                        <button className="cmpd-btn-primary cmpd-btn-sm" style={{background: '#10b981'}} onClick={() => navigate(`/contest/host/${c.id}`)}><PlayCircle size={14} /> Rejoin Live</button>
                      )}
                      {c.status==='completed'&&(
                        <button className="cmpd-btn-secondary cmpd-btn-sm" onClick={() => navigate(`/contest/results/${c.id}`)}><BarChart3 size={14} /> View Results</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* INTERVIEWS TAB */}
          {activeTab==='interviews'&&(
            <>
              <div className="cmpd-welcome">
                <div>
                  <h1>Interview Management</h1>
                  <p>Schedule and conduct live interviews with proctoring</p>
                </div>
                <button className="cmpd-btn-primary" onClick={handleStartInterview} disabled={startingInterview}>
                  <Video size={16} /> {startingInterview? 'Starting...':'Quick Start Interview'}
                </button>
              </div>

              {/* Scheduled Interviews Table */}
              {features['company.interviews.scheduled'] !== false ? (
                <div className="cmpd-table-card" style={{marginBottom: '1.5rem'}}>
                  <div className="cmpd-card-header" style={{padding: '14px 20px', borderBottom: '1px solid var(--border-color, #2a2a3a)'}}>
                    <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', margin: 0}}><Video size={18} /> Scheduled Interviews ({scheduledInterviews.length})</h3>
                  </div>
                  {scheduledInterviews.length===0? (
                    <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted, #888)'}}>
                      <Calendar size={32} style={{marginBottom: '8px', opacity: 0.5}} />
                      <p>No scheduled interviews yet</p>
                      <p style={{fontSize: '0.8rem'}}>Go to <strong>Candidates</strong> tab → select a job → click <strong>Schedule</strong> on any applicant</p>
                    </div>
                  ):(
                    <table className="cmpd-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Job</th>
                          <th>Scheduled</th>
                          <th>Duration</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduledInterviews.map((iv) => (
                          <tr key={iv.sessionId}>
                            <td>
                              <div className="cmpd-cand-name">
                                <div className="cmpd-cand-avatar">{(iv.candidateName||'?').charAt(0).toUpperCase()}</div>
                                <div>
                                  <div>{iv.candidateName}</div>
                                  <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{iv.candidateEmail||''}</div>
                                </div>
                              </div>
                            </td>
                            <td>{iv.jobTitle||'—'}</td>
                            <td style={{fontSize: '0.85rem'}}>{iv.scheduledAt? new Date(iv.scheduledAt).toLocaleString():'—'}</td>
                            <td>{iv.duration||30} min</td>
                            <td><span className={`cmpd-status-pill ${iv.status}`}>{iv.status}</span></td>
                            <td>
                              <div className="cmpd-actions-group">
                                {(iv.status==='scheduled'||iv.status==='active')&&(
                                  <button className="cmpd-action-btn cmpd-action-schedule" onClick={() => handleJoinAsRecruiter(iv.sessionId)}>
                                    <PlayCircle size={14} /> Join
                                  </button>
                                )}
                                <button className="cmpd-action-btn" onClick={() => handleCopyLink(iv.sessionId)} title="Copy link for candidate">
                                  {copiedLink===iv.sessionId? <><CheckCircle2 size={14} /> Copied</>:<><Eye size={14} /> Copy Link</>}
                                </button>
                                {iv.status==='completed'&&(
                                  <button className="cmpd-action-btn" onClick={() => navigate(`/interview-report/${iv.sessionId}?role=recruiter`)}>
                                    <FileText size={14} /> Report
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="cmpd-table-card" style={{marginBottom: '1.5rem', padding: '40px', textAlign: 'center', color: 'var(--text-muted, #888)'}}>
                  <Calendar size={32} style={{marginBottom: '8px', opacity: 0.2}} />
                  <p>Scheduled Interviews list is disabled by the administrator.</p>
                </div>
              )}

              <div className="cmpd-interview-grid">
                <div className="cmpd-card">
                  <div className="cmpd-card-header"><h3><Award size={18} /> Interview Tools</h3></div>
                  <div className="cmpd-card-body">
                    <div className="cmpd-tool-item" onClick={() => navigate('/proctor-dashboard')}>
                      <Eye size={18} /> <span>Proctor Dashboard</span> <ChevronRight size={16} />
                    </div>
                    <div className="cmpd-tool-item" onClick={() => navigate('/recruiter-dashboard')}>
                      <Target size={18} /> <span>Recruiter Panel</span> <ChevronRight size={16} />
                    </div>
                    <div className="cmpd-tool-item" onClick={() => navigate('/ai-interview-setup')}>
                      <Zap size={18} /> <span>AI Interviewer</span> <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}


        </div>
      </main>

      {/* ── Post Job Modal ─────────────────────────────────── */}
      {showPostJobModal&&(
        <div className="cmpd-modal-overlay" onClick={() => setShowPostJobModal(false)}>
          <div className="cmpd-modal cmpd-modal-lg" onClick={(e) => e.stopPropagation()}>
            <h2>Post New Job</h2>
            <p className="cmpd-modal-sub">Fill in the details and set eligibility criteria for ATS screening</p>

            {/* Basic Info */}
            <div className="cmpd-modal-section-title">Basic Information</div>

            <div className="cmpd-form-group">
              <label>Job Title *</label>
              <input value={jobForm.title} onChange={(e) => setJobForm({...jobForm, title: e.target.value})} placeholder="e.g. Senior React Developer" />
            </div>

            <div className="cmpd-form-row">
              <div className="cmpd-form-group">
                <label>Department *</label>
                <input value={jobForm.department} onChange={(e) => setJobForm({...jobForm, department: e.target.value})} placeholder="e.g. Engineering" />
              </div>
              <div className="cmpd-form-group">
                <label>Location</label>
                <select value={jobForm.location} onChange={(e) => setJobForm({...jobForm, location: e.target.value})}>
                  <option>Remote</option>
                  <option>On-site</option>
                  <option>Hybrid</option>
                </select>
              </div>
            </div>

            <div className="cmpd-form-row">
              <div className="cmpd-form-group">
                <label>Job Type</label>
                <select value={jobForm.type} onChange={(e) => setJobForm({...jobForm, type: e.target.value})}>
                  <option>Full-Time</option>
                  <option>Part-Time</option>
                  <option>Contract</option>
                  <option>Internship</option>
                </select>
              </div>
              <div className="cmpd-form-group">
                <label>Skills (comma separated)</label>
                <input value={jobForm.skills} onChange={(e) => setJobForm({...jobForm, skills: e.target.value})} placeholder="React, Node.js, Python, AWS" />
              </div>
            </div>

            <div className="cmpd-form-row">
              <div className="cmpd-form-group">
                <label>Salary Min (INR)</label>
                <input type="number" value={jobForm.salaryMin} onChange={(e) => setJobForm({...jobForm, salaryMin: e.target.value})} placeholder="e.g. 500000" />
              </div>
              <div className="cmpd-form-group">
                <label>Salary Max (INR)</label>
                <input type="number" value={jobForm.salaryMax} onChange={(e) => setJobForm({...jobForm, salaryMax: e.target.value})} placeholder="e.g. 1500000" />
              </div>
            </div>

            <div className="cmpd-form-group">
              <label>Description</label>
              <textarea value={jobForm.description} onChange={(e) => setJobForm({...jobForm, description: e.target.value})} placeholder="Job description..." rows={3}></textarea>
            </div>

            <div className="cmpd-form-group">
              <label>Requirements</label>
              <textarea value={jobForm.requirements} onChange={(e) => setJobForm({...jobForm, requirements: e.target.value})} placeholder="Key requirements..." rows={2}></textarea>
            </div>

            {/* Eligibility Criteria */}
            <div className="cmpd-modal-section-title" style={{marginTop: '16px'}}>
              <Target size={16} /> Eligibility & ATS Criteria
            </div>

            <div className="cmpd-form-row">
              <div className="cmpd-form-group">
                <label>Minimum CGPA (out of 10)</label>
                <input type="number" step="0.1" min="0" max="10" value={jobForm.minCGPA} onChange={(e) => setJobForm({...jobForm, minCGPA: e.target.value})} placeholder="e.g. 7.0" />
              </div>
              <div className="cmpd-form-group">
                <label>Min Experience (years)</label>
                <input type="number" min="0" value={jobForm.minExperience} onChange={(e) => setJobForm({...jobForm, minExperience: e.target.value})} placeholder="e.g. 2" />
              </div>
              <div className="cmpd-form-group">
                <label>Max Experience (years)</label>
                <input type="number" min="0" value={jobForm.maxExperience} onChange={(e) => setJobForm({...jobForm, maxExperience: e.target.value})} placeholder="e.g. 5" />
              </div>
            </div>

            <div className="cmpd-form-group">
              <label>Required Skills (must-have, comma separated)</label>
              <input value={jobForm.requiredSkills} onChange={(e) => setJobForm({...jobForm, requiredSkills: e.target.value})} placeholder="React, JavaScript, TypeScript" />
              <span className="cmpd-form-hint">Candidates without these skills will be marked as not eligible</span>
            </div>

            <div className="cmpd-form-group">
              <label>Preferred Skills (nice-to-have, comma separated)</label>
              <input value={jobForm.preferredSkills} onChange={(e) => setJobForm({...jobForm, preferredSkills: e.target.value})} placeholder="GraphQL, Docker, AWS" />
            </div>

            <div className="cmpd-form-group">
              <label>Required Education (comma separated)</label>
              <input value={jobForm.requiredEducation} onChange={(e) => setJobForm({...jobForm, requiredEducation: e.target.value})} placeholder="B.Tech, Bachelor's, M.Tech" />
            </div>

            <div className="cmpd-form-row" style={{alignItems: 'center'}}>
              <div className="cmpd-form-group" style={{flex: 1}}>
                <label>Min ATS Score for Auto-Shortlisting</label>
                <input type="number" min="0" max="100" value={jobForm.minATSScore} onChange={(e) => setJobForm({...jobForm, minATSScore: e.target.value})} placeholder="60" />
              </div>
              <label className="cmpd-checkbox-label" style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px', cursor: 'pointer'}}>
                <input type="checkbox" checked={jobForm.autoShortlist} onChange={(e) => setJobForm({...jobForm, autoShortlist: e.target.checked})} />
                <span>Auto-shortlist eligible candidates</span>
              </label>
            </div>

            <div className="cmpd-modal-actions">
              <button className="cmpd-btn-secondary" onClick={() => setShowPostJobModal(false)}>Cancel</button>
              <button className="cmpd-btn-primary" onClick={handlePostJob}>Post Job</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Candidate Detail Modal ─────────────────────────────── */}
      {selectedCandidate&&(
        <div className="cmpd-modal-overlay" onClick={() => setSelectedCandidate(null)}>
          <div className="cmpd-modal cmpd-modal-lg ats-detail-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="ats-modal-header">
              <div className="ats-modal-identity">
                <div className="ats-modal-avatar" style={{background: `linear-gradient(135deg, ${getScoreColor(selectedCandidate.atsScore)}66, ${getScoreColor(selectedCandidate.atsScore)})`}}>
                  {(selectedCandidate.candidate?.name||'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2>{selectedCandidate.candidate?.name||'Candidate'}</h2>
                  <p>{selectedCandidate.candidate?.email}</p>
                  <div className="ats-modal-tags">
                    <span className={`ats-status-badge ${selectedCandidate.status}`}>{(selectedCandidate.status||'').replace(/_/g, ' ')}</span>
                    <span className={`ats-eligibility-badge ${selectedCandidate.eligible? 'eligible':'not-eligible'}`}>
                      {selectedCandidate.eligible? '✓ Eligible':'✗ Not Eligible'}
                    </span>
                  </div>
                </div>
              </div>
              <button className="cmpd-icon-btn" onClick={() => setSelectedCandidate(null)}><X size={18} /></button>
            </div>

            {/* Resume Download */}
            {selectedCandidate.resumeUrl&&(
              <div className="ats-resume-download-bar">
                <FileText size={16} />
                <span>Resume uploaded</span>
                <a href={selectedCandidate.resumeUrl} target="_blank" rel="noopener noreferrer" className="ats-resume-dl-btn">
                  <ExternalLink size={14} /> View Resume
                </a>
              </div>
            )}

            {/* Score Dashboard */}
            <div className="ats-score-dashboard">
              <div className="ats-score-main">
                <div className="ats-score-circle-lg" style={{'--sc-color': getScoreColor(selectedCandidate.atsScore)}}>
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={getScoreColor(selectedCandidate.atsScore)} strokeWidth="6" strokeDasharray={`${(selectedCandidate.atsScore||0)*2.64} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                  </svg>
                  <div className="ats-score-circle-text">
                    <span className="ats-score-big">{selectedCandidate.atsScore||0}</span>
                    <span className="ats-score-sub">ATS Score</span>
                  </div>
                </div>
              </div>
              <div className="ats-score-breakdown">
                <div className="ats-breakdown-item">
                  <div className="ats-breakdown-label"><Target size={14} /> Skill Match</div>
                  <div className="ats-breakdown-bar">
                    <div className="ats-breakdown-track"><div className="ats-breakdown-fill" style={{width: `${selectedCandidate.skillMatchScore||0}%`, background: getScoreColor(selectedCandidate.skillMatchScore)}}></div></div>
                    <span style={{color: getScoreColor(selectedCandidate.skillMatchScore)}}>{selectedCandidate.skillMatchScore||0}%</span>
                  </div>
                </div>
                <div className="ats-breakdown-item">
                  <div className="ats-breakdown-label"><Award size={14} /> CGPA</div>
                  <div className="ats-breakdown-bar">
                    <div className="ats-breakdown-track"><div className="ats-breakdown-fill" style={{width: `${selectedCandidate.cgpa>0? (selectedCandidate.cgpa/10)*100:0}%`, background: selectedCandidate.cgpa>=8? '#22c55e':selectedCandidate.cgpa>=6? '#f59e0b':'#ef4444'}}></div></div>
                    <span>{selectedCandidate.cgpa>0? selectedCandidate.cgpa.toFixed(1):'N/A'}</span>
                  </div>
                </div>
                <div className="ats-breakdown-item">
                  <div className="ats-breakdown-label"><Briefcase size={14} /> Experience</div>
                  <div className="ats-breakdown-value">{selectedCandidate.experienceYears||0} years</div>
                </div>
              </div>
            </div>

            {/* Eligibility Reasons */}
            {selectedCandidate.eligibilityReasons?.length>0&&(
              <div className="ats-reasons-section">
                <h4><XCircle size={15} /> Eligibility Issues</h4>
                <div className="ats-reasons-list">
                  {selectedCandidate.eligibilityReasons.map((r, i) => (
                    <div key={i} className="ats-reason-item">
                      <span className="ats-reason-icon">⚠</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Grid */}
            <div className="ats-skills-section-grid">
              <div className="ats-skills-block matched">
                <h4><CheckCircle2 size={15} /> Matched Skills <span className="ats-skills-count">{selectedCandidate.matchedSkills?.length||0}</span></h4>
                <div className="ats-skills-tags">
                  {(selectedCandidate.matchedSkills||[]).map((s, i) => (
                    <span key={i} className="ats-skill-tag matched"><Check size={11} /> {s}</span>
                  ))}
                  {(!selectedCandidate.matchedSkills||selectedCandidate.matchedSkills.length===0)&&<span className="ats-no-data">No matched skills</span>}
                </div>
              </div>
              <div className="ats-skills-block missing">
                <h4><XCircle size={15} /> Missing Skills <span className="ats-skills-count">{selectedCandidate.missingSkills?.length||0}</span></h4>
                <div className="ats-skills-tags">
                  {(selectedCandidate.missingSkills||[]).map((s, i) => (
                    <span key={i} className="ats-skill-tag missing"><X size={11} /> {s}</span>
                  ))}
                  {(!selectedCandidate.missingSkills||selectedCandidate.missingSkills.length===0)&&<span className="ats-no-data">All skills matched!</span>}
                </div>
              </div>
            </div>

            {/* Projects */}
            {selectedCandidate.projectDetails?.length>0&&(
              <div className="ats-projects-section">
                <h4><Code size={15} /> Projects ({selectedCandidate.projectDetails.length})</h4>
                <div className="ats-projects-list">
                  {selectedCandidate.projectDetails.map((p, i) => (
                    <div key={i} className="ats-project-item">
                      <div className="ats-project-top">
                        <span className="ats-project-name">{p.name||`Project ${i+1}`}</span>
                        {p.relevanceScore>0&&(
                          <span className={`ats-relevance-badge ${p.relevanceScore>=70? 'high':p.relevanceScore>=40? 'mid':'low'}`}>
                            {p.relevanceScore}% match
                          </span>
                        )}
                      </div>
                      {p.description&&<p className="ats-project-desc">{p.description.slice(0, 200)}</p>}
                      {p.technologies?.length>0&&(
                        <div className="ats-project-techs">
                          {p.technologies.map((t, j) => <span key={j} className="ats-chip matched">{t}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Candidate Skills */}
            {selectedCandidate.candidate?.skills?.length>0&&(
              <div className="ats-allskills-section">
                <h4><Sparkles size={15} /> All Candidate Skills</h4>
                <div className="ats-skills-tags">
                  {selectedCandidate.candidate.skills.map((s, i) => (
                    <span key={i} className="ats-skill-tag neutral">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Resume Parsed Data */}
            {selectedCandidate.resumeParsed&&(
              <div className="ats-resume-parsed-section">
                <h4><FileText size={15} /> Resume Parsed</h4>

                {/* Extracted Skills */}
                {selectedCandidate.resumeParsed.skills?.all?.length>0&&(
                  <div className="ats-rp-block">
                    <div className="ats-rp-label">Extracted Skills</div>
                    <div className="ats-skills-tags">
                      {selectedCandidate.resumeParsed.skills.all.map((s, i) => (
                        <span key={i} className="ats-skill-tag neutral">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {selectedCandidate.resumeParsed.experience&&(
                  <div className="ats-rp-row">
                    <div className="ats-rp-block">
                      <div className="ats-rp-label">Experience</div>
                      <div className="ats-rp-value">{selectedCandidate.resumeParsed.experience.years??selectedCandidate.experienceYears??0} years</div>
                    </div>
                    {selectedCandidate.resumeParsed.experience.level&&(
                      <div className="ats-rp-block">
                        <div className="ats-rp-label">Level</div>
                        <div className="ats-rp-value ats-rp-capitalize">{selectedCandidate.resumeParsed.experience.level}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Education */}
                {selectedCandidate.resumeParsed.education&&(
                  <div className="ats-rp-block">
                    <div className="ats-rp-label">Education</div>
                    <div className="ats-rp-edu-list">
                      {selectedCandidate.resumeParsed.education.degrees?.length>0
                        ? selectedCandidate.resumeParsed.education.degrees.map((d, i) => (
                            <span key={i} className="ats-rp-edu-tag">{d}</span>
                          ))
                        : <span className="ats-no-data">No degree info extracted</span>
                      }
                      {selectedCandidate.resumeParsed.education.cgpa>0&&(
                        <span className="ats-rp-edu-tag cgpa">CGPA {selectedCandidate.resumeParsed.education.cgpa.toFixed(2)}</span>
                      )}
                      {selectedCandidate.resumeParsed.education.institutions?.map((inst, i) => (
                        <span key={`inst-${i}`} className="ats-rp-edu-tag inst">{inst}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!selectedCandidate.resumeParsed&&(
              <div className="ats-resume-parsed-empty">
                <FileText size={16} />
                <span>No resume was uploaded — ATS scored from profile data only</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyDashboard;
