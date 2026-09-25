import dotenv from 'dotenv';
import {fileURLToPath} from 'url';
import path from 'path';
import dns from 'dns';

// Fix local DNS resolution issues (e.g., MongoDB Atlas SRV records) by setting reliable fallback DNS servers
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
    console.warn('⚠️ Failed to configure fallback DNS servers:', err.message);
}

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

// Load environment variables from both backend and root directories
dotenv.config({path: path.join(__dirname, '.env')});
dotenv.config({path: path.join(__dirname, '..', '.env')});
dotenv.config();

// Validate critical environment variables
const REQUIRED_ENV_VARS = [
    'GROQ_API_KEY',
    'MONGODB_URI',
];

const OPTIONAL_ENV_VARS = [
    'PINECONE_FACE_API_KEY',
    'PINECONE_FACE_INDEX',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'ULTRAVOX_API_KEY',
];

const missingRequired = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingRequired.length > 0) {
    console.warn(`⚠️ WARNING: Missing recommended environment variables: ${missingRequired.join(', ')}`);
    console.warn('   To enable full AI features in production (e.g. Railway), add these in your Railway service Variables dashboard.');
} else {
    console.log('✅ Critical environment variables validated');
}

// Check optional Cloudinary variables
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('ℹ️ Cloudinary env vars not set – resume uploads will use local/mock storage');
}

export default {
    PORT: process.env.PORT||5000,
    FRONTEND_URL: process.env.FRONTEND_URL||'http://localhost:5173',
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    // Cloudinary (resume storage)
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME||'',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY||'',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET||'',
    // AI Calling (Twilio + Python server)
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID||'',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN||'',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER||'',
    NGROK_URL: process.env.NGROK_URL||'',
    AI_CALLING_URL: process.env.AI_CALLING_URL||'http://localhost:8000',
};
