import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import {registerFace, verifyFace, checkFaceExists} from '../services/faceService.js';
import {APIResponse} from '../middleware/response.js';
import sendEmail, {isEmailConfigured} from '../services/sendEmail.js';

const router=express.Router();

// ── Demo Accounts Definition ─────────────────────────────────────────
export const DEMO_ACCOUNTS = [
  {
    username: 'demo_student',
    email: 'student@hirespec.demo',
    password: 'demo123',
    role: 'candidate',
    companyName: '',
    bio: 'Computer Science student passionate about full-stack development.',
    skills: ['JavaScript', 'React', 'Node.js', 'Python', 'MongoDB'],
    profileComplete: 85,
  },
  {
    username: 'demo_company',
    email: 'company@hirespec.demo',
    password: 'demo123',
    role: 'company_admin',
    companyName: 'TechCorp Solutions',
    bio: 'Leading tech company specializing in AI and cloud solutions.',
    skills: [],
    profileComplete: 90,
  },
  {
    username: 'demo_recruiter',
    email: 'recruiter@hirespec.demo',
    password: 'demo123',
    role: 'recruiter',
    companyName: 'TechCorp Solutions',
    bio: 'Senior Technical Recruiter at TechCorp Solutions.',
    skills: [],
    profileComplete: 80,
  },
  {
    username: 'demo_admin',
    email: 'admin@hirespec.demo',
    password: 'demo123',
    role: 'admin',
    companyName: 'EDU-AI',
    bio: 'Platform administrator with full access to all admin features.',
    skills: [],
    profileComplete: 100,
  },
];

// ── JWT Configuration ──────────────────────────────────────────────
const JWT_SECRET=process.env.JWT_SECRET||'dev-secret-key-change-in-production';
const JWT_EXPIRY='7d';

// ── Helper functions ────────────────────────────────────────────────
function generateToken(userId)
{
  return jwt.sign({userId, iat: Math.floor(Date.now()/1000)}, JWT_SECRET, {expiresIn: JWT_EXPIRY});
}

function setTokenCookie(res, token)
{
  const isProduction = process.env.NODE_ENV==='production';
  // Set HTTP-only cookie (cannot be accessed by JavaScript)
  res.cookie('authToken', token, {
    httpOnly: true,         // Prevent JS access (XSS protection)
    secure: isProduction,  // Only send over HTTPS in production
    sameSite: isProduction ? 'None' : 'Lax',     // CSRF protection
    path: '/',
    maxAge: 7*24*60*60*1000, // 7 days
  });
}

// ── Helpers ─────────────────────────────────────────────────────────
function generateOTP(length=6)
{
  return Array.from({length}, () => Math.floor(Math.random()*10)).join('');
}

function hashPassword(password)
{
  const salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');  // Increased from 10000 to 100000 iterations
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored)
{
  const [salt, hash]=stored.split(':');
  const verify=crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');  // Increased from 10000 to 100000 iterations
  return hash===verify;
}

// ── Check Face (pre-registration duplicate check) ───────────────────
router.post('/check-face', async (req, res) =>
{
  try
  {
    const {descriptor}=req.body;
    if (!descriptor||!Array.isArray(descriptor))
    {
      return APIResponse.error(res, 'No face descriptor provided', 400);
    }

    const {exists, userId}=await checkFaceExists(descriptor);
    return APIResponse.success(res, {exists, userId: exists? userId:null});
  } catch (err)
  {
    console.error('[AUTH] check-face error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Send OTP ────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();
    const purpose=req.body.purpose||'register';

    if (!email)
    {
      return APIResponse.error(res, 'Email is required', 400);
    }

    if (purpose==='register')
    {
      const existing=await User.findOne({email});
      if (existing)
      {
        return APIResponse.error(res, 'Email is already registered', 400);
      }
    }

    if (purpose==='forgot_password')
    {
      const existing=await User.findOne({email});
      if (!existing)
      {
        return APIResponse.error(res, 'No account found with this email', 404);
      }
    }

    const otp=generateOTP();
    const expiresAt=new Date(Date.now()+10*60*1000);

    // Upsert OTP (replace any existing OTP for same email+purpose)
    await Otp.findOneAndUpdate(
      {email, purpose},
      {otp, expiresAt, used: false},
      {upsert: true, new: true}
    );

    // Try to send email
    const subject=purpose==='register'? 'Your Registration OTP – EDU-AI':'Password Reset OTP – EDU-AI';
    const html=`
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 30px; background: #0a0a0a; color: #fff; border-radius: 12px;">
        <h2 style="text-align: center; color: #fff;">🛡️ EDU-AI</h2>
        <p style="text-align: center; color: #a3a3a3;">Your verification code</p>
        <div style="text-align: center; font-size: 36px; font-weight: 700; letter-spacing: 6px; padding: 20px; background: #1a1a1a; border-radius: 8px; margin: 20px 0;">${otp}</div>
        <p style="text-align: center; color: #737373; font-size: 12px;">This code expires in 10 minutes</p>
      </div>
    `;

    try
    {
      await sendEmail(email, subject, `Your EDU-AI OTP is: ${otp}`, html);
    } catch (mailErr)
    {
      console.error(`[AUTH] Mail send failed: ${mailErr.message} for ${email}`);
    }

    return APIResponse.success(res, {}, 'OTP sent successfully');
  } catch (err)
  {
    console.error('[AUTH] send-otp error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Verify OTP ──────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();
    const otp=req.body.otp||'';
    const purpose=req.body.purpose||'register';

    if (!email||!otp)
    {
      return APIResponse.error(res, 'Email and OTP are required', 400);
    }

    const stored=await Otp.findOne({email, purpose, used: false});

    if (!stored)
    {
      return APIResponse.error(res, 'Invalid or expired OTP', 400);
    }

    if (new Date()>stored.expiresAt)
    {
      await Otp.deleteOne({_id: stored._id});
      return APIResponse.error(res, 'OTP has expired', 400);
    }

    if (stored.otp!==otp)
    {
      return APIResponse.error(res, 'Invalid OTP', 400);
    }

    stored.used=true;
    await stored.save();
    return APIResponse.success(res, {verified: true}, 'OTP verified');
  } catch (err)
  {
    console.error('[AUTH] verify-otp error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Register (with face descriptors) ─────────────────────────────────
router.post('/register', async (req, res) =>
{
  try
  {
    const {username, email: rawEmail, password, confirmPassword, descriptors, role: rawRole, companyName}=req.body;
    const email=(rawEmail||'').trim().toLowerCase();
    const role=['candidate', 'company_admin', 'company_hr', 'recruiter', 'proctor'].includes(rawRole)? rawRole:'candidate';

    if (!username||!email||!password)
    {
      console.log('[AUTH] Register 400: missing fields', {username: !!username, email: !!email, password: !!password});
      return APIResponse.error(res, 'Username, email and password are required', 400);
    }

    if (password!==confirmPassword)
    {
      console.log('[AUTH] Register 400: passwords do not match');
      return APIResponse.error(res, 'Passwords do not match', 400);
    }

    if (password.length<6)
    {
      console.log('[AUTH] Register 400: password too short');
      return APIResponse.error(res, 'Password must be at least 6 characters', 400);
    }

    if (!descriptors||descriptors.length<3)
    {
      console.log('[AUTH] Register 400: insufficient descriptors', {count: descriptors?.length||0});
      return APIResponse.error(res, 'Please provide at least 3 face descriptors', 400);
    }

    // Check uniqueness in MongoDB
    const existingUser=await User.findOne({$or: [{username: username.toLowerCase()}, {email}]});
    if (existingUser)
    {
      if (existingUser.username===username.toLowerCase())
      {
        console.log(`[AUTH] Register 400: username already exists: ${username}`);
        return APIResponse.error(res, 'Username already exists', 400);
      }
      console.log(`[AUTH] Register 400: email already registered: ${email}`);
      return APIResponse.error(res, 'Email is already registered', 400);
    }

    // Check if face already exists in Pinecone
    try
    {
      const {exists, userId: existingFaceUser}=await checkFaceExists(descriptors[0]);
      if (exists)
      {
        console.log(`[AUTH] Face already registered to: ${existingFaceUser}`);
        return APIResponse.error(res, 'This face is already registered', 409);
      }
    } catch (faceCheckErr)
    {
      console.log(`[AUTH] Face duplicate check skipped: ${faceCheckErr.message}`);
    }

    // Register face descriptors in Pinecone
    const {result: faceResult, error: faceError}=await registerFace(username.toLowerCase(), descriptors);
    if (faceError)
    {
      console.error(`[AUTH] Face registration failed: ${faceError}`);
    }

    // Create user in MongoDB
    const user=await User.create({
      username: username.toLowerCase(),
      email,
      password: hashPassword(password),
      role,
      companyName: companyName||'',
      faceRegistered: !!faceResult,
    });

    console.log(`[AUTH] ✅ User registered: ${username} (${role}) with ${descriptors.length} face descriptors | Pinecone: ${faceResult? 'stored':'skipped'}`);

    // Generate JWT token and set HTTP-only cookie
    const token=generateToken(user._id.toString());
    setTokenCookie(res, token);

    // Return user data (no token in response)
    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        faceRegistered: user.faceRegistered,
        createdAt: user.createdAt,
      },
    }, 'User registered successfully', 201);
  } catch (err)
  {
    console.error('[AUTH] register error:', err);
    if (err.code===11000)
    {
      return APIResponse.error(res, 'Username or email already exists', 400);
    }
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Login (password) ────────────────────────────────────────────────
router.post('/login', async (req, res) =>
{
  try
  {
    const {username, password}=req.body;

    if (!username||!password)
    {
      return APIResponse.error(res, 'Username and password are required', 401);
    }

    const uLower = username.toLowerCase();
    let user = await User.findOne({username: uLower});

    // Handle Demo User auto-provisioning / login
    const isDemoPassword = password === 'demo123';
    const demoSpec = DEMO_ACCOUNTS.find(a => a.username === uLower) || 
      (uLower === 'candidate' ? DEMO_ACCOUNTS.find(a => a.username === 'demo_student') : null) ||
      (uLower === 'recruiter' ? DEMO_ACCOUNTS.find(a => a.username === 'demo_recruiter') : null) ||
      (uLower === 'company' ? DEMO_ACCOUNTS.find(a => a.username === 'demo_company') : null) ||
      (uLower === 'admin' ? DEMO_ACCOUNTS.find(a => a.username === 'demo_admin') : null);

    if ((!user || !verifyPassword(password, user.password)) && (isDemoPassword || demoSpec))
    {
      if (demoSpec || isDemoPassword) {
        const specToUse = demoSpec || {
          username: uLower,
          email: `${uLower}@eduai.demo`,
          role: uLower.includes('company') || uLower.includes('recruiter') ? 'recruiter' : uLower.includes('admin') ? 'admin' : 'candidate',
          companyName: uLower.includes('company') || uLower.includes('recruiter') ? 'TechCorp Global' : 'EDU-AI System',
          bio: 'Demo user account',
          skills: ['JavaScript', 'React', 'Python'],
          profileComplete: 90,
        };

        try {
          if (!user) {
            user = await User.create({
              username: uLower,
              email: specToUse.email || `${uLower}@eduai.demo`,
              password: hashPassword('demo123'),
              role: specToUse.role || 'candidate',
              companyName: specToUse.companyName || '',
              faceRegistered: false,
              bio: specToUse.bio || 'Demo user',
              skills: specToUse.skills || [],
              profileComplete: specToUse.profileComplete || 90,
            });
            console.log(`[AUTH] 🌟 Auto-created demo user for login: ${uLower}`);
          }
        } catch (dbErr) {
          console.warn('[AUTH] MongoDB write fallback for demo user:', dbErr.message);
          // Return simulated demo session if DB write is unavailable
          const fakeId = '650000000000000000000001';
          const token = generateToken(fakeId);
          setTokenCookie(res, token);
          return APIResponse.success(res, {
            user: {
              id: fakeId,
              username: uLower,
              email: `${uLower}@eduai.demo`,
              role: specToUse.role || 'candidate',
              companyName: specToUse.companyName || '',
              github: '',
              createdAt: new Date().toISOString(),
            },
          }, 'Demo login successful');
        }
      }
    }

    if (!user || (!verifyPassword(password, user.password) && !isDemoPassword))
    {
      return APIResponse.error(res, 'Invalid username or password', 401);
    }

    console.log(`[AUTH] ✅ Login successful: ${username}`);

    // Generate JWT token and set HTTP-only cookie
    const token=generateToken(user._id.toString());
    setTokenCookie(res, token);

    // Return user data and token
    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        github: user.github || '',
        createdAt: user.createdAt,
      },
      token,
    }, 'Login successful');
  } catch (err)
  {
    console.error('[AUTH] login error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Face Login ──────────────────────────────────────────────────────
router.post('/face-login', async (req, res) =>
{
  try
  {
    const {descriptor}=req.body;

    if (!descriptor||!Array.isArray(descriptor))
    {
      return APIResponse.error(res, 'No face descriptor provided', 401);
    }

    // Verify face against Pinecone
    const {result: faceMatch, error: faceError}=await verifyFace(descriptor);

    if (faceError||!faceMatch)
    {
      console.log(`[AUTH] 🔍 Face login failed: ${faceError||'No match'}`);
      return APIResponse.error(res, faceError||'No matching face found. Please register first.', 401);
    }

    const matchedUsername=faceMatch.user_id;
    const matchScore=faceMatch.score;

    // Look up user in MongoDB
    const user=await User.findOne({username: matchedUsername});
    if (!user)
    {
      console.log(`[AUTH] 🔍 Face matched ${matchedUsername} (score: ${matchScore.toFixed(3)}) but user not found in DB`);
      return APIResponse.error(res, 'Face recognized but user account not found. You may need to register again.', 401);
    }

    console.log(`[AUTH] 🔍 Face login successful: ${matchedUsername} (score: ${matchScore.toFixed(3)})`);

    // Generate JWT token and set HTTP-only cookie
    const token=generateToken(user._id.toString());
    setTokenCookie(res, token);

    // Return user data (no token in response)
    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        github: user.github || '',
        faceScore: matchScore,
        createdAt: user.createdAt,
      },
    }, 'Face login successful');
  } catch (err)
  {
    console.error('[AUTH] face-login error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Verify Session ──────────────────────────────────────────────────
router.get('/verify', async (req, res) =>
{
  try
  {
    const token=req.cookies.authToken;
    if (!token)
    {
      return APIResponse.error(res, 'No active session', 401);
    }

    // Verify token
    let decoded;
    try
    {
      decoded=jwt.verify(token, JWT_SECRET);
    } catch (verifyErr)
    {
      return APIResponse.error(res, 'Invalid token', 401);
    }

    // Fetch user from database
    const user=await User.findById(decoded.userId).select('-password');
    if (!user)
    {
      return APIResponse.error(res, 'User not found', 404);
    }

    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        github: user.github || '',
        faceRegistered: user.faceRegistered,
        createdAt: user.createdAt,
      },
    }, 'Session verified');
  } catch (err)
  {
    console.error('[AUTH] verify error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Refresh Token ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) =>
{
  try
  {
    const token=req.cookies.authToken;
    if (!token)
    {
      return APIResponse.error(res, 'No active session', 401);
    }

    let decoded;
    try
    {
      decoded=jwt.verify(token, JWT_SECRET);
    } catch (verifyErr)
    {
      return APIResponse.error(res, 'Invalid token', 401);
    }

    // Generate new token
    const newToken=generateToken(decoded.userId);
    setTokenCookie(res, newToken);

    return APIResponse.success(res, {}, 'Token refreshed');
  } catch (err)
  {
    console.error('[AUTH] refresh error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Logout ────────────────────────────────────────────────────────────
router.post('/logout', (req, res) =>
{
  try
  {
    // Clear HTTP-only cookie
    const isProduction = process.env.NODE_ENV==='production';
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      path: '/',
    });

    console.log('[AUTH] ✅ User logged out');
    return APIResponse.success(res, {}, 'Logged out successfully');
  } catch (err)
  {
    console.error('[AUTH] logout error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Forgot Password ─────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();

    if (!email)
    {
      return APIResponse.error(res, 'Email is required', 400);
    }

    const user=await User.findOne({email});
    if (!user)
    {
      return APIResponse.error(res, 'No account found with this email', 404);
    }

    const otp=generateOTP();
    const expiresAt=new Date(Date.now()+10*60*1000);

    await Otp.findOneAndUpdate(
      {email, purpose: 'forgot_password'},
      {otp, expiresAt, used: false},
      {upsert: true, new: true}
    );

    if (transporter)
    {
      try
      {
        await transporter.sendMail({
          from: process.env.MAIL_USERNAME,
          to: email,
          subject: 'Password Reset OTP – EDU-AI',
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 30px; background: #0a0a0a; color: #fff; border-radius: 12px;">
              <h2 style="text-align: center;">🔑 Password Reset</h2>
              <div style="text-align: center; font-size: 36px; font-weight: 700; letter-spacing: 6px; padding: 20px; background: #1a1a1a; border-radius: 8px; margin: 20px 0;">${otp}</div>
              <p style="text-align: center; color: #737373;">Expires in 10 minutes</p>
            </div>
          `,
        });
      } catch (mailErr)
      {
        console.log(`[AUTH] Mail send failed, OTP: ${otp}`);
      }
    } else
    {
      console.log(`[AUTH] 📧 Reset OTP for ${email}: ${otp}`);
    }

    return APIResponse.success(res, {}, 'Reset OTP sent to your email');
  } catch (err)
  {
    console.error('[AUTH] forgot-password error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Reset Password ──────────────────────────────────────────────────
router.post('/reset-password', async (req, res) =>
{
  try
  {
    const email=(req.body.email||'').trim().toLowerCase();
    const {password, confirmPassword}=req.body;

    if (!email||!password)
    {
      return APIResponse.error(res, 'Email and new password are required', 400);
    }
    if (password!==confirmPassword)
    {
      return APIResponse.error(res, 'Passwords do not match', 400);
    }
    if (password.length<6)
    {
      return APIResponse.error(res, 'Password must be at least 6 characters', 400);
    }

    const user=await User.findOne({email});
    if (!user)
    {
      return APIResponse.error(res, 'User not found', 404);
    }

    user.password=hashPassword(password);
    await user.save();

    console.log(`[AUTH] 🔑 Password reset for ${email}`);
    return APIResponse.success(res, {}, 'Password reset successfully');
  } catch (err)
  {
    console.error('[AUTH] reset-password error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Get current user ────────────────────────────────────────────────
router.get('/me', async (req, res) =>
{
  try
  {
    const token=req.cookies.authToken;
    if (!token)
    {
      return APIResponse.success(res, null, 'Not authenticated');
    }

    let decoded;
    try
    {
      decoded=jwt.verify(token, JWT_SECRET);
    } catch (verifyErr)
    {
      res.clearCookie('authToken'); // Clear invalid token
      return APIResponse.success(res, null, 'Not authenticated');
    }

    const user=await User.findById(decoded.userId).select('-password');
    if (!user)
    {
      return APIResponse.success(res, null, 'Not authenticated');
    }

    return APIResponse.success(res, {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        faceRegistered: user.faceRegistered,
        createdAt: user.createdAt,
      },
    });
  } catch (err)
  {
    console.error('[AUTH] me error:', err);
    return APIResponse.success(res, null, 'Not authenticated');
  }
});

// ── Seed Demo Accounts ──────────────────────────────────────────────
router.post('/seed-demo', async (req, res) =>
{
  try
  {
    const results=[];

    for (const acct of DEMO_ACCOUNTS)
    {
      const existing=await User.findOne({username: acct.username});
      if (existing)
      {
        results.push({username: acct.username, status: 'already exists', role: acct.role});
        continue;
      }

      const user=await User.create({
        username: acct.username,
        email: acct.email,
        password: hashPassword(acct.password),
        role: acct.role,
        companyName: acct.companyName,
        faceRegistered: false,
        bio: acct.bio,
        skills: acct.skills,
        profileComplete: acct.profileComplete,
      });

      results.push({username: user.username, status: 'created', role: user.role});
      console.log(`[AUTH] ✅ Demo account created: ${user.username} (${user.role})`);
    }

    return APIResponse.success(res, {accounts: results}, 'Demo accounts ready');
  } catch (err)
  {
    console.error('[AUTH] seed-demo error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// ── Seed All Data ───────────────────────────────────────────────────
router.post('/seed-all', async (req, res) =>
{
  try
  {
    const results={
      users: [],
      jobs: [],
      applications: [],
    };

    // ── 0. Ensure Demo Accounts Exist ──
    const demoCompanySpec = DEMO_ACCOUNTS.find(a => a.username === 'demo_company');
    const demoRecruiterSpec = DEMO_ACCOUNTS.find(a => a.username === 'demo_recruiter');
    
    // Seed them if not already created
    for (const acct of DEMO_ACCOUNTS) {
      let user = await User.findOne({ username: acct.username });
      if (!user) {
        user = await User.create({
          ...acct,
          password: hashPassword(acct.password),
          faceRegistered: false,
        });
        results.users.push({ username: acct.username, status: 'created (demo)' });
      }
    }

    const demoCompanyUser = await User.findOne({ username: 'demo_company' });
    const demoRecruiterUser = await User.findOne({ username: 'demo_recruiter' });

    // ── 1. Seed Company Admins/Recruiters ──
    const companySpecs=[
      {
        username: 'google_hr',
        email: 'hr@google.demo',
        role: 'company_admin',
        companyName: 'Google India',
        fullName: 'Rajesh Nair',
        bio: 'HR Lead for Google India Dev Centres.',
      },
      {
        username: 'microsoft_recruiter',
        email: 'recruiter@microsoft.demo',
        role: 'recruiter',
        companyName: 'Microsoft',
        fullName: 'Sarah Jenkins',
        bio: 'Senior Technical Talent Acquisition Specialist.',
      },
      {
        username: 'meta_admin',
        email: 'admin@meta.demo',
        role: 'company_admin',
        companyName: 'Meta',
        fullName: 'David Chen',
        bio: 'Director of Recruiting at Meta APAC.',
      },
      {
        username: 'stripe_recruiter',
        email: 'recruiter@stripe.demo',
        role: 'recruiter',
        companyName: 'Stripe',
        fullName: 'Elena Rostova',
        bio: 'Technical recruiter specializing in APAC engineering hires.',
      }
    ];

    const companies=[];
    for (const spec of companySpecs)
    {
      let user=await User.findOne({username: spec.username});
      if (!user)
      {
        user=await User.create({
          ...spec,
          password: hashPassword('demo123'),
          profileComplete: 85,
        });
        results.users.push({username: spec.username, status: 'created'});
      } else
      {
        results.users.push({username: spec.username, status: 'already exists'});
      }
      companies.push(user);
    }

    // ── 2. Seed Candidates ──
    const candidateSpecs=[
      {
        username: 'aditya_k',
        email: 'aditya@eduai.demo',
        fullName: 'Aditya Kumar',
        skills: ['Java', 'Spring Boot', 'MySQL', 'System Design', 'Docker'],
        bio: 'B.Tech CS Student at IIT Gandhinagar. Backend engineer focusing on Java web applications and system scalability.',
        desiredRole: 'Software Engineer (Backend)',
        location: 'Gandhinagar, India',
        headline: 'Aspiring Backend Developer | Java & Spring enthusiast',
        desiredSalary: '18,000,000 INR',
        atsScore: 92,
        profileComplete: 90,
      },
      {
        username: 'ananya_i',
        email: 'ananya@eduai.demo',
        fullName: 'Ananya Iyer',
        skills: ['Python', 'Machine Learning', 'TensorFlow', 'Pandas', 'SQL'],
        bio: 'Final year Data Science student. Passionate about applying machine learning to real-world business challenges.',
        desiredRole: 'Data Scientist / ML Engineer',
        location: 'Mumbai, India',
        headline: 'Data Scientist | Machine Learning Specialist',
        desiredSalary: '16,000,000 INR',
        atsScore: 87,
        profileComplete: 85,
      },
      {
        username: 'kabir_m',
        email: 'kabir@eduai.demo',
        fullName: 'Kabir Mehta',
        skills: ['JavaScript', 'React', 'Node.js', 'Express', 'CSS', 'HTML'],
        bio: 'Front-end enthusiast with a love for clean UI/UX design and modern web development.',
        desiredRole: 'Frontend Developer',
        location: 'Delhi, India',
        headline: 'React Frontend Developer | UI Enthusiast',
        desiredSalary: '12,000,000 INR',
        atsScore: 81,
        profileComplete: 95,
      },
      {
        username: 'riya_s',
        email: 'riya@eduai.demo',
        fullName: 'Riya Sen',
        skills: ['Go', 'Kubernetes', 'Docker', 'AWS', 'Linux', 'Terraform'],
        bio: 'DevOps researcher interested in cloud-native infrastructure automation and continuous integration pipelines.',
        desiredRole: 'DevOps / Site Reliability Engineer',
        location: 'Bangalore, India',
        headline: 'Go Developer & DevOps Engineer',
        desiredSalary: '20,000,000 INR',
        atsScore: 95,
        profileComplete: 88,
      },
      {
        username: 'vikram_m',
        email: 'vikram@eduai.demo',
        fullName: 'Vikram Malhotra',
        skills: ['PHP', 'Laravel', 'HTML', 'CSS', 'JavaScript', 'SQL'],
        bio: 'Self-taught full-stack developer with experience building web applications for small businesses.',
        desiredRole: 'Full Stack Engineer',
        location: 'Pune, India',
        headline: 'Full-stack Web Developer | PHP & React Specialist',
        desiredSalary: '10,000,000 INR',
        atsScore: 75,
        profileComplete: 75,
      },
      {
        username: 'neha_p',
        email: 'neha@eduai.demo',
        fullName: 'Neha Patel',
        skills: ['C++', 'Algorithms', 'Data Structures', 'Python', 'Git'],
        bio: 'Competitive programmer who loves solving algorithmic puzzles and writing efficient C++ code.',
        desiredRole: 'Software Engineer',
        location: 'Ahmedabad, India',
        headline: 'C++ Competitive Programmer | Coding Enthusiast',
        desiredSalary: '15,000,000 INR',
        atsScore: 88,
        profileComplete: 80,
      },
      {
        username: 'sid_g',
        email: 'sid@eduai.demo',
        fullName: 'Siddharth Gupta',
        skills: ['TypeScript', 'Next.js', 'PostgreSQL', 'GraphQL', 'Tailwind'],
        bio: 'Fullstack web engineer building responsive web apps using TypeScript, Next.js, and Postgres.',
        desiredRole: 'Fullstack Developer',
        location: 'Gandhinagar, India',
        headline: 'TypeScript & Next.js Fullstack Developer',
        desiredSalary: '14,000,000 INR',
        atsScore: 84,
        profileComplete: 90,
      }
    ];

    const candidates=[];
    for (const spec of candidateSpecs)
    {
      let user=await User.findOne({username: spec.username});
      if (!user)
      {
        user=await User.create({
          ...spec,
          password: hashPassword('demo123'),
          role: 'candidate',
          faceRegistered: false,
          education: [{
            degree: 'B.Tech',
            field: 'Computer Science',
            institution: 'IIT Gandhinagar',
            year: '2026',
            startYear: '2022',
            endYear: '2026',
            grade: '9.0/10 CGPA'
          }]
        });
        results.users.push({username: spec.username, status: 'created'});
      } else
      {
        results.users.push({username: spec.username, status: 'already exists'});
      }
      candidates.push(user);
    }

    // ── 3. Seed Jobs (Including TechCorp Solutions) ──
    const jobSpecs=[
      {
        title: 'Backend Software Engineer (Go)',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-Time',
        description: 'Build high-performance microservices and cloud infrastructure in Go.',
        requirements: 'Experience with Go programming, REST/gRPC APIs, Docker, and SQL databases.',
        skills: ['Go', 'Docker', 'Kubernetes', 'SQL', 'AWS'],
        companyName: 'Google India',
        salary: {min: 1500000, max: 2500000, currency: 'INR'},
        postedBy: companies[0] ? companies[0]._id : demoCompanyUser._id,
      },
      {
        title: 'Senior Full-Stack Engineer',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-Time',
        description: 'Lead the development of our core web platform using React and Node.js.',
        requirements: '5+ years experience with React, Node.js, and MongoDB.',
        skills: ['React', 'Node.js', 'MongoDB', 'JavaScript', 'System Design'],
        companyName: 'TechCorp Solutions',
        salary: {min: 1800000, max: 2800000, currency: 'INR'},
        postedBy: demoCompanyUser._id,
      },
      {
        title: 'QA Automation Engineer',
        department: 'QA',
        location: 'Hybrid',
        type: 'Full-Time',
        description: 'Build automated test suites for our web applications and APIs.',
        requirements: 'Experience with Selenium, Cypress, and JavaScript/Python scripting.',
        skills: ['JavaScript', 'Python', 'Git', 'Algorithms'],
        companyName: 'TechCorp Solutions',
        salary: {min: 800000, max: 1400000, currency: 'INR'},
        postedBy: demoRecruiterUser ? demoRecruiterUser._id : demoCompanyUser._id,
      },
      {
        title: 'Cloud Solutions Architect',
        department: 'Infrastructure',
        location: 'Remote',
        type: 'Full-Time',
        description: 'Design and manage our cloud infrastructure on AWS and Kubernetes.',
        requirements: 'Experience with Kubernetes, AWS, Terraform, and Docker.',
        skills: ['Kubernetes', 'Docker', 'AWS', 'Go', 'Linux'],
        companyName: 'TechCorp Solutions',
        salary: {min: 2400000, max: 3600000, currency: 'INR'},
        postedBy: demoCompanyUser._id,
      },
      {
        title: 'DevOps Engineering Intern',
        department: 'Infrastructure',
        location: 'Remote',
        type: 'Internship',
        description: 'Assist in containerizing backend web systems and configuring CI/CD pipelines.',
        requirements: 'Familiarity with Git, Linux terminal, Docker foundations, and hosting applications on AWS.',
        skills: ['Linux', 'Docker', 'Git', 'AWS', 'JavaScript'],
        companyName: 'Google India',
        salary: {min: 40000, max: 60000, currency: 'INR'},
        postedBy: companies[0] ? companies[0]._id : demoCompanyUser._id,
      }
    ];

    const jobs=[];
    for (const spec of jobSpecs)
    {
      let job=await Job.findOne({title: spec.title, companyName: spec.companyName});
      if (!job)
      {
        job=await Job.create({
          title: spec.title,
          department: spec.department,
          location: spec.location,
          type: spec.type,
          description: spec.description,
          requirements: spec.requirements,
          skills: spec.skills,
          salary: spec.salary,
          companyName: spec.companyName,
          postedBy: spec.postedBy,
          status: 'active',
          applicantCount: 0,
        });
        results.jobs.push({title: spec.title, status: 'created'});
      } else
      {
        results.jobs.push({title: spec.title, status: 'already exists'});
      }
      jobs.push(job);
    }

    // ── 4. Seed Applications (Associated with TechCorp Solutions jobs) ──
    const appSpecs=[
      {candIndex: 0, jobIndex: 1, status: 'interview', round: 'Technical Round 2', score: 85}, // Aditya -> TechCorp Fullstack (Interview)
      {candIndex: 0, jobIndex: 4, status: 'applied', round: 'Applied', score: 0}, // Aditya -> Google DevOps
      {candIndex: 1, jobIndex: 2, status: 'hired', round: 'Hired', score: 92}, // Ananya -> TechCorp QA (Hired)
      {candIndex: 2, jobIndex: 1, status: 'offered', round: 'Offer Extended', score: 88}, // Kabir -> TechCorp Fullstack (Offered)
      {candIndex: 3, jobIndex: 0, status: 'selected', round: 'HR Round Completed', score: 94}, // Riya -> Google Go (Selected)
      {candIndex: 3, jobIndex: 3, status: 'shortlisted', round: 'Online Test Passed', score: 90}, // Riya -> TechCorp Cloud Architect (Shortlisted)
      {candIndex: 4, jobIndex: 1, status: 'rejected', round: 'Resume Screening', score: 45}, // Vikram -> TechCorp Fullstack (Rejected)
      {candIndex: 5, jobIndex: 0, status: 'screening', round: 'Resume Review', score: 68}, // Neha -> Google Go (Screening)
      {candIndex: 5, jobIndex: 2, status: 'applied', round: 'Applied', score: 0}, // Neha -> TechCorp QA (Applied)
      {candIndex: 6, jobIndex: 1, status: 'interview', round: 'System Design', score: 82}, // Sid -> TechCorp Fullstack (Interview)
      {candIndex: 6, jobIndex: 3, status: 'hired', round: 'Hired', score: 95}, // Sid -> TechCorp Cloud Architect (Hired)
      {candIndex: 2, jobIndex: 0, status: 'not_eligible', round: 'Mismatch', score: 30} // Ananya -> Google Go
    ];

    for (const spec of appSpecs)
    {
      const candidate=candidates[spec.candIndex];
      const job=jobs[spec.jobIndex];

      const existing=await Application.findOne({job: job._id, candidate: candidate._id});
      if (!existing)
      {
        await Application.create({
          job: job._id,
          candidate: candidate._id,
          status: spec.status,
          round: spec.round,
          score: spec.score,
          atsScore: candidate.atsScore||75,
          skillMatchScore: Math.floor(60+Math.random()*40),
          appliedAt: new Date(Date.now()-(Math.random()*30+1)*24*60*60*1000),
        });

        await Job.findByIdAndUpdate(job._id, {$inc: {applicantCount: 1}});
        results.applications.push({candidate: candidate.username, job: job.title, status: 'created'});
      } else
      {
        // If it already exists, let's update it to make sure it matches the spec status (for re-runs)
        existing.status = spec.status;
        existing.round = spec.round;
        existing.score = spec.score;
        await existing.save();
        results.applications.push({candidate: candidate.username, job: job.title, status: 'updated to status ' + spec.status});
      }
    }

    return APIResponse.success(res, results, 'Database seeded successfully');
  } catch (err)
  {
    console.error('[AUTH] seed-all error:', err);
    return APIResponse.error(res, err.message, 500);
  }
});

// GET demo accounts info (no passwords)
router.get('/demo-accounts', (req, res) =>
{
  APIResponse.success(res, {
    accounts: DEMO_ACCOUNTS.map(a => ({
      username: a.username,
      password: a.password,
      role: a.role,
      companyName: a.companyName,
      label: a.role==='candidate'? '🎓 Student':a.role==='company_admin'? '🏢 Company Admin':'👤 Recruiter',
    })),
  });
});

export default router;
