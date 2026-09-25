# 🏗️ EDU-AI System Architecture & Technical Specification

> **Next-Gen AI Learning, Placement, 3D Virtual AI Recruiter & Voice Telephony Platform**  
> **Repository**: [github.com/parthsharma17prs/eduai](https://github.com/parthsharma17prs/eduai)  
> **Version**: 2.0.0 Production Ready

---

## 1. Executive Summary

**EDU-AI** is a multi-modal, end-to-end recruitment, learning, and assessment ecosystem designed to streamline candidate evaluation, real-time code proctoring, 3D conversational avatar interviews, and automated telephonic voice screening.

```mermaid
graph TB
    subgraph "Clients & Interfaces"
        Candidate["👤 Candidate Portal<br/>(React 18 + Vite + Three.js)"]
        Recruiter["🏢 Recruiter / Admin Hub<br/>(Analytics & ATS Scoring)"]
        MobilePhone["📱 Candidate Mobile Phone<br/>(Telephonic PSTN / Cellular)"]
    end

    subgraph "Gateway & Telephony Layer"
        Nginx["Reverse Proxy / Railway Gateway"]
        TwilioVoice["Twilio Voice Media Stream<br/>(WebSocket Gateway)"]
    end

    subgraph "Core Backend Services (Node.js / Express / Socket.IO)"
        Server["Central API & Socket Server<br/>(Port: 5001)"]
        AuthService["Authentication & RBAC<br/>(JWT + bcrypt)"]
        AIEngine["AI Prompt & Interview Engine<br/>(Adaptive Groq LLM)"]
        CallingService["Voice AI Dispatcher<br/>(Ultravox Stream Bridge)"]
        ProctorService["Proctoring & Face Biometrics<br/>(Pinecone + Face-API)"]
        ContestService["Live Contests & Quizzes<br/>(Socket.IO Rooms)"]
        CodeRunner["Sandboxed Code Execution Engine<br/>(JS / Python / Java)"]
    end

    subgraph "External AI & Vector Clouds"
        GroqCloud["⚡ Groq AI (Llama 3.3 70B / 120B)<br/>Low-Latency Reasoning"]
        UltravoxAI["🎙️ Ultravox Real-Time Voice WebSockets<br/>Full-Duplex Speech AI"]
        PineconeDB["🌲 Pinecone Vector Database<br/>Biometric Face Embeddings"]
        AtlasMongoDB["🍃 MongoDB Atlas<br/>Multi-Tenant Database"]
    end

    Candidate -->|HTTPS / WSS| Nginx
    Recruiter -->|HTTPS / WSS| Nginx
    MobilePhone <-->|Cellular Audio| TwilioVoice

    Nginx --> Server
    TwilioVoice <-->|Bi-directional Audio Stream| UltravoxAI
    Server --> CallingService
    CallingService -->|REST & TwiML| TwilioVoice
    CallingService -->|WebSocket Session| UltravoxAI

    Server --> AuthService
    Server --> AIEngine
    Server --> ProctorService
    Server --> ContestService
    Server --> CodeRunner

    AIEngine --> GroqCloud
    ProctorService --> PineconeDB
    Server --> AtlasMongoDB
```

---

## 2. Component Architecture

### 2.1 Frontend Architecture (`/frontend`)
- **Core Framework**: React 18 with Vite build tooling, React Router v7.
- **3D Graphics & Avatar Engine**: Three.js procedural avatar rendering, GLTF model loading with morph targets (`jawOpen`, `viseme_aa`, `mouthSmile`), and CSS holographic fallbacks.
- **Audio & Speech Pipeline**: Web Speech API for continuous speech-to-text recognition and browser SpeechSynthesis for voice playback.
- **State Management**: React Context (`FeatureProvider`), custom hooks for proctoring sensors, audio recording, and WebSocket event subscribers.
- **Styling**: Modern dark mode cyber aesthetic, glassmorphism, responsive flex/grid layouts, Lucide icons.

### 2.2 Backend Architecture (`/backend`)
- **Server Framework**: Node.js with Express (ES Modules), HTTP server integrated with Socket.IO.
- **Real-Time Layer**: Socket.IO namespace and room management for live peer-to-peer recruiter interviews, coding contests, and real-time live quizzes.
- **Security & Middleware**: Rate limiting, CSRF tokens, Helmet security headers, timeout guards, and flexible JWT authentication (`verifyAuth` and `verifyAuthOptional`).

---

## 3. Real-Time Data Flow Pipelines

### 3.1 3D AI Avatar Virtual Interview Flow
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate (Browser)
    participant UI as 3D Avatar Stage (Three.js)
    participant API as Backend (/api/ai-interview)
    participant Groq as Groq AI Cloud

    Candidate->>API: POST /create (Role, Level, Resume Skills)
    API->>Groq: Generate tailored technical questions
    Groq-->>API: Shuffled adaptive questions
    API-->>Candidate: Session Created + First Question
    Candidate->>UI: Render 3D Recruiter & Speak Greeting (TTS)
    UI->>Candidate: Lip-sync animation & speech playback
    Candidate->>UI: Voice Response (Web Speech API)
    Candidate->>API: POST /:sessionId/answer (Transcript)
    API->>Groq: Evaluate answer correctness & score (1-10)
    Groq-->>API: Score, Feedback, Next Adaptive Question
    API-->>Candidate: Next Question / Final Report
```

### 3.2 Twilio + Ultravox AI Phone Calling Pipeline
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate (Mobile Phone)
    participant Dashboard as Candidate Dashboard
    participant Backend as Express Backend
    participant Twilio as Twilio Cloud (PSTN)
    participant Ultravox as Ultravox Voice AI Engine

    Dashboard->>Backend: POST /api/ai-calling/initiate-call (Phone Number)
    alt Number is not +918319556016
        Backend-->>Dashboard: Require OTP Verification
        Dashboard->>Backend: POST /api/ai-calling/verify-otp (Code: 482910)
        Backend-->>Dashboard: Verification Confirmed
    end
    Backend->>Ultravox: POST /api/calls (Recruiter System Prompt)
    Ultravox-->>Backend: joinUrl (WebSocket Stream Gateway)
    Backend->>Twilio: twilio.calls.create (TwiML with <Stream url="joinUrl" />)
    Twilio->>Candidate: Outbound Phone Call Ringing & Connect
    Twilio<->>Ultravox: Direct Bi-Directional PCM Audio Stream
    Ultravox<->>Candidate: Full-Duplex Voice Dialogue (Speech-to-Speech)
    Backend->>Dashboard: Live Call Status & Real-time Transcript Polling
```

---

## 4. Live Quizzes & Coding Contests Architecture

```mermaid
graph LR
    Host["👨‍🏫 Host / Company Admin<br/>(Creates Quiz / Contest)"] -->|POST /api/quiz/create| DB[("🍃 MongoDB")]
    Host -->|Socket Emit: host-join| SocketServer["🔌 Socket.IO Server"]
    
    Player1["👤 Candidate 1"] -->|Socket: join-quiz (CODE01)| SocketServer
    Player2["👤 Candidate 2"] -->|Socket: join-quiz (CODE01)| SocketServer
    
    SocketServer -->|Broadcast: auto-start / question-reveal| Player1
    SocketServer -->|Broadcast: auto-start / question-reveal| Player2
    
    Player1 -->|Emit: submit-answer| SocketServer
    Player2 -->|Emit: submit-answer| SocketServer
    
    SocketServer -->|Leaderboard Update| Host
    SocketServer -->|Live Ranking & Feedback| Player1
    SocketServer -->|Live Ranking & Feedback| Player2
```

---

## 5. Security, Proctoring & Biometrics

| Layer | Implementation | Protection |
| :--- | :--- | :--- |
| **Face Biometrics** | `face-api.js` + Pinecone Vector DB | Verifies candidate identity continuously; flags unauthorized face substitutions. |
| **Environment Sensor** | Dual-Camera Stream (Webcam + Mobile Feed) | 360-degree secondary view of candidate workspace. |
| **Anti-Cheating Detection** | Visibility API & Window Blur Tracking | Detects tab-switching, secondary monitors, copy-paste events. |
| **Phone Fraud Protection** | OTP Verification Engine | Restricts AI phone screening to verified phone numbers. |
| **API Armor** | Helmet + CSRF + Rate Limiting | Prevents DDoS, brute-force attacks, and cross-origin abuse. |

---

## 6. Railway & Cloud Deployment Topology

```mermaid
graph TD
    subgraph "Railway.app Cloud"
        Nixpacks["Nixpacks Builder (Node 20)"]
        BuildStep["Build: cd frontend && npm run build"]
        StartStep["Start: cd backend && node server.js"]
        
        Nixpacks --> BuildStep
        BuildStep --> StartStep
        
        subgraph "Single Unified Container (Port: 5001)"
            StaticFiles["Frontend Static Assets<br/>(/frontend/dist)"]
            ExpressApp["Express API Engine & Socket.IO<br/>(/api/*, /socket.io)"]
        end
        StartStep --> ExpressApp
        ExpressApp -->|Serves on root & routes| StaticFiles
    end

    subgraph "External Cloud Infrastructure"
        MongoCluster[("🍃 MongoDB Atlas")]
        GroqLLM["⚡ Groq AI API"]
        TwilioPSTN["📞 Twilio Telephony"]
        UltravoxWS["🎙️ Ultravox Voice Stream"]
        PineconeCloud["🌲 Pinecone Vector Store"]
    end

    ExpressApp <--> MongoCluster
    ExpressApp <--> GroqLLM
    ExpressApp <--> TwilioPSTN
    ExpressApp <--> UltravoxWS
    ExpressApp <--> PineconeCloud
```

---

## 7. Tech Stack Matrix

- **Frontend**: React 18, Vite, Three.js, Lucide Icons, Framer Motion, Axios, Socket.IO Client.
- **Backend**: Node.js, Express, Socket.IO, Mongoose, Twilio SDK, Axios, JWT, CORS.
- **AI & ML**: Groq Cloud (Llama 3.3), Ultravox Realtime Voice AI, Pinecone Vector Database, Face-API.js.
- **Deployment**: Railway Nixpacks, Docker/Procfile compatible, Vercel ready.
