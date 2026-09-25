import axios from 'axios';
import {authService} from './authService.js';

const API_BASE_URL=import.meta.env.VITE_API_URL||'http://localhost:5001';

const api=axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
    // Enable cookies for HTTP-only cookie auth
    withCredentials: true,
    timeout: 30000,
});

/**
 * Request interceptor
 * Add auth token from secure cookie automatically (browser sends cookies)
 */
api.interceptors.request.use(
    (config) =>
    {
        // Token is sent automatically in HTTP-only cookie via withCredentials
        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * Response interceptor
 * Handle auth errors and refresh tokens
 */
api.interceptors.response.use(
    (response) =>
    {
        // On successful login/register, store user data
        if (response.data.data?.user&&(response.config.url.includes('/login')||response.config.url.includes('/register')||response.config.url.includes('/face-login')))
        {
            authService.setUser(response.data.data.user);
        }
        return response;
    },
    (error) =>
    {
        // Handle 401 Unauthorized (token expired or invalid)
        if (error.response?.status===401)
        {
            const url=error.config?.url||'';
            // Don't redirect for auth endpoints (login/register handle their own errors)
            // Don't redirect if already on login page
            const isAuthEndpoint=url.includes('/auth/');
            const isOnLoginPage=window.location.pathname==='/login'||window.location.pathname==='/register';

            if (!isAuthEndpoint&&!isOnLoginPage)
            {
                console.warn('[API] Unauthorized - clearing auth');
                authService.logout();
                window.location.href='/login';
            }
            return Promise.reject(error);
        }

        // Handle 403 Forbidden
        if (error.response?.status===403)
        {
            console.warn('[API] Access denied');
        }

        // Handle rate limiting
        if (error.response?.status===429)
        {
            const retryAfter=error.response.headers['retry-after']||60;
            console.warn(`[API] Rate limited. Retry after ${retryAfter}s`);
        }

        return Promise.reject(error);
    }
);

// ── Auth APIs ──────────────────────────────────────────────────────
export const register=(data) => api.post('/auth/register', data);
export const login=(username, password) => api.post('/auth/login', {username, password});
export const faceLogin=(descriptor) => api.post('/auth/face-login', {descriptor});
export const logout=() => api.post('/auth/logout');
export const verify=() => api.get('/auth/verify');
export const refreshToken=() => api.post('/auth/refresh');
export const sendOtp=(email, purpose) => api.post('/auth/send-otp', {email, purpose});
export const verifyOtp=(email, otp, purpose) => api.post('/auth/verify-otp', {email, otp, purpose});
export const forgotPassword=(email) => api.post('/auth/forgot-password', {email});
export const resetPassword=(email, password, confirmPassword) => api.post('/auth/reset-password', {email, password, confirmPassword});

// ── Interview APIs ─────────────────────────────────────────────────
export const createInterview=(data) => api.post('/interview/create', data);
export const getInterview=(id) => api.get(`/interview/${id}`);
export const endInterview=(id, data) => api.post(`/interview/${id}/end`, data);
export const addQuestion=(id, question) => api.post(`/interview/${id}/question`, question);
export const addSubmission=(id, submission) => api.post(`/interview/${id}/submission`, submission);
export const getInterviewReport=(id) => api.get(`/interview/${id}/report`);
export const getInterviewLeaderboard=() => api.get('/interview/leaderboard/all');
export const scheduleInterview=(data) => api.post('/interview/schedule', data);
export const getMyInterviews=() => api.get('/interview/my-interviews');
export const getJobInterviews=(jobId) => api.get(`/interview/job/${jobId}`);

// ── Question APIs ──────────────────────────────────────────────────
export const getQuestions=(params) => api.get('/questions', {params});
export const getQuestion=(id) => api.get(`/questions/${id}`);
export const getRandomQuestions=(count) => api.get(`/questions/random/${count}`);
export const createQuestion=(data) => api.post('/questions', data);
export const updateQuestion=(id, data) => api.put(`/questions/${id}`, data);
export const deleteQuestion=(id) => api.delete(`/questions/${id}`);

// ── Code Execution APIs ────────────────────────────────────────────
export const executeCode=(data) => api.post('/code-execution/execute', data);
export const submitCode=(data) => api.post('/code-execution/submit', data);

// ── Proctoring APIs ────────────────────────────────────────────────
export const sendProctoringEvent=(interviewId, event) => api.post('/proctoring/event', {
    interviewId,
    eventType: event.eventType||event.type,
    severity: event.severity||'low',
    description: event.description||'',
    metadata: event.metadata||{},
});
export const getProctoringEvents=(interviewId) => api.get(`/proctoring/${interviewId}`);
export const getIntegrityScore=(interviewId) => api.get(`/proctoring/${interviewId}/score`);
export const verifyFaceIdentity=(interviewId, descriptor) => api.post('/proctoring/verify-face', {interviewId, descriptor});

// ── AI APIs ────────────────────────────────────────────────────────
export const generateAIQuestion=(data) => api.post('/ai/generate-question', data);
export const generateQuestion=(data) => api.post('/ai/ask-question', data); // legacy
export const evaluateCode=(data) => api.post('/ai/evaluate-code', data);
export const generateFeedback=(data) => api.post('/ai/generate-feedback', data);
export const interviewChat=(data) => api.post('/ai/interview-chat', data);

// ── Profile APIs ───────────────────────────────────────────────────
export const getProfile=() => api.get('/profile');
export const updateProfile=(data) => api.put('/profile', data);

export {API_BASE_URL};
export default api;
