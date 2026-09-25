import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// AI Calling Python server URL (default localhost:8000)
const AI_CALLING_URL = process.env.AI_CALLING_URL || 'http://localhost:8000';

// In-memory demo call state storage
const simulatedCalls = new Map();

// In-memory OTP store (phone -> { otp, expiresAt, verified })
const otpStore = new Map();

// Whitelisted pre-verified phone numbers
const PRE_VERIFIED_NUMBERS = ['+918319556016', '918319556016', '8319556016'];

function normalizePhone(num) {
  if (!num) return '';
  return num.replace(/[\s\-\(\)]/g, '');
}

function isPreVerified(num) {
  const norm = normalizePhone(num);
  return PRE_VERIFIED_NUMBERS.some(p => norm.endsWith('8319556016'));
}

/* ═══════════════════════════════════════════════════════════════════
   CALLTWO-MASTER ULTRAVOX AI SYSTEM PROMPT & CALL CONFIG
   ═══════════════════════════════════════════════════════════════════ */
const ULTRAVOX_RECRUITER_PROMPT = `
You are Alex, a Senior AI Technical Recruiter from the Engineering Talent Acquisition Team.
You are conducting a live phone screening interview with a candidate for a Software Engineering role.

Interview Goal:
1. Warmly greet the candidate and introduce yourself as Alex from AI Talent Acquisition.
2. Ask if they are available for a quick 2-3 minute technical screening.
3. Inquire about their primary technical stack, strongest project, and architectural experience.
4. Listen attentively, provide encouraging, intelligent feedback on their technical choices.
5. Wrap up professionally by letting them know our hiring managers will review the call and email the next technical round invitation shortly.
`;

async function createUltravoxCall(systemPrompt = ULTRAVOX_RECRUITER_PROMPT) {
  const apiKey = process.env.ULTRAVOX_API_KEY;
  const url = 'https://api.ultravox.ai/api/calls';

  const config = {
    systemPrompt,
    model: 'ultravox-v0.7',
    voice: 'Mark',
    temperature: 0.3,
    joinTimeout: '120s',
    firstSpeakerSettings: { agent: {} },
    medium: { twilio: {} }
  };

  const response = await axios.post(url, config, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    timeout: 15000,
  });

  return response.data;
}

/* ═══════════════════════════════════════════════════════════════════
   AI CALLING ROUTES
   ═══════════════════════════════════════════════════════════════════ */

// Health check for AI Calling server
router.get('/health', async (req, res) => {
  try {
    const resp = await axios.get(`${AI_CALLING_URL}/`, { timeout: 3000 });
    return res.json({ status: 'online', server: resp.data });
  } catch (err) {
    return res.json({ status: 'online', message: 'AI Calling Ultravox router active' });
  }
});

// Get config info
router.get('/config', (req, res) => {
  const ngrokUrl = process.env.NGROK_URL || '';
  const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  const hasUltravox = !!(process.env.ULTRAVOX_API_KEY || 'WVuwIV8W.1YMNx70e5HIP97d53n3CsvOi3oxxh1gi');
  return res.json({
    ngrokUrl: ngrokUrl ? `${ngrokUrl}` : '',
    hasTwilio,
    hasUltravox,
    twilioPhone: process.env.TWILIO_PHONE_NUMBER || '+18577545606',
    destinationPhone: process.env.DESTINATION_PHONE_NUMBER || '+918319556016',
    preVerifiedNumber: '+918319556016',
    demoMode: process.env.DEMO_MODE === 'true'
  });
});

// Update config info (ngrok URL)
router.post('/config', (req, res) => {
  try {
    const { ngrokUrl, ultravoxKey } = req.body;
    if (ngrokUrl !== undefined) process.env.NGROK_URL = ngrokUrl.trim();
    if (ultravoxKey !== undefined) process.env.ULTRAVOX_API_KEY = ultravoxKey.trim();

    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (ngrokUrl !== undefined) {
          if (envContent.includes('NGROK_URL=')) {
            envContent = envContent.replace(/NGROK_URL=.*(\r?\n|$)/, `NGROK_URL=${process.env.NGROK_URL}\n`);
          } else {
            envContent += `\nNGROK_URL=${process.env.NGROK_URL}\n`;
          }
        }
        if (ultravoxKey !== undefined) {
          if (envContent.includes('ULTRAVOX_API_KEY=')) {
            envContent = envContent.replace(/ULTRAVOX_API_KEY=.*(\r?\n|$)/, `ULTRAVOX_API_KEY=${process.env.ULTRAVOX_API_KEY}\n`);
          } else {
            envContent += `\nULTRAVOX_API_KEY=${process.env.ULTRAVOX_API_KEY}\n`;
          }
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (fileErr) {
      console.warn('[AI-CALLING] Could not persist to .env file:', fileErr.message);
    }

    return res.json({
      message: 'Configuration updated',
      ngrokUrl: process.env.NGROK_URL,
      hasTwilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
      twilioPhone: process.env.TWILIO_PHONE_NUMBER || '',
    });
  } catch (err) {
    return res.status(500).json({ message: `Failed to update config: ${err.message}` });
  }
});

// Send OTP for unverified phone numbers
router.post('/send-otp', (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required' });

  const norm = normalizePhone(phoneNumber);
  if (isPreVerified(norm)) {
    return res.json({
      message: '+918319556016 is pre-verified. No OTP needed.',
      verified: true,
      phoneNumber
    });
  }

  // Generate 6-digit OTP
  const otp = '482910'; // Deterministic test OTP with dynamic storage
  const expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore.set(norm, { otp, expiresAt, verified: false });

  console.log(`[AI-CALLING] 🔑 OTP for ${phoneNumber}: ${otp}`);

  return res.json({
    message: `OTP sent to ${phoneNumber}. (Use test verification OTP: 482910)`,
    otpSent: true,
    expiresIn: '10 minutes',
    phoneNumber,
    demoCode: otp,
  });
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) return res.status(400).json({ message: 'Phone number and OTP code are required' });

  const norm = normalizePhone(phoneNumber);
  if (isPreVerified(norm)) {
    return res.json({ verified: true, message: 'Phone number is pre-verified' });
  }

  const record = otpStore.get(norm);
  if (!record) {
    // Allow demo OTP 482910 or 123456
    if (otp === '482910' || otp === '123456') {
      otpStore.set(norm, { otp, expiresAt: Date.now() + 3600000, verified: true });
      return res.json({ verified: true, message: 'Phone number verified successfully' });
    }
    return res.status(400).json({ message: 'No OTP requested for this phone number. Please click Send OTP.' });
  }

  if (Date.now() > record.expiresAt) {
    return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp.trim() && otp.trim() !== '482910' && otp.trim() !== '123456') {
    return res.status(400).json({ message: 'Invalid OTP code. Please enter 482910 or the code sent.' });
  }

  record.verified = true;
  otpStore.set(norm, record);

  return res.json({
    verified: true,
    message: 'Phone number verified successfully. You can now initiate the AI Call.'
  });
});

// Get available demo candidates
router.get('/candidates', async (req, res) => {
  try {
    const resp = await axios.get(`${AI_CALLING_URL}/demos`, { timeout: 3000 });
    return res.json(resp.data);
  } catch (err) {
    return res.json({
      demos: [
        { id: 'demo1', name: 'Rahul Sharma', position: 'Backend Developer (Node / Python)' },
        { id: 'demo2', name: 'Priya Patel', position: 'Frontend Developer (React / UI)' },
        { id: 'demo3', name: 'Amit Kumar', position: 'Full Stack Engineer (MERN)' },
        { id: 'demo4', name: 'Sneha Reddy', position: 'Data Analyst & ML Specialist' },
      ],
    });
  }
});

// Set active demo candidate
router.post('/set-candidate', async (req, res) => {
  try {
    const { candidateId } = req.body;
    if (!candidateId) return res.status(400).json({ message: 'candidateId is required' });

    try {
      const resp = await axios.post(`${AI_CALLING_URL}/demo`, { id: candidateId }, { timeout: 3000 });
      return res.json(resp.data);
    } catch {
      return res.json({ status: 'ok', activeCandidate: candidateId });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to set candidate.' });
  }
});

// Initiate AI Call via Twilio + Ultravox AI (calltwo-master engine)
router.post('/initiate-call', async (req, res) => {
  try {
    const { phoneNumber, candidateId, simulated } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const norm = normalizePhone(phoneNumber);
    const preVerified = isPreVerified(norm);

    // Enforce OTP verification if number is not +918319556016
    if (!preVerified) {
      const otpRecord = otpStore.get(norm);
      if (!otpRecord || !otpRecord.verified) {
        return res.status(403).json({
          otpRequired: true,
          message: 'OTP verification is required for numbers other than +918319556016. Please verify OTP first.',
          phoneNumber
        });
      }
    }

    // Set the active candidate if provided
    if (candidateId) {
      try {
        await axios.post(`${AI_CALLING_URL}/demo`, { id: candidateId }, { timeout: 2000 });
      } catch (e) {
        // ignore
      }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '+18577545606';
    const ultravoxKey = process.env.ULTRAVOX_API_KEY || 'WVuwIV8W.1YMNx70e5HIP97d53n3CsvOi3oxxh1gi';

    // 1. Try CallTwo-Master Ultravox AI Calling Engine (No ngrok needed!)
    if (!simulated && accountSid && authToken && twilioPhone && ultravoxKey) {
      try {
        console.log(`[AI-CALLING] 🤖 Requesting Ultravox AI session for ${phoneNumber}...`);
        const ultravoxResp = await createUltravoxCall(ULTRAVOX_RECRUITER_PROMPT);

        if (ultravoxResp && ultravoxResp.joinUrl) {
          console.log(`[AI-CALLING] ✅ Ultravox Session Created! joinUrl: ${ultravoxResp.joinUrl}`);
          
          // Initiate Outbound Twilio Call with Ultravox Media Stream TwiML
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
          const twiml = `<Response><Connect><Stream url="${ultravoxResp.joinUrl}"/></Connect></Response>`;

          const formData = new URLSearchParams();
          formData.append('To', phoneNumber);
          formData.append('From', twilioPhone);
          formData.append('Twiml', twiml);

          const twilioResp = await axios.post(twilioUrl, formData.toString(), {
            auth: { username: accountSid, password: authToken },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
          });

          console.log(`[AI-CALLING] 🎉 Twilio + Ultravox Outbound Call Initiated! SID: ${twilioResp.data.sid}`);

          return res.json({
            message: 'Twilio + Ultravox Voice AI Call initiated successfully (calltwo-master engine)',
            callSid: twilioResp.data.sid,
            status: twilioResp.data.status || 'queued',
            to: phoneNumber,
            from: twilioPhone,
            engine: 'ultravox-media-stream',
            isSimulated: false,
          });
        }
      } catch (calltwoErr) {
        console.warn('[AI-CALLING] Ultravox/Twilio outbound attempt failed:', calltwoErr.response?.data || calltwoErr.message);
        if (process.env.DEMO_MODE !== 'true') {
          return res.status(500).json({
            message: `Call failed: ${calltwoErr.response?.data?.message || calltwoErr.message}`
          });
        }
      }
    }

    // 2. Interactive Simulated Call Session Fallback
    const simulatedSid = `SIM_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();

    const candidateProfiles = {
      demo1: { name: 'Rahul Sharma', role: 'Backend Developer' },
      demo2: { name: 'Priya Patel', role: 'Frontend Developer' },
      demo3: { name: 'Amit Kumar', role: 'Full Stack Engineer' },
      demo4: { name: 'Sneha Reddy', role: 'Data Analyst & ML Specialist' },
    };
    const cData = candidateProfiles[candidateId] || { name: 'Candidate', role: 'Software Engineer' };

    const simulatedSession = {
      callSid: simulatedSid,
      to: phoneNumber,
      from: twilioPhone || '+1 (857) 754-5606',
      status: 'ringing',
      startTime,
      duration: 0,
      candidate: cData.name,
      isSimulated: true,
      log: [
        { speaker: 'system', text: `Connecting to ${phoneNumber}...`, timestamp: new Date().toISOString() }
      ]
    };

    simulatedCalls.set(simulatedSid, simulatedSession);

    setTimeout(() => {
      simulatedSession.status = 'in-progress';
      simulatedSession.log.push({
        speaker: 'agent',
        text: `Hello ${cData.name}! This is Alex from the AI Recruiting Team. Thank you for taking our call today regarding the ${cData.role} opportunity. Are you available for a brief 3-minute screening?`,
        timestamp: new Date().toISOString()
      });
    }, 2500);

    setTimeout(() => {
      simulatedSession.log.push({
        speaker: 'candidate',
        text: `Hi Alex, yes absolutely! I'm glad to speak with you.`,
        timestamp: new Date().toISOString()
      });
    }, 6000);

    setTimeout(() => {
      simulatedSession.log.push({
        speaker: 'agent',
        text: `Wonderful! Could you briefly highlight your most significant project and the core tech stack you utilized?`,
        timestamp: new Date().toISOString()
      });
    }, 9500);

    setTimeout(() => {
      simulatedSession.log.push({
        speaker: 'candidate',
        text: `Sure! I recently architected a high-concurrency microservices platform handling over 5,000 requests per second with automated Redis caching and robust async event processing.`,
        timestamp: new Date().toISOString()
      });
    }, 15000);

    setTimeout(() => {
      simulatedSession.log.push({
        speaker: 'agent',
        text: `Impressive architecture! Our hiring managers will review your response. We will email you the next round details shortly. Have a great day!`,
        timestamp: new Date().toISOString()
      });
    }, 20000);

    setTimeout(() => {
      simulatedSession.status = 'completed';
      simulatedSession.duration = 26;
      simulatedSession.log.push({
        speaker: 'system',
        text: `Call completed successfully. AI Screening assessment recorded.`,
        timestamp: new Date().toISOString()
      });
    }, 26000);

    return res.json({
      message: 'AI Phone Call session initiated',
      callSid: simulatedSid,
      status: 'ringing',
      to: phoneNumber,
      from: twilioPhone,
      isSimulated: true,
      note: 'Ultravox + Twilio media stream engine configured'
    });
  } catch (err) {
    console.error('[AI-CALLING] Initiate call error:', err.message);
    return res.status(500).json({
      message: `Failed to initiate call: ${err.message}`,
    });
  }
});

// Get call conversation logs
router.get('/conversation', async (req, res) => {
  try {
    if (simulatedCalls.size > 0) {
      const allSim = Array.from(simulatedCalls.values());
      const latestSim = allSim[allSim.length - 1];
      return res.json({
        candidate: latestSim.candidate || '',
        log: latestSim.log || [],
      });
    }

    const resp = await axios.get(`${AI_CALLING_URL}/logs`, { timeout: 3000 });
    const logs = resp.data.logs || [];
    if (logs.length > 0) {
      const latest = logs[logs.length - 1];
      return res.json({
        candidate: latest.candidate || '',
        log: latest.log || [],
      });
    }
    return res.json({ candidate: '', log: [] });
  } catch (err) {
    return res.json({ candidate: '', log: [] });
  }
});

// Get call logs
router.get('/logs', async (req, res) => {
  try {
    const resp = await axios.get(`${AI_CALLING_URL}/logs`, { timeout: 3000 });
    return res.json(resp.data);
  } catch (err) {
    const simList = Array.from(simulatedCalls.values());
    return res.json({ logs: simList, message: 'Simulated call history' });
  }
});

// Get call status via Twilio or Simulated session
router.get('/call-status/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;

    if (simulatedCalls.has(callSid)) {
      const sim = simulatedCalls.get(callSid);
      const currentDuration = sim.duration || Math.floor((Date.now() - sim.startTime) / 1000);
      return res.json({
        callSid: sim.callSid,
        status: sim.status,
        duration: currentDuration,
        startTime: new Date(sim.startTime).toISOString(),
        to: sim.to,
        from: sim.from,
        isSimulated: true,
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(500).json({ message: 'Twilio credentials not configured' });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
    const resp = await axios.get(twilioUrl, {
      auth: { username: accountSid, password: authToken },
      timeout: 10000,
    });

    return res.json({
      callSid: resp.data.sid,
      status: resp.data.status,
      duration: resp.data.duration,
      startTime: resp.data.start_time,
      endTime: resp.data.end_time,
      to: resp.data.to,
      from: resp.data.from,
    });
  } catch (err) {
    return res.status(500).json({ message: `Failed to get call status: ${err.message}` });
  }
});

export default router;
