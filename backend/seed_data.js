import dotenv from 'dotenv';
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from './models/User.js';
import Job from './models/Job.js';
import Application from './models/Application.js';

// Load environment variables
dotenv.config();

const uri = process.env.MONGODB_URI;

// Password hashing logic matching backend/routes/auth.js
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seedDatabase() {
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in environment variables!');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  try {
    await mongoose.connect(uri, { dbName: 'hirespec' });
    console.log('✅ Connected successfully to MongoDB dbName: hirespec');

    // ── 1. Create Recruiter and Company Users ──
    console.log('👥 Seeding Company Admins and Recruiters...');
    
    const companySpecs = [
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

    const companies = [];
    for (const spec of companySpecs) {
      let user = await User.findOne({ username: spec.username });
      if (!user) {
        user = await User.create({
          ...spec,
          password: hashPassword('demo123'),
          profileComplete: 80 + Math.floor(Math.random() * 20),
        });
        console.log(`+ Created Company User: ${spec.username}`);
      } else {
        console.log(`~ Company User already exists: ${spec.username}`);
      }
      companies.push(user);
    }

    // ── 2. Create Candidate (Student) Users ──
    console.log('🎓 Seeding Candidates...');
    
    const candidateSpecs = [
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

    const candidates = [];
    for (const spec of candidateSpecs) {
      let user = await User.findOne({ username: spec.username });
      if (!user) {
        user = await User.create({
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
        console.log(`+ Created Candidate: ${spec.username}`);
      } else {
        console.log(`~ Candidate already exists: ${spec.username}`);
      }
      candidates.push(user);
    }

    // ── 3. Create Sample Jobs ──
    console.log('💼 Seeding Jobs...');
    
    const jobSpecs = [
      {
        title: 'Backend Software Engineer (Go)',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-Time',
        description: 'Build high-performance microservices and cloud infrastructure in Go.',
        requirements: 'Experience with Go programming, REST/gRPC APIs, Docker, and SQL databases.',
        skills: ['Go', 'Docker', 'Kubernetes', 'SQL', 'AWS'],
        companyName: 'Google India',
        salary: { min: 1500000, max: 2500000, currency: 'INR' },
        recruiterIndex: 0, // Google
      },
      {
        title: 'Software Development Engineer II',
        department: 'Engineering',
        location: 'Hybrid',
        type: 'Full-Time',
        description: 'Design and deploy robust cloud platform features for Microsoft Azure core services.',
        requirements: 'Experience with Java, C#, or C++ development, cloud architectures, and system performance design.',
        skills: ['Java', 'Docker', 'Azure', 'C#', 'SQL'],
        companyName: 'Microsoft',
        salary: { min: 1400000, max: 2200000, currency: 'INR' },
        recruiterIndex: 1, // Microsoft
      },
      {
        title: 'Machine Learning Research Engineer',
        department: 'Research',
        location: 'On-site',
        type: 'Full-Time',
        description: 'Train and optimize state-of-the-art deep learning models for NLP and vision pipelines.',
        requirements: 'Solid knowledge of Python, PyTorch/TensorFlow, pandas, machine learning math, and model deployment.',
        skills: ['Python', 'TensorFlow', 'Pandas', 'Algorithms', 'Git'],
        companyName: 'Meta',
        salary: { min: 1800000, max: 2800000, currency: 'INR' },
        recruiterIndex: 2, // Meta
      },
      {
        title: 'Front-end Engineer (React)',
        department: 'Product',
        location: 'Remote',
        type: 'Full-Time',
        description: 'Craft beautiful payment dashboard components and design-system libraries using React & TypeScript.',
        requirements: 'Advanced React patterns, CSS transitions, responsive layouts, typescript, and frontend bundle optimization.',
        skills: ['JavaScript', 'TypeScript', 'React', 'HTML', 'CSS', 'Tailwind'],
        companyName: 'Stripe',
        salary: { min: 1200000, max: 1800000, currency: 'INR' },
        recruiterIndex: 3, // Stripe
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
        salary: { min: 40000, max: 60000, currency: 'INR' },
        recruiterIndex: 0, // Google
      }
    ];

    const jobs = [];
    for (const spec of jobSpecs) {
      let job = await Job.findOne({ title: spec.title, companyName: spec.companyName });
      if (!job) {
        const recruiter = companies[spec.recruiterIndex];
        job = await Job.create({
          title: spec.title,
          department: spec.department,
          location: spec.location,
          type: spec.type,
          description: spec.description,
          requirements: spec.requirements,
          skills: spec.skills,
          salary: spec.salary,
          companyName: spec.companyName,
          postedBy: recruiter._id,
          status: 'active',
          applicantCount: 0,
        });
        console.log(`+ Created Job: "${spec.title}" for ${spec.companyName}`);
      } else {
        console.log(`~ Job already exists: "${spec.title}"`);
      }
      jobs.push(job);
    }

    // ── 4. Create Job Applications (Funnel Data) ──
    console.log('📈 Seeding Applications...');
    
    // We want a mix of statuses for our dashboard figures:
    // applied, screening, shortlisted, interview, offered, hired, rejected, not_eligible
    const appSpecs = [
      { candIndex: 0, jobIndex: 1, status: 'interview', round: 'Technical Round 2', score: 85 }, // Aditya to Microsoft
      { candIndex: 0, jobIndex: 4, status: 'applied', round: 'Applied', score: 0 }, // Aditya to Google DevOps Intern
      { candIndex: 1, jobIndex: 2, status: 'hired', round: 'Hired', score: 92 }, // Ananya to Meta ML (Hired)
      { candIndex: 2, jobIndex: 3, status: 'offered', round: 'Offer Extended', score: 88 }, // Kabir to Stripe React (Offered)
      { candIndex: 3, jobIndex: 0, status: 'selected', round: 'HR Round Completed', score: 94 }, // Riya to Google Go (Selected)
      { candIndex: 3, jobIndex: 1, status: 'shortlisted', round: 'Online Test Passed', score: 90 }, // Riya to Microsoft
      { candIndex: 4, jobIndex: 3, status: 'rejected', round: 'Resume Screening', score: 45 }, // Vikram to Stripe React (Rejected)
      { candIndex: 5, jobIndex: 0, status: 'screening', round: 'Resume Review', score: 68 }, // Neha to Google Go
      { candIndex: 5, jobIndex: 1, status: 'applied', round: 'Applied', score: 0 }, // Neha to Microsoft
      { candIndex: 6, jobIndex: 3, status: 'interview', round: 'System Design', score: 82 }, // Sid to Stripe React
      { candIndex: 6, jobIndex: 1, status: 'rejected', round: 'Online Coding Test', score: 55 }, // Sid to Microsoft
      { candIndex: 2, jobIndex: 0, status: 'not_eligible', round: 'Mismatch', score: 30 } // Ananya to Google Go (Not Eligible)
    ];

    for (const spec of appSpecs) {
      const candidate = candidates[spec.candIndex];
      const job = jobs[spec.jobIndex];

      const existing = await Application.findOne({ job: job._id, candidate: candidate._id });
      if (!existing) {
        await Application.create({
          job: job._id,
          candidate: candidate._id,
          status: spec.status,
          round: spec.round,
          score: spec.score,
          atsScore: candidate.atsScore || 75,
          skillMatchScore: Math.floor(60 + Math.random() * 40),
          appliedAt: new Date(Date.now() - (Math.random() * 30 + 1) * 24 * 60 * 60 * 1000), // applied 1-30 days ago
        });
        
        // Increment applicant count on job
        await Job.findByIdAndUpdate(job._id, { $inc: { applicantCount: 1 } });
        console.log(`+ Created Application: ${candidate.username} ➔ "${job.title}" [${spec.status}]`);
      } else {
        console.log(`~ Application already exists: ${candidate.username} ➔ "${job.title}"`);
      }
    }

    // ── 5. Create Sample Live Quizzes ──
    console.log('📝 Seeding Sample Quizzes for practice...');
    const Quiz = (await import('./models/Quiz.js')).default;
    const CodingContest = (await import('./models/CodingContest.js')).default;

    const quizSpecs = [
      {
        code: 'QUIZ01',
        title: 'Full-Stack Web Development & System Design',
        topic: 'Full Stack & Web Architecture',
        description: 'Test your understanding of modern React, Node.js, REST APIs, WebSockets, and database optimizations.',
        difficulty: 'medium',
        hostIndex: 0,
        status: 'waiting',
        questionTimeLimit: 25,
        duration: 30,
        questions: [
          {
            text: 'Which React Hook is primarily used for side effects like API fetching and event subscriptions?',
            type: 'mcq',
            options: ['useState', 'useEffect', 'useMemo', 'useCallback'],
            correctAnswer: 'useEffect',
            explanation: 'useEffect is designed for handling lifecycle events and side effects in functional components.',
            points: 15,
            timeLimit: 20,
            difficulty: 'easy'
          },
          {
            text: 'What status code should an HTTP REST API return when a new resource is successfully created?',
            type: 'mcq',
            options: ['200 OK', '201 Created', '204 No Content', '202 Accepted'],
            correctAnswer: '201 Created',
            explanation: 'HTTP 201 Created signifies that the request has succeeded and led to the creation of a new resource.',
            points: 15,
            timeLimit: 20,
            difficulty: 'easy'
          },
          {
            text: 'In Node.js event loop, which phase executes callbacks registered with process.nextTick()?',
            type: 'mcq',
            options: ['Timers phase', 'Poll phase', 'Microtask queue (before any event loop phase transitions)', 'Close callbacks'],
            correctAnswer: 'Microtask queue (before any event loop phase transitions)',
            explanation: 'process.nextTick queue is processed immediately after the current operation finishes, before continuing to the next event loop phase.',
            points: 20,
            timeLimit: 25,
            difficulty: 'medium'
          },
          {
            text: 'Which index type in MongoDB is best suited for geospatial location queries?',
            type: 'mcq',
            options: ['Compound Index', '2dsphere Index', 'Text Index', 'Hashed Index'],
            correctAnswer: '2dsphere Index',
            explanation: 'MongoDB 2dsphere indexes support queries that calculate geometries on an earth-like sphere.',
            points: 20,
            timeLimit: 25,
            difficulty: 'medium'
          }
        ]
      },
      {
        code: 'QUIZ02',
        title: 'Data Structures & Algorithms Challenge',
        topic: 'Algorithms & Complexity',
        description: 'Core questions covering time complexities, trees, graphs, dynamic programming, and hash tables.',
        difficulty: 'hard',
        hostIndex: 1,
        status: 'waiting',
        questionTimeLimit: 30,
        duration: 45,
        questions: [
          {
            text: 'What is the average time complexity of lookup, insert, and delete operations in a standard Hash Table?',
            type: 'mcq',
            options: ['O(log n)', 'O(1)', 'O(n)', 'O(n log n)'],
            correctAnswer: 'O(1)',
            explanation: 'Hash tables offer amortized constant time O(1) operations assuming a good distribution and hash function.',
            points: 15,
            timeLimit: 20,
            difficulty: 'easy'
          },
          {
            text: 'Which traversal of a Binary Search Tree (BST) produces elements in sorted ascending order?',
            type: 'mcq',
            options: ['Pre-order', 'In-order', 'Post-order', 'Level-order'],
            correctAnswer: 'In-order',
            explanation: 'In-order traversal visits left subtree, root, then right subtree, producing strictly ascending order in a valid BST.',
            points: 20,
            timeLimit: 25,
            difficulty: 'medium'
          },
          {
            text: 'Which algorithm finds the single-source shortest path on a graph with non-negative edge weights?',
            type: 'mcq',
            options: ['Dijkstra algorithm', 'Bellman-Ford', 'Floyd-Warshall', 'Kruskal algorithm'],
            correctAnswer: 'Dijkstra algorithm',
            explanation: 'Dijkstra algorithm calculates the shortest path from a source node to all other nodes on graphs with non-negative edge weights.',
            points: 20,
            timeLimit: 25,
            difficulty: 'medium'
          }
        ]
      }
    ];

    for (const qSpec of quizSpecs) {
      const host = companies[qSpec.hostIndex];
      let quiz = await Quiz.findOne({ code: qSpec.code });
      if (!quiz) {
        quiz = await Quiz.create({
          code: qSpec.code,
          title: qSpec.title,
          topic: qSpec.topic,
          description: qSpec.description,
          difficulty: qSpec.difficulty,
          hostId: host._id,
          hostName: host.companyName || host.username,
          status: qSpec.status,
          questionTimeLimit: qSpec.questionTimeLimit,
          duration: qSpec.duration,
          questions: qSpec.questions,
          settings: {
            showLeaderboardAfterEach: true,
            allowLateJoin: true,
            shuffleQuestions: false,
            shuffleOptions: false
          }
        });
        console.log(`+ Created Live Quiz: [${qSpec.code}] "${qSpec.title}"`);
      } else {
        console.log(`~ Quiz already exists: [${qSpec.code}] "${qSpec.title}"`);
      }
    }

    // ── 6. Create Sample Coding Contests ──
    console.log('🏆 Seeding Sample Coding Contests...');
    const contestSpecs = [
      {
        code: 'CODE01',
        title: 'Global Algorithmic Duel — Spring 2026',
        topic: 'Algorithms & Data Structures',
        description: 'Compete in high-speed algorithmic challenges covering two pointers, sliding window, and greedy optimization.',
        difficulty: 'medium',
        hostIndex: 0,
        status: 'waiting',
        duration: 90,
        challenges: [
          {
            title: 'Two Sum Target Pairs',
            description: 'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.',
            difficulty: 'easy',
            points: 100,
            timeLimit: 20,
            examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9' }],
            constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'],
            testCases: [
              { input: '{"nums": [2,7,11,15], "target": 9}', output: '[0,1]', hidden: false },
              { input: '{"nums": [3,2,4], "target": 6}', output: '[1,2]', hidden: false }
            ],
            starterCode: {
              javascript: 'function solution(nums, target) {\n  // Write your code here\n}',
              python: 'def solution(nums, target):\n    # Write your code here\n    pass',
              java: 'class Solution {\n    public int[] solution(int[] nums, int target) {\n        return new int[]{};\n    }\n}',
              cpp: '#include <vector>\nusing namespace std;\nvector<int> solution(vector<int>& nums, int target) {\n    return {};\n}'
            },
            functionName: { javascript: 'solution', python: 'solution', java: 'solution', cpp: 'solution' },
            hints: ['Use a hash map to store complements in O(n) time.']
          },
          {
            title: 'Longest Substring Without Repeating Characters',
            description: 'Given a string `s`, find the length of the longest substring without repeating characters.',
            difficulty: 'medium',
            points: 150,
            timeLimit: 30,
            examples: [{ input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with length 3.' }],
            constraints: ['0 <= s.length <= 5 * 10^4'],
            testCases: [
              { input: '{"s": "abcabcbb"}', output: '3', hidden: false },
              { input: '{"s": "bbbbb"}', output: '1', hidden: false }
            ],
            starterCode: {
              javascript: 'function solution(s) {\n  // Write your code here\n}',
              python: 'def solution(s):\n    # Write your code here\n    pass',
              java: 'class Solution {\n    public int solution(String s) {\n        return 0;\n    }\n}',
              cpp: '#include <string>\nusing namespace std;\nint solution(string s) {\n    return 0;\n}'
            },
            functionName: { javascript: 'solution', python: 'solution', java: 'solution', cpp: 'solution' },
            hints: ['Use a sliding window with a set or map to track characters.']
          }
        ]
      },
      {
        code: 'CODE02',
        title: 'Full-Stack Data Structures Sprint',
        topic: 'Stacks, Intervals & Sorting',
        description: 'Validate brackets, merge overlapping time intervals, and optimize memory consumption.',
        difficulty: 'medium',
        hostIndex: 1,
        status: 'waiting',
        duration: 75,
        challenges: [
          {
            title: 'Valid Parentheses String',
            description: 'Given a string `s` containing just characters `(`, `)`, `{`, `}`, `[`, `]`, determine if the input string is valid.',
            difficulty: 'easy',
            points: 100,
            timeLimit: 20,
            examples: [{ input: 's = "()[]{}"', output: 'true' }],
            constraints: ['1 <= s.length <= 10^4'],
            testCases: [
              { input: '{"s": "()[]{}"}', output: 'true', hidden: false },
              { input: '{"s": "(]"}', output: 'false', hidden: false }
            ],
            starterCode: {
              javascript: 'function solution(s) {\n  // Write your code here\n}',
              python: 'def solution(s):\n    # Write your code here\n    pass',
              java: 'class Solution {\n    public boolean solution(String s) {\n        return false;\n    }\n}',
              cpp: '#include <string>\nusing namespace std;\nbool solution(string s) {\n    return false;\n}'
            },
            functionName: { javascript: 'solution', python: 'solution', java: 'solution', cpp: 'solution' },
            hints: ['Use a stack data structure to match open and closing brackets.']
          },
          {
            title: 'Merge Overlapping Intervals',
            description: 'Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals.',
            difficulty: 'medium',
            points: 150,
            timeLimit: 30,
            examples: [{ input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' }],
            constraints: ['1 <= intervals.length <= 10^4'],
            testCases: [
              { input: '{"intervals": [[1,3],[2,6],[8,10],[15,18]]}', output: '[[1,6],[8,10],[15,18]]', hidden: false }
            ],
            starterCode: {
              javascript: 'function solution(intervals) {\n  // Write your code here\n}',
              python: 'def solution(intervals):\n    # Write your code here\n    pass',
              java: 'class Solution {\n    public int[][] solution(int[][] intervals) {\n        return new int[][]{};\n    }\n}',
              cpp: '#include <vector>\nusing namespace std;\nvector<vector<int>> solution(vector<vector<int>>& intervals) {\n    return {};\n}'
            },
            functionName: { javascript: 'solution', python: 'solution', java: 'solution', cpp: 'solution' },
            hints: ['Sort intervals by start time first before merging.']
          }
        ]
      },
      {
        code: 'CODE03',
        title: 'Dynamic Programming & Graph Showdown',
        topic: 'DP & Graph Traversal',
        description: 'Advanced problems designed to test dynamic programming state transitions and BFS/DFS graph traversals.',
        difficulty: 'hard',
        hostIndex: 2,
        status: 'waiting',
        duration: 120,
        challenges: [
          {
            title: 'Maximum Subarray Sum (Kadane)',
            description: 'Given an integer array `nums`, find the subarray with the largest sum, and return its sum.',
            difficulty: 'easy',
            points: 100,
            timeLimit: 25,
            examples: [{ input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' }],
            constraints: ['1 <= nums.length <= 10^5'],
            testCases: [
              { input: '{"nums": [-2,1,-3,4,-1,2,1,-5,4]}', output: '6', hidden: false },
              { input: '{"nums": [1]}', output: '1', hidden: false }
            ],
            starterCode: {
              javascript: 'function solution(nums) {\n  // Write your code here\n}',
              python: 'def solution(nums):\n    # Write your code here\n    pass',
              java: 'class Solution {\n    public int solution(int[] nums) {\n        return 0;\n    }\n}',
              cpp: '#include <vector>\nusing namespace std;\nint solution(vector<int>& nums) {\n    return 0;\n}'
            },
            functionName: { javascript: 'solution', python: 'solution', java: 'solution', cpp: 'solution' },
            hints: ['Maintain current_sum = max(num, current_sum + num).']
          }
        ]
      }
    ];

    for (const cSpec of contestSpecs) {
      const host = companies[cSpec.hostIndex];
      let contest = await CodingContest.findOne({ code: cSpec.code });
      if (!contest) {
        contest = await CodingContest.create({
          code: cSpec.code,
          title: cSpec.title,
          topic: cSpec.topic,
          description: cSpec.description,
          difficulty: cSpec.difficulty,
          hostId: host._id,
          hostName: host.companyName || host.username,
          status: cSpec.status,
          duration: cSpec.duration,
          challenges: cSpec.challenges,
          settings: {
            showLeaderboardLive: true,
            allowLateJoin: true,
            partialScoring: true,
            allowedLanguages: ['javascript', 'python', 'java', 'cpp']
          }
        });
        console.log(`+ Created Coding Contest: [${cSpec.code}] "${cSpec.title}"`);
      } else {
        console.log(`~ Contest already exists: [${cSpec.code}] "${cSpec.title}"`);
      }
    }

    console.log('🎉 Database seeding completed successfully!');
  } catch (err) {
    console.error('❌ Seeding failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

seedDatabase();
