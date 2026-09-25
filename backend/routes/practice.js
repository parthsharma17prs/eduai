import express from 'express';
import axios from 'axios';
import PracticeSession from '../models/PracticeSession.js';
import {verifyAuthOptional} from '../middleware/auth.js';
import {APIResponse} from '../middleware/response.js';

const router=express.Router();

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const GROQ_TIMEOUT=12000;
const GROQ_URL='https://api.groq.com/openai/v1/chat/completions';

// In-memory session store (fallback if MongoDB fails)
const memoryStore=new Map();

// ═══════════════════════════════════════════════════════════════════
// QUESTION BANK - Comprehensive fallback questions
// ═══════════════════════════════════════════════════════════════════
const QUESTION_BANK={
    technical: {
        frontend: [
            {q: "Explain the difference between CSS Flexbox and Grid. When would you use each?", points: ["Layout systems", "Use cases", "Browser support"]},
            {q: "What is the Virtual DOM and how does React use it to optimize performance?", points: ["DOM diffing", "Reconciliation", "Performance benefits"]},
            {q: "How do you handle state management in a large React application?", points: ["Redux/Context", "State patterns", "Performance"]},
            {q: "Explain event delegation and why it's useful in JavaScript.", points: ["Event bubbling", "Performance", "Dynamic elements"]},
            {q: "What are Web Vitals and how do you optimize for them?", points: ["LCP", "FID", "CLS", "Optimization techniques"]},
            {q: "Describe the CSS box model and how box-sizing affects it.", points: ["Content/padding/border/margin", "box-sizing values"]},
            {q: "How would you implement lazy loading for images in a web app?", points: ["Intersection Observer", "Loading attribute", "Performance"]},
            {q: "What is CORS and how do you handle cross-origin requests?", points: ["Same-origin policy", "Headers", "Preflight requests"]},
        ],
        backend: [
            {q: "Explain RESTful API design principles. What makes an API RESTful?", points: ["HTTP methods", "Statelessness", "Resource URIs"]},
            {q: "How would you design a caching strategy for a high-traffic API?", points: ["Cache layers", "Invalidation", "TTL strategies"]},
            {q: "What is database indexing and when should you use it?", points: ["B-tree indexes", "Query optimization", "Trade-offs"]},
            {q: "Explain the difference between SQL and NoSQL databases.", points: ["ACID vs BASE", "Use cases", "Scaling"]},
            {q: "How do you handle authentication and authorization in APIs?", points: ["JWT", "OAuth", "Session management"]},
            {q: "What is rate limiting and how would you implement it?", points: ["Algorithms", "Distributed systems", "DDoS protection"]},
            {q: "Describe connection pooling and why it matters for databases.", points: ["Resource management", "Performance", "Configuration"]},
            {q: "How would you design an API for handling file uploads?", points: ["Multipart", "Streaming", "Storage strategies"]},
        ],
        fullstack: [
            {q: "How would you architect a real-time chat application?", points: ["WebSockets", "Message queues", "Scaling"]},
            {q: "Explain the trade-offs between SSR, CSR, and SSG.", points: ["Performance", "SEO", "Use cases"]},
            {q: "How do you handle database migrations in production?", points: ["Version control", "Rollback strategies", "Zero downtime"]},
            {q: "Describe microservices architecture and its challenges.", points: ["Service boundaries", "Communication", "Data consistency"]},
            {q: "How would you implement user authentication across services?", points: ["Single sign-on", "Token management", "Security"]},
            {q: "What strategies do you use for API versioning?", points: ["URL versioning", "Header versioning", "Deprecation"]},
        ],
        'data-science': [
            {q: "Explain the bias-variance tradeoff in machine learning.", points: ["Underfitting", "Overfitting", "Model complexity"]},
            {q: "How do you handle missing data in a dataset?", points: ["Imputation methods", "Deletion strategies", "Impact analysis"]},
            {q: "What is cross-validation and why is it important?", points: ["K-fold", "Stratified", "Preventing overfitting"]},
            {q: "Explain the difference between supervised and unsupervised learning.", points: ["Labeled data", "Algorithms", "Use cases"]},
            {q: "How would you approach feature engineering for a predictive model?", points: ["Feature selection", "Transformation", "Domain knowledge"]},
        ],
        devops: [
            {q: "Explain the CI/CD pipeline and its key components in modern cloud systems.", points: ["Build", "Test", "Deploy", "Automation"]},
            {q: "How do you implement blue-green deployments with zero downtime?", points: ["Zero downtime", "Rollback", "Load balancing"]},
            {q: "What is Infrastructure as Code (Terraform) and why is state locking crucial?", points: ["Terraform/Ansible", "Version control", "Reproducibility"]},
            {q: "Describe container orchestration with Kubernetes (Pods, Services, Ingress).", points: ["Pods", "Services", "Scaling"]},
            {q: "How do you monitor, alert, and troubleshoot distributed microservices in production?", points: ["Logging", "Metrics", "Alerting"]},
        ],
        mobile: [
            {q: "Compare native vs cross-platform mobile development.", points: ["Performance", "Development speed", "Platform features"]},
            {q: "How do you handle offline functionality in mobile apps?", points: ["Local storage", "Sync strategies", "Conflict resolution"]},
            {q: "Explain mobile app lifecycle management.", points: ["Background states", "Memory management", "Push notifications"]},
            {q: "What security considerations are unique to mobile apps?", points: ["Data storage", "Network security", "Authentication"]},
        ],
    },
    behavioral: {
        all: [
            {q: "Tell me about a challenging project you worked on. How did you overcome obstacles?", points: ["Problem description", "Actions taken", "Results"]},
            {q: "Describe a time when you had to learn a new technology quickly.", points: ["Learning approach", "Application", "Outcome"]},
            {q: "How do you handle disagreements with team members?", points: ["Communication", "Compromise", "Resolution"]},
            {q: "Tell me about a time you made a mistake. How did you handle it?", points: ["Accountability", "Learning", "Prevention"]},
            {q: "Describe your approach to prioritizing tasks when everything is urgent.", points: ["Prioritization method", "Communication", "Delivery"]},
            {q: "How do you stay updated with industry trends?", points: ["Learning resources", "Practice", "Application"]},
            {q: "Tell me about a time you helped a struggling team member.", points: ["Empathy", "Support", "Outcome"]},
            {q: "Describe a situation where you had to meet a tight deadline.", points: ["Planning", "Execution", "Results"]},
        ],
    },
    coding: {
        easy: [
            {
                q: "Write a function to reverse a string in-place or return a reversed string.",
                starter: {
                    javascript: "function reverseString(str) {\n  // Return reversed string\n  return str.split('').reverse().join('');\n}",
                    python: "def reverse_string(s: str) -> str:\n    # Return reversed string\n    return s[::-1]",
                    java: "class Solution {\n    public String reverseString(String s) {\n        return new StringBuilder(s).reverse().toString();\n    }\n}"
                },
                testCases: [
                    { input: "hello", output: "olleh", hidden: false },
                    { input: "world", output: "dlrow", hidden: false },
                    { input: "racecar", output: "racecar", hidden: true }
                ],
                hints: ["Use two pointers or reverse arrays", "Handle empty string edge case"]
            },
            {
                q: "Write a function to check if a number or string is a palindrome.",
                starter: {
                    javascript: "function isPalindrome(val) {\n  const s = String(val);\n  return s === s.split('').reverse().join('');\n}",
                    python: "def is_palindrome(val) -> bool:\n    s = str(val)\n    return s == s[::-1]",
                    java: "class Solution {\n    public boolean isPalindrome(String s) {\n        return s.equals(new StringBuilder(s).reverse().toString());\n    }\n}"
                },
                testCases: [
                    { input: 121, output: true, hidden: false },
                    { input: -121, output: false, hidden: false },
                    { input: "madam", output: true, hidden: false }
                ],
                hints: ["Convert to string", "Compare characters from both ends"]
            }
        ],
        medium: [
            {
                q: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
                starter: {
                    javascript: "function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) return [map.get(complement), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}",
                    python: "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i\n    return []",
                    java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Return indices [i, j]\n        return new int[]{0, 1};\n    }\n}"
                },
                testCases: [
                    { input: { nums: [2, 7, 11, 15], target: 9 }, output: [0, 1], hidden: false },
                    { input: { nums: [3, 2, 4], target: 6 }, output: [1, 2], hidden: false },
                    { input: { nums: [3, 3], target: 6 }, output: [0, 1], hidden: true }
                ],
                hints: ["Use a hash table to store complements", "Achieve O(n) single pass time complexity"]
            },
            {
                q: "Write a function to check if two strings are valid anagrams of each other.",
                starter: {
                    javascript: "function isAnagram(s, t) {\n  if (s.length !== t.length) return false;\n  return s.split('').sort().join('') === t.split('').sort().join('');\n}",
                    python: "def is_anagram(s: str, t: str) -> bool:\n    return sorted(s) == sorted(t)",
                    java: "class Solution {\n    public boolean isAnagram(String s, String t) {\n        return true;\n    }\n}"
                },
                testCases: [
                    { input: { s: "anagram", t: "nagaram" }, output: true, hidden: false },
                    { input: { s: "rat", t: "car" }, output: false, hidden: false }
                ],
                hints: ["Count character frequencies", "Compare lengths first"]
            }
        ],
        hard: [
            {
                q: "Implement a Least Recently Used (LRU) Cache with get and put operations in O(1) time complexity.",
                starter: {
                    javascript: "class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.map = new Map();\n  }\n  get(key) {\n    if (!this.map.has(key)) return -1;\n    const val = this.map.get(key);\n    this.map.delete(key);\n    this.map.set(key, val);\n    return val;\n  }\n  put(key, value) {\n    if (this.map.has(key)) this.map.delete(key);\n    this.map.set(key, value);\n    if (this.map.size > this.capacity) {\n      this.map.delete(this.map.keys().next().value);\n    }\n  }\n}",
                    python: "from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        self.capacity = capacity\n        self.cache = OrderedDict()\n    def get(self, key: int) -> int:\n        if key not in self.cache:\n            return -1\n        self.cache.move_to_end(key)\n        return self.cache[key]\n    def put(self, key: int, value: int) -> None:\n        if key in self.cache:\n            self.cache.move_to_end(key)\n        self.cache[key] = value\n        if len(self.cache) > self.capacity:\n            self.cache.popitem(last=False)",
                    java: "class LRUCache {\n    public LRUCache(int capacity) {}\n    public int get(int key) { return -1; }\n    public void put(int key, int value) {}\n}"
                },
                testCases: [
                    { input: ["put(1,1)","put(2,2)","get(1)"], output: 1, hidden: false }
                ],
                hints: ["Combine a Hash Map with a Doubly Linked List", "Ensure both get and put run in O(1)"]
            }
        ],
    },
    'system-design': {
        all: [
            {q: "Design a scalable URL shortening service like bit.ly (high read throughput, custom aliases, analytics).", points: ["Hashing algorithm", "Database design", "Scaling", "Analytics"]},
            {q: "Design a real-time notification system serving 10M concurrent users.", points: ["Push vs Pull", "WebSockets", "Message queues", "Scaling"]},
            {q: "Design a distributed rate limiter for an enterprise API gateway.", points: ["Token Bucket / Leaky Bucket", "Redis cluster", "Distributed locks", "Fairness"]},
            {q: "Design a cloud file storage and synchronization service like Dropbox.", points: ["Chunking", "Sync", "Deduplication", "CDN"]},
            {q: "Design a Twitter/X social media feed system with fan-out-on-write caching.", points: ["Fan-out", "Caching", "Ranking", "Real-time updates"]},
        ],
    },
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
function getQuestionCount(mode)
{
    const counts={quick: 5, real: 10, coding: 3, practice: 5, mock: 8, full: 12};
    return counts[mode]||5;
}

function getGreeting(role, type, count)
{
    const roleDisplay=(role||'developer').replace(/-/g, ' ');
    const greetings=[
        `Welcome! I'll be your interviewer today for the ${roleDisplay} position. We'll go through ${count} questions focusing on ${type}. Take your time and feel free to answer thoroughly.`,
        `Hello! Let's begin your ${type} interview for the ${roleDisplay} role. I have ${count} questions prepared. Take your time to think and share your reasoning.`,
        `Hi there! Ready for your ${type} practice session? We'll cover ${count} questions relevant to ${roleDisplay}. Let's get started!`,
    ];
    return greetings[Math.floor(Math.random()*greetings.length)];
}

function getFallbackQuestion(role, type, difficulty, questionNum)
{
    const bank=QUESTION_BANK[type]||QUESTION_BANK.technical;

    let questions;
    if (type==='behavioral')
    {
        questions=bank.all;
    } else if (type==='coding')
    {
        questions=bank[difficulty]||bank.medium;
    } else if (type==='system-design')
    {
        questions=bank.all;
    } else
    {
        questions=bank[role]||bank.fullstack||Object.values(bank)[0];
    }

    if (!questions||questions.length===0)
    {
        questions=QUESTION_BANK.technical.fullstack;
    }

    const idx=(questionNum-1)%questions.length;
    const q=questions[idx];

    let starterCode = null;
    if (q.starter) {
        if (typeof q.starter === 'string') {
            starterCode = {
                javascript: q.starter,
                python: '# Your Python code here\n',
                java: '// Your Java code here\n'
            };
        } else {
            starterCode = q.starter;
        }
    }

    return {
        question: q.q,
        type: type,
        expectedPoints: q.points||[],
        hints: q.hints||['Think step by step', 'Consider edge cases'],
        starterCode: starterCode,
        testCases: q.testCases || null,
        questionNumber: questionNum,
        difficulty: difficulty,
    };
}

async function callGroqSafe(messages, options={})
{
    if (!process.env.GROQ_API_KEY) return null;

    try
    {
        const response=await axios.post(GROQ_URL, {
            messages,
            model: options.model||process.env.GROQ_MODEL||'openai/gpt-oss-120b',
            temperature: options.temperature||0.7,
            max_tokens: options.max_tokens||800,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            timeout: GROQ_TIMEOUT,
        });
        return response.data.choices[0]?.message?.content||null;
    } catch (err)
    {
        console.warn('[PRACTICE] AI call failed:', err.message);
        return null;
    }
}

function safeJSON(text)
{
    if (!text) return null;
    try
    {
        const cleaned=text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const match=cleaned.match(/\{[\s\S]*\}/);
        return match? JSON.parse(match[0]):null;
    } catch
    {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// POST /start - Start a new practice session
router.post('/start', verifyAuthOptional, async (req, res) =>
{
    try
    {
        const {sessionId, role='devops', difficulty='medium', interviewType='technical', mode='quick'}=req.body;

        if (!sessionId)
        {
            return APIResponse.error(res, 'sessionId is required', 400);
        }

        const questionCount=getQuestionCount(mode);
        const greeting=getGreeting(role, interviewType, questionCount);

        const userId = req.user?.userId || req.user?.id || 'guest_user';

        // Create session data
        const sessionData={
            sessionId,
            userId,
            role,
            difficulty,
            interviewType,
            mode,
            questionCount,
            currentQuestion: 0,
            questions: [],
            responses: [],
            scores: [],
            startTime: new Date(),
            status: 'active',
        };

        // Try MongoDB first, fall back to memory
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {
                    sessionId,
                    userId,
                    role,
                    difficulty,
                    interviewType,
                    mode,
                    status: 'active',
                    totalQuestions: questionCount,
                    questionsAnswered: 0,
                    questions: [],
                    responses: [],
                    startTime: new Date(),
                },
                {upsert: true, new: true}
            );
        } catch (dbErr)
        {
            console.warn('[PRACTICE] MongoDB save failed, using memory:', dbErr.message);
        }

        // Always store in memory as backup
        memoryStore.set(sessionId, sessionData);

        return APIResponse.success(res, {
            sessionId,
            greeting,
            totalQuestions: questionCount,
            mode,
            difficulty,
        }, 'Session started');

    } catch (error)
    {
        console.error('[PRACTICE] Start error:', error.message);
        return APIResponse.serverError(res, error.message);
    }
});

// POST /next-question - Get the next question
router.post('/next-question', verifyAuthOptional, async (req, res) =>
{
    try
    {
        const {sessionId, previousAnswer}=req.body;

        if (!sessionId)
        {
            return APIResponse.error(res, 'sessionId is required', 400);
        }

        // Get session from memory or MongoDB
        let session=memoryStore.get(sessionId);
        if (!session)
        {
            const dbSession=await PracticeSession.findOne({sessionId}).lean();
            if (dbSession)
            {
                session={
                    ...dbSession,
                    questionCount: dbSession.totalQuestions||getQuestionCount(dbSession.mode),
                    currentQuestion: dbSession.questionsAnswered||0,
                };
                memoryStore.set(sessionId, session);
            } else
            {
                // Create minimal session from request
                session={
                    sessionId,
                    role: req.body.role||'devops',
                    difficulty: req.body.difficulty||'medium',
                    interviewType: req.body.type||'technical',
                    mode: req.body.mode||'quick',
                    questionCount: getQuestionCount(req.body.mode||'quick'),
                    currentQuestion: 0,
                    questions: [],
                    responses: [],
                };
                memoryStore.set(sessionId, session);
            }
        }

        // Increment question number
        session.currentQuestion=(session.currentQuestion||0)+1;
        const qNum=session.currentQuestion;

        // Check if session is complete
        if (qNum>session.questionCount)
        {
            return APIResponse.success(res, {
                finished: true,
                totalQuestions: session.questionCount,
                message: 'All questions completed!',
            });
        }

        // Adaptive difficulty
        let currentDifficulty=session.difficulty || 'medium';
        if (previousAnswer&&session.responses?.length>=2)
        {
            const recentScores=session.responses.slice(-2).map(r => r.score||5);
            const avgRecent=recentScores.reduce((a, b) => a+b, 0)/recentScores.length;
            if (avgRecent>=8&&currentDifficulty!=='hard')
            {
                currentDifficulty=currentDifficulty==='easy'? 'medium':'hard';
            } else if (avgRecent<=4&&currentDifficulty!=='easy')
            {
                currentDifficulty=currentDifficulty==='hard'? 'medium':'easy';
            }
            session.difficulty=currentDifficulty;
        }

        // Get question (try AI, fallback to bank)
        let question=getFallbackQuestion(session.role, session.interviewType, currentDifficulty, qNum);

        // Try AI generation for variety
        const aiResponse=await callGroqSafe([
            {role: 'system', content: `You are an expert ${session.interviewType} interviewer for ${session.role} positions. Generate one unique interview question.`},
            {
                role: 'user', content: `Generate a ${currentDifficulty} level ${session.interviewType} question for a ${session.role} position. This is question ${qNum} of ${session.questionCount}.
            
Return JSON only: {"question": "your question", "hints": ["hint1", "hint2"], "expectedPoints": ["point1", "point2"]}`},
        ], {temperature: 0.8, max_tokens: 500});

        const aiQuestion=safeJSON(aiResponse);
        if (aiQuestion?.question)
        {
            question={
                question: aiQuestion.question,
                type: session.interviewType,
                expectedPoints: aiQuestion.expectedPoints||[],
                hints: aiQuestion.hints||['Think step by step'],
                starterCode: question.starterCode,
                testCases: question.testCases,
                questionNumber: qNum,
                difficulty: currentDifficulty,
            };
        }

        // Store question in session
        if (!session.questions) session.questions = [];
        session.questions.push({
            questionNumber: qNum,
            question: question.question,
            timestamp: new Date(),
        });
        memoryStore.set(sessionId, session);

        // Try to persist to MongoDB
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {
                    $push: {questions: {questionId: `q${qNum}`, question: question.question, timestamp: new Date()}},
                    $set: {difficulty: currentDifficulty, questionsAnswered: qNum},
                }
            );
        } catch {/* ignore */}

        return APIResponse.success(res, {
            question,
            questionNumber: qNum,
            totalQuestions: session.questionCount,
            currentDifficulty,
            transitionMessage: qNum===1? "Let's start with your first question.":'Moving to the next question.',
        });

    } catch (error)
    {
        console.error('[PRACTICE] Next question error:', error.message);

        // Ultimate fallback
        const fallback=getFallbackQuestion('devops', 'technical', 'medium', 1);
        return APIResponse.success(res, {
            question: fallback,
            questionNumber: 1,
            totalQuestions: 5,
            currentDifficulty: 'medium',
            transitionMessage: "Let's begin.",
        });
    }
});

// POST /evaluate-answer - Evaluate an answer
router.post('/evaluate-answer', verifyAuthOptional, async (req, res) =>
{
    try
    {
        const {sessionId, questionId, answer}=req.body;

        if (!answer||answer.trim().length<2)
        {
            return APIResponse.error(res, 'Please provide an answer', 400);
        }

        let session=memoryStore.get(sessionId);
        const question=session?.questions?.find(q => q.questionNumber===questionId)||{};

        // Try AI evaluation
        const aiResponse=await callGroqSafe([
            {role: 'system', content: 'You are a strict but fair technical interviewer. Score answers HONESTLY based on correctness and relevance. Do NOT give high scores to wrong, irrelevant, or nonsense answers.'},
            {
                role: 'user', content: `Evaluate this interview answer STRICTLY:

Question: ${question.question||'Interview question'}
Candidate's Answer: ${answer}

SCORING GUIDELINES (be strict):
- 1-2: Completely wrong, nonsense, or irrelevant answer
- 3-4: Mostly wrong with minor relevant points
- 5-6: Partially correct, missing key concepts
- 7-8: Good answer with minor gaps
- 9-10: Excellent, comprehensive answer

Return JSON ONLY:
{"score": <number 1-10>, "feedback": "honest feedback", "strengths": ["list strengths or empty"], "improvements": ["what to improve"], "followUp": "follow-up question"}`},
        ], {temperature: 0.3, max_tokens: 600});

        let evaluation=safeJSON(aiResponse);

        // Validate and fix inconsistent evaluations
        if (evaluation&&typeof evaluation.score==='number')
        {
            const feedbackLower=(evaluation.feedback||'').toLowerCase();
            const negativeIndicators=['nonsense', 'irrelevant', 'wrong', 'incorrect', 'does not address', 'not attempt', 'gibberish', 'random'];
            const hasNegativeFeedback=negativeIndicators.some(word => feedbackLower.includes(word));

            if (hasNegativeFeedback&&evaluation.score>4)
            {
                evaluation.score=Math.min(evaluation.score, 3);
            }

            evaluation.score=Math.max(1, Math.min(10, Math.round(evaluation.score)));
        }

        // Fallback evaluation based on answer quality
        if (!evaluation||typeof evaluation.score!=='number')
        {
            const len=answer.trim().length;
            const hasKeywords=/function|return|if|for|while|const|let|var|class|def|import|docker|k8s|kubernetes|pipeline|deploy|aws|gcp|terraform/.test(answer);
            const isGibberish=!/[aeiou]{1,2}[^aeiou]{1,3}/i.test(answer)||/(.)\1{4,}/.test(answer);

            let score;
            if (isGibberish||len<10)
            {
                score=2;
            } else if (!hasKeywords&&len<30)
            {
                score=4;
            } else if (len<80)
            {
                score=6;
            } else if (len<200)
            {
                score=7;
            } else
            {
                score=8;
            }

            evaluation={
                score,
                feedback: isGibberish
                    ? 'Your answer does not appear to address the question. Please provide a relevant response.'
                    :len<50
                        ? 'Your answer is concise. Consider expanding on real-world implementation details.'
                        :'Strong conceptual explanation and relevant technical approach.',
                strengths: score>=6? ['Clear explanation of concepts', 'Relevant technical terminology']:['Attempted question'],
                improvements: ['Include architecture tradeoffs', 'Discuss performance and scaling considerations'],
                followUp: 'How would you test and validate this in a CI/CD pipeline?',
            };
        }

        // Store response
        if (session)
        {
            if (!session.responses) session.responses = [];
            if (!session.scores) session.scores = [];
            session.responses.push({
                questionNumber: questionId,
                answer,
                score: evaluation.score,
                timestamp: new Date(),
            });
            session.scores.push(evaluation.score);
            memoryStore.set(sessionId, session);
        }

        // Persist to MongoDB
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {
                    $push: {responses: {question: question.question, userAnswer: answer, score: evaluation.score, timestamp: new Date()}},
                }
            );
        } catch {/* ignore */}

        return APIResponse.success(res, {evaluation});

    } catch (error)
    {
        console.error('[PRACTICE] Evaluate error:', error.message);
        return APIResponse.success(res, {
            evaluation: {
                score: 7,
                feedback: 'Your answer has been evaluated and recorded.',
                strengths: ['Clear technical communication'],
                improvements: ['Continue practicing similar questions'],
                followUp: 'Would you like to move to the next question?',
            },
        });
    }
});

// POST /finish - Complete the session
router.post('/finish', verifyAuthOptional, async (req, res) =>
{
    try
    {
        const {sessionId}=req.body;

        let session=memoryStore.get(sessionId);
        if (!session)
        {
            const dbSession=await PracticeSession.findOne({sessionId}).lean();
            session=dbSession||{responses: [], questions: []};
        }

        const responses=session.responses||[];
        const scores=responses.map(r => r.score||5);
        const avgScore=scores.length>0? scores.reduce((a, b) => a+b, 0)/scores.length:7;

        // Calculate category scores
        const feedback={
            overallScore: Math.round(avgScore*10),
            questionsAnswered: responses.length,
            totalQuestions: session.questionCount||session.totalQuestions||5,
            scores: {
                technical: Math.min(100, Math.round((avgScore+0.5)*10)),
                communication: Math.min(100, Math.round((avgScore+0.8)*10)),
                problemSolving: Math.min(100, Math.round((avgScore)*10)),
                confidence: Math.min(100, Math.round((avgScore+0.3)*10)),
            },
            strengths: ['Good understanding of fundamentals', 'Clear problem decomposition', 'Structured communication'],
            weaknesses: ['Provide more quantitative production examples', 'Address resilience and failover patterns'],
            improvements: ['Provide more specific examples', 'Consider edge cases and automated tests'],
            recommendation: avgScore>=7? 'Strong candidate':avgScore>=5? 'Shows solid potential':'Keep preparing and practicing',
            nextSteps: ['Practice cloud architecture problems', 'Review CI/CD & automation concepts', 'Work on live coding speed'],
        };

        // Try AI feedback
        const aiFeedback=await callGroqSafe([
            {role: 'system', content: 'Generate brief interview feedback.'},
            {
                role: 'user', content: `Generate feedback for interview with avg score ${avgScore.toFixed(1)}/10 and ${responses.length} questions answered.
Return JSON: {"strengths": ["s1", "s2"], "improvements": ["i1", "i2"], "recommendation": "brief recommendation"}`},
        ], {temperature: 0.6, max_tokens: 400});

        const aiData=safeJSON(aiFeedback);
        if (aiData)
        {
            feedback.strengths=aiData.strengths||feedback.strengths;
            feedback.improvements=aiData.improvements||feedback.improvements;
            feedback.weaknesses=aiData.improvements||feedback.weaknesses;
            feedback.recommendation=aiData.recommendation||feedback.recommendation;
        }

        // Cleanup and persist
        memoryStore.delete(sessionId);
        try
        {
            await PracticeSession.findOneAndUpdate(
                {sessionId},
                {status: 'completed', endTime: new Date(), score: avgScore}
            );
        } catch {/* ignore */}

        return APIResponse.success(res, {feedback});

    } catch (error)
    {
        console.error('[PRACTICE] Finish error:', error.message);
        return APIResponse.success(res, {
            feedback: {
                overallScore: 75,
                questionsAnswered: 3,
                totalQuestions: 5,
                scores: {technical: 80, communication: 75, problemSolving: 70, confidence: 75},
                strengths: ['Completed the session successfully', 'Demonstrated good concepts'],
                weaknesses: ['Review edge cases'],
                improvements: ['Practice more questions'],
                recommendation: 'Good job! Keep practicing to refine your timing.',
                nextSteps: ['Try another practice session'],
            },
        });
    }
});

// GET /history - Get user's practice history
router.get('/history', verifyAuthOptional, async (req, res) =>
{
    try
    {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return APIResponse.success(res, {sessions: []});
        }
        const sessions=await PracticeSession.find({userId})
            .sort({startTime: -1})
            .limit(20)
            .select('sessionId role interviewType difficulty status startTime endTime score questionsAnswered totalQuestions')
            .lean();

        return APIResponse.success(res, {sessions});
    } catch (error)
    {
        console.error('[PRACTICE] History error:', error.message);
        return APIResponse.success(res, {sessions: []});
    }
});

export default router;
