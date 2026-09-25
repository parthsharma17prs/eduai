# 📊 EDU-AI Presentation Deck
## *Next-Gen AI Learning, Placement, 3D Virtual AI Recruiter & Real-Time Voice Telephony*

---

### Slide 1: Title & Vision
# 🎓 EDU-AI Platform
### Transforming Recruitment & Learning with Multi-Modal AI

- **Tagline**: The all-in-one AI ecosystem for automated candidate screening, 3D avatar interviews, live coding contests, and intelligent ATS placement.
- **Presenter**: Parth Sharma & The EDU-AI Engineering Team
- **Demo Video**: [Watch on YouTube](https://youtu.be/X7wJoscMq6A?si=-YaKwzva1m2CD9Fi)
- **GitHub**: [github.com/parthsharma17prs/eduai](https://github.com/parthsharma17prs/eduai)

---

### Slide 2: The Core Problem
### ⚠️ Current Challenges in Technical Hiring & Campus Placement
1. **Recruiter Burnout**: Hundreds of manual phone screens and resume reviews with inconsistent rubrics.
2. **Cheating & Impersonation**: Traditional online assessments suffer from unauthorized assistance and tab-switching.
3. **Lack of Immersive Practice**: Candidates lack realistic interview environments before facing live technical panels.
4. **Disjointed Assessment Tools**: Quizzes, coding challenges, video calls, and phone screens exist in separate silos.

---

### Slide 3: The Solution: EDU-AI
### 💡 A Unified Multi-Modal AI Platform
- **🤖 3D Virtual AI Recruiter Avatar**: Realistic Three.js interviewer with live speech recognition, real-time lip sync, and adaptive questioning.
- **📞 AI Voice Calling Agent**: Outbound telephonic screening via Twilio and Ultravox full-duplex speech AI.
- **🛡️ AI Proctoring & Biometrics**: Continuous face verification via Pinecone vector embeddings + dual-camera detection.
- **⚡ Live Quizzes & Coding Contests**: Instant zero-wait multiplayer contests with real-time leaderboards.
- **🏢 Enterprise ATS Scoring**: Automated candidate ranking, project analytics, and structured scorecard reports.

---

### Slide 4: Feature Deep-Dive — 3D AI Avatar Interview
### 🤖 Next-Gen 3D Interactive Interview Stage
- **Visuals**: Procedural 3D executive avatar and GLTF ReadyPlayerMe models in Three.js.
- **Interactive Speech**: Web Speech API speech-to-text with zero lag, coupled with natural voice TTS narration.
- **Resume Parsing**: Generates questions directly from candidate CV/resume skill text or customizable role profiles.
- **Evaluation Engine**: Automated rubric evaluating Technical Depth, Problem Solving, Communication, and Architecture.

---

### Slide 5: Feature Deep-Dive — Real-Time Voice Calling Agent
### 🎙️ Twilio + Ultravox Voice Telephony Streaming
- **Full-Duplex Speech AI**: Sub-second conversational responses over standard telephone calls (PSTN / Mobile).
- **Automated Screening Flow**: Introduces recruiter persona, inquires about core tech stack, and records live transcript.
- **Security & Anti-Fraud**: Integrated OTP verification system ensuring authorized phone numbers.
- **Live Video Demo**: Available on YouTube ([https://youtu.be/X7wJoscMq6A](https://youtu.be/X7wJoscMq6A)).

---

### Slide 6: Feature Deep-Dive — Live Contests & Quizzes
### 🏆 Real-Time Multiplayer Assessments
- **Instant Join**: Direct test entry via access codes (`CODE01`, `QUIZ01`) with immediate test start.
- **Live Code Execution Engine**: Multi-language test runner (JavaScript, Python, Java) with public and hidden test cases.
- **Dynamic Leaderboards**: Socket.IO powered real-time scoreboard synchronization for both hosts and participants.

---

### Slide 7: Technical Architecture & Tech Stack
### 🏗️ Enterprise-Grade Cloud Architecture
- **Frontend**: React 18, Vite, Three.js, Lucide Icons, Framer Motion, Socket.IO Client.
- **Backend**: Node.js, Express, Socket.IO, Mongoose, Twilio SDK.
- **AI Cloud Services**:
  - **Groq AI (Llama 3.3 70B/120B)**: Low-latency adaptive question generation and grading.
  - **Ultravox Real-Time AI**: WebSockets streaming conversational voice engine.
  - **Pinecone Vector Database**: High-dimensional face embeddings for biometric verification.
  - **MongoDB Atlas**: Scalable multi-tenant document store.

---

### Slide 8: Deployment & Railway Readiness
### 🚆 Ready for Cloud Production
- **Unified Fullstack Deployment**: Configured with Nixpacks, `railway.json`, `Procfile`, and root `package.json`.
- **Automated Healthchecks**: Integrated `/api/health` and `/live` endpoints.
- **Static Asset Serving**: Express serves production-compiled Vite client assets directly with SPA fallback routing.

---

### Slide 9: Impact & Roadmap
### 📈 Platform Impact & Future Horizons
- **85% Faster** initial screening turnaround time.
- **99% Proctoring Accuracy** with multi-sensor biometric tracking.
- **Roadmap Ahead**:
  - Multilingual voice agent (Hindi, Spanish, German, Mandarin).
  - AR/VR headset spatial interview room support.
  - AI Behavioral Micro-expression and eye-tracking sentiment analysis.

---

### Slide 10: Conclusion & Q&A
### 🎯 Thank You!
- **Platform URL**: `http://localhost:5173`
- **GitHub Repository**: [github.com/parthsharma17prs/eduai](https://github.com/parthsharma17prs/eduai)
- **Demo Video**: [https://youtu.be/X7wJoscMq6A?si=-YaKwzva1m2CD9Fi](https://youtu.be/X7wJoscMq6A?si=-YaKwzva1m2CD9Fi)
