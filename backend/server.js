// Load environment variables FIRST - must be before other imports
import './config.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import {createServer} from 'http';
import {Server} from 'socket.io';
import {connectMongoDB} from './db/mongodb.js';
import interviewRoutes from './routes/interview.js';
import questionRoutes from './routes/questions.js';
import codeExecutionRoutes from './routes/codeExecution.js';
import proctoringRoutes from './routes/proctoring.js';
import aiRoutes from './routes/ai.js';
import practiceRoutes from './routes/practice.js';
import codingPracticeRoutes from './routes/codingPractice.js';
import cpCodeRoutes from './routes/cpCode.js';
import cpAnalysisRoutes from './routes/cpAnalysis.js';
import cpReportsRoutes from './routes/cpReports.js';
import cpSessionRoutes from './routes/cpSession.js';
import cpQuestionsRoutes from './routes/cpQuestions.js';
import cpAiQuestionsRoutes from './routes/cpAiQuestions.js';
import aiInterviewRoutes from './routes/aiInterview.js';
import axiomChatRoutes from './routes/axiomChat.js';
import specAiChatRoutes from './routes/specAiChat.js';
import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import scoringRoutes from './routes/scoring.js';
import profileRoutes from './routes/profile.js';
import verificationRoutes from './routes/verification.js';
import aiCallingRoutes from './routes/aiCalling.js';
import quizRoutes from './routes/quiz.js';
import contestRoutes from './routes/contest.js';
import adminRoutes from './routes/admin.js';
import announcementRoutes from './routes/announcements.js';
import featureConfigRoutes from './routes/featureConfig.js';
import {setupSocketHandlers} from './socket/handlers.js';
import {setupContestSocketHandlers} from './socket/contestHandlers.js';
import {timeoutMiddleware, aiTimeoutMiddleware} from './middleware/timeout.js';
import {apiRateLimiter, authRateLimiter, aiRateLimiter, codeExecutionRateLimiter} from './middleware/rateLimit.js';
import {requestLoggingMiddleware, errorLoggingMiddleware} from './middleware/logger.js';
import {securityHeadersMiddleware} from './middleware/securityHeaders.js';
import {csrfTokenMiddleware, verifyCSRFToken} from './middleware/csrf.js';
import {initializeLogging, logger} from './services/logging.js';
import {initializeRedis} from './services/cache.js';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
import {startOTPCleanupScheduler} from './scheduler/otpCleanup.js';
import {setupAPIVersioning} from './middleware/apiVersioning.js';

const app=express();
const httpServer=createServer(app);

// Initialize logging service first
const {logger: log}=initializeLogging({
    level: process.env.LOG_LEVEL||'info',
    sentryDsn: process.env.SENTRY_DSN,
    serviceName: 'interview-platform-backend',
});

const FRONTEND_URLS=(process.env.FRONTEND_URL||'http://localhost:5173,http://localhost:5174').split(',').map(u => u.trim());

const io=new Server(httpServer, {
    cors: {
        origin: FRONTEND_URLS,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Middleware
app.use(cors({
    origin: FRONTEND_URLS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-API-Version'],
}));

// Cookie parser for secure HTTP-only cookies and CSRF tokens
app.use(cookieParser());

// Body parser with size limits
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Security headers middleware
app.use(securityHeadersMiddleware);

// HTTPS enforcement in production
if (process.env.NODE_ENV==='production')
{
    app.use((req, res, next) =>
    {
        if (req.header('x-forwarded-proto')!=='https')
        {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else
        {
            next();
        }
    });
}

// Request timeout middleware
app.use(timeoutMiddleware);

// Request logging middleware
app.use(requestLoggingMiddleware);

// CSRF token middleware for GET requests (generate token)
app.use(csrfTokenMiddleware);

// CSRF verification for state-changing requests
// Note: Auth routes are protected by HTTP-only cookies + CORS + SameSite instead
app.use('/api/profile/update', verifyCSRFToken);
app.use('/api/interview/submit', verifyCSRFToken);

// API rate limiting by endpoint type
// Auth endpoints get stricter limits
app.use('/api/auth/send-otp', authRateLimiter);
app.use('/api/auth/verify-otp', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/face-login', authRateLimiter);

// AI endpoints get strict limits due to API costs
app.use('/api/ai/', aiRateLimiter);
app.use('/api/ai-interview/', aiRateLimiter);

// Code execution gets strict limits for security
app.use('/api/code-execution/', codeExecutionRateLimiter);
// Only apply code execution rate limit to actual execution routes, not data reads like /questions
app.use('/api/coding-practice/run', codeExecutionRateLimiter);
app.use('/api/coding-practice/submit', codeExecutionRateLimiter);
// AI generation endpoints in coding-practice get AI rate limit + longer timeout
app.use('/api/coding-practice/generate', aiRateLimiter, aiTimeoutMiddleware);
app.use('/api/coding-practice/hint', aiRateLimiter, aiTimeoutMiddleware);
app.use('/api/coding-practice/detect', aiRateLimiter, aiTimeoutMiddleware);
app.use('/api/coding-practice/analyze', aiRateLimiter, aiTimeoutMiddleware);
app.use('/api/coding-practice/prompt', aiRateLimiter, aiTimeoutMiddleware);

// General API rate limiting
app.use('/api/', apiRateLimiter);

// Initialize MongoDB
console.log('[SERVER] Initializing MongoDB connection...');
await connectMongoDB();

// Initialize Redis cache (optional but recommended)
try
{
    console.log('[SERVER] Initializing Redis cache...');
    await initializeRedis({
        host: process.env.REDIS_HOST||'localhost',
        port: process.env.REDIS_PORT||6379,
        password: process.env.REDIS_PASSWORD,
    });
    console.log('[SERVER] ✅ Redis initialized');
} catch (err)
{
    console.warn('[SERVER] ⚠️ Redis initialization failed, continuing without cache:', err.message);
    console.warn('[SERVER] Note: Some features like distributed sessions may not work across instances');
}

// Start OTP cleanup scheduler
try
{
    console.log('[SERVER] Starting OTP cleanup scheduler...');
    startOTPCleanupScheduler(process.env.OTP_CLEANUP_SCHEDULE||'0 * * * *');
    console.log('[SERVER] ✅ OTP cleanup scheduler started');
} catch (err)
{
    console.error('[SERVER] ❌ OTP cleanup scheduler failed:', err.message);
    // Don't exit - OTP cleanup is nice-to-have, not critical
}

// Error logging middleware (runs after routes but before error handler)
app.use(errorLoggingMiddleware);

// Routes
app.use('/api/interview', interviewRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/code-execution', codeExecutionRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/coding-practice', codingPracticeRoutes);
app.use('/api/cp/code', cpCodeRoutes);
app.use('/api/cp/analysis', cpAnalysisRoutes);
app.use('/api/cp/reports', cpReportsRoutes);
app.use('/api/cp/session', cpSessionRoutes);
app.use('/api/cp/questions', cpQuestionsRoutes);
app.use('/api/cp/ai-questions', cpAiQuestionsRoutes);
app.use('/api/ai-interview', aiInterviewRoutes);
app.use('/api/axiom', axiomChatRoutes);
app.use('/api/spec-ai', specAiChatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/scoring', scoringRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/ai-calling', aiCallingRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/contest', contestRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/feature-config', featureConfigRoutes);

// Setup API versioning (enhanced version routes for future backwards compatibility)
try
{
    setupAPIVersioning(app);
} catch (err)
{
    console.warn('[SERVER] API versioning setup warning:', err.message);
}

// Enhanced health check endpoint
app.get('/api/health', (req, res) =>
{
    res.json({
        status: 'ok',
        message: 'Server is operational',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: {
            mongodbConnected: true, // TODO: Check actual connection status
            redisConnected: false, // TODO: Check actual Redis status
            apiVersion: '1.0.0'
        }
    });
});

// Readiness check endpoint (for Kubernetes liveness probes)
app.get('/ready', (req, res) =>
{
    // This would normally check if all services are ready
    res.status(200).json({ready: true});
});

// Liveness check endpoint (for Kubernetes readiness probes)
app.get('/live', (req, res) =>
{
    res.status(200).json({alive: true});
});

// Serve frontend static build (Railway / Production deployment)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath))
{
    console.log('[SERVER] Serving static frontend build from:', frontendDistPath);
    app.use(express.static(frontendDistPath));
    app.get('*', (req, res, next) =>
    {
        if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/twiml') || req.path.startsWith('/webhook'))
        {
            return next();
        }
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

// 404 handler for unmatched API routes
app.use((req, res) =>
{
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} does not exist`,
        timestamp: new Date().toISOString(),
    });
});

// Central error handler (must be last)
app.use((err, req, res, next) =>
{
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        userId: req.user?.id,
    });

    // Don't expose internal error details in production
    const isDevelopment=process.env.NODE_ENV!=='production';
    const errorDetails=isDevelopment? err.message:'Internal server error';

    res.status(err.statusCode||500).json({
        success: false,
        error: err.statusCode===401? 'Unauthorized':'Server Error',
        message: errorDetails,
        ...(isDevelopment&&{stack: err.stack}),
        timestamp: new Date().toISOString(),
    });
});

// Setup Socket.IO handlers
setupSocketHandlers(io);
setupContestSocketHandlers(io);

const PORT=process.env.PORT||5000;
httpServer.listen(PORT, () =>
{
    logger.info(`Backend server started`, {
        port: PORT,
        environment: process.env.NODE_ENV||'development',
        mongodbUri: process.env.MONGODB_URI? 'configured':'missing',
    });
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV||'development'}`);
    console.log(`📊 Logging to: console, files, ${process.env.SENTRY_DSN? 'Sentry':'local only'}`);
});

// Graceful shutdown handlers
process.on('SIGTERM', async () =>
{
    logger.info('SIGTERM signal received: initiating graceful shutdown');
    console.log('📋 SIGTERM signal received: closing HTTP server');

    httpServer.close(async () =>
    {
        logger.info('HTTP server closed');
        console.log('✅ HTTP server closed');

        // Cleanup async operations
        try
        {
            // Close Redis connection if available
            const {disconnectRedis}=await import('./services/cache.js');
            await disconnectRedis();
            logger.info('Redis disconnected');
        } catch (err)
        {
            logger.warn('Redis disconnect warning:', err.message);
        }

        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() =>
    {
        logger.error('Forced shutdown after grace period timeout');
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
});

process.on('SIGINT', async () =>
{
    logger.info('SIGINT signal received: initiating graceful shutdown');
    console.log('📋 SIGINT signal received: closing HTTP server');

    httpServer.close(async () =>
    {
        logger.info('HTTP server closed');
        console.log('✅ HTTP server closed');
        process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() =>
    {
        logger.error('Forced shutdown after grace period timeout');
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) =>
{
    logger.error('Uncaught exception:', {
        message: err.message,
        stack: err.stack,
    });
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) =>
{
    logger.error('Unhandled promise rejection:', {
        reason: reason instanceof Error? reason.message:String(reason),
        promise: String(promise),
    });
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejection - could be transient
});
