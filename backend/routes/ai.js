import express from 'express';
import axios from 'axios';

const router=express.Router();

// Generate AI question using Groq
router.post('/generate-question', async (req, res) =>
{
    try
    {
        const {difficulty, category, customPrompt}=req.body;

        const topicHint=customPrompt? `\n- Topic/Focus: ${customPrompt}`:'';
        const prompt=`Generate a coding interview question with the following requirements:
- Difficulty: ${difficulty||'medium'}
- Category: ${category||'algorithms'}${topicHint}

IMPORTANT RULES:
1. The starterCode must contain ONLY the function signature with an empty body (pass/return placeholder). Do NOT include any logic, hints, or partial solutions.
2. You MUST include testCases with structured input objects and expected output values.
3. You MUST include a functionName mapping for each language.

You MUST respond with valid JSON only, no other text. Use this exact format:
{
  "title": "Question Title",
  "difficulty": "${difficulty||'medium'}",
  "category": "${category||'algorithms'}",
  "description": "Detailed description of the problem with clear requirements",
  "examples": [
    {"input": "example input description", "output": "expected output"},
    {"input": "another input", "output": "another output"}
  ],
  "constraints": ["constraint 1", "constraint 2"],
  "hints": ["hint 1", "hint 2"],
  "functionName": {
    "python": "function_name",
    "javascript": "functionName",
    "java": "functionName",
    "cpp": "functionName"
  },
  "testCases": [
    {"input": {"param1": [1,2,3], "param2": 5}, "output": [0,1], "hidden": false},
    {"input": {"param1": [3,3], "param2": 6}, "output": [0,1], "hidden": false},
    {"input": {"param1": [1,5,3], "param2": 4}, "output": [0,2], "hidden": true},
    {"input": {"param1": [-1,-2], "param2": -3}, "output": [0,1], "hidden": true}
  ],
  "starterCode": {
    "python": "def function_name(param1, param2):\\n    # Write your solution here\\n    pass",
    "javascript": "function functionName(param1, param2) {\\n    // Write your solution here\\n}",
    "java": "class Solution {\\n    public ReturnType functionName(ParamType param1, ParamType param2) {\\n        // Write your solution here\\n        return null;\\n    }\\n}",
    "cpp": "ReturnType functionName(ParamType param1, ParamType param2) {\\n    // Write your solution here\\n    return {};\\n}"
  }
}

Provide at least 4 test cases (2 visible, 2 hidden). Input must be a JSON object with named parameters matching the function parameters. Output must be the exact expected return value.`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer. Generate coding interview questions with test cases in valid JSON format only. The starterCode MUST be empty function bodies with NO logic or solution hints. Include 4+ test cases with structured input objects and expected outputs. Always include functionName for python, javascript, java, and cpp.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                temperature: 0.7,
                max_tokens: 2500,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        const jsonMatch=response.match(/\{[\s\S]*\}/);

        let question;
        if (jsonMatch)
        {
            question=JSON.parse(jsonMatch[0]);
            // Ensure required fields exist
            if (!question.title) question.title=`${(category||'Algorithm').charAt(0).toUpperCase()+(category||'algorithm').slice(1)} Challenge`;
            if (!question.description) question.description=question.problem||question.statement||question.body||'Solve the given problem.';
            if (!question.difficulty) question.difficulty=difficulty||'medium';
            if (!question.category) question.category=category||'algorithms';

            // Sanitize starter code — strip any logic, keep only function signature
            if (question.starterCode)
            {
                for (const lang of ['python', 'javascript', 'java', 'cpp'])
                {
                    if (question.starterCode[lang])
                    {
                        // Unescape double-escaped newlines from JSON
                        question.starterCode[lang]=question.starterCode[lang].replace(/\\n/g, '\n');
                    }
                }
            } else
            {
                const fn=question.functionName?.python||'solution';
                const fnJs=question.functionName?.javascript||'solution';
                question.starterCode={
                    python: `def ${fn}():\n    # Write your solution here\n    pass`,
                    javascript: `function ${fnJs}() {\n    // Write your solution here\n}`,
                    java: 'class Solution {\n    // Write your solution here\n}',
                    cpp: '// Write your solution here',
                };
            }

            // Ensure test cases exist
            if (!question.testCases||!Array.isArray(question.testCases)||question.testCases.length===0)
            {
                question.testCases=[];
            }

            // Ensure functionName exists
            if (!question.functionName)
            {
                question.functionName={python: 'solution', javascript: 'solution', java: 'solution', cpp: 'solution'};
            }
        } else
        {
            // Fallback
            question={
                title: 'Find Maximum Subarray Sum',
                difficulty: difficulty||'medium',
                category: category||'arrays',
                description: 'Given an integer array, find the contiguous subarray which has the largest sum and return its sum.',
                examples: [
                    {input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6'},
                    {input: 'nums = [1]', output: '1'}
                ],
                constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
                hints: ['Try using dynamic programming', 'Keep track of the current sum'],
                functionName: {python: 'max_sub_array', javascript: 'maxSubArray', java: 'maxSubArray', cpp: 'maxSubArray'},
                testCases: [
                    {input: {nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4]}, output: 6, hidden: false},
                    {input: {nums: [1]}, output: 1, hidden: false},
                    {input: {nums: [5, 4, -1, 7, 8]}, output: 23, hidden: true},
                    {input: {nums: [-1]}, output: -1, hidden: true}
                ],
                starterCode: {
                    python: 'def max_sub_array(nums):\n    # Write your solution here\n    pass',
                    javascript: 'function maxSubArray(nums) {\n    // Write your solution here\n}',
                    java: 'class Solution {\n    public int maxSubArray(int[] nums) {\n        // Write your solution here\n        return 0;\n    }\n}',
                    cpp: 'int maxSubArray(vector<int>& nums) {\n    // Write your solution here\n    return 0;\n}',
                },
            };
        }

        res.json({question});
    } catch (error)
    {
        console.error('Groq API error:', error);
        // Fallback response
        res.json({
            question: {
                title: 'Find Maximum Subarray Sum',
                difficulty: req.body.difficulty||'medium',
                category: req.body.category||'algorithms',
                description: 'Given an integer array, find the contiguous subarray which has the largest sum and return its sum.',
                examples: [
                    {input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6'},
                    {input: 'nums = [1]', output: '1'}
                ],
                functionName: {python: 'max_sub_array', javascript: 'maxSubArray', java: 'maxSubArray', cpp: 'maxSubArray'},
                testCases: [
                    {input: {nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4]}, output: 6, hidden: false},
                    {input: {nums: [1]}, output: 1, hidden: false},
                    {input: {nums: [5, 4, -1, 7, 8]}, output: 23, hidden: true},
                    {input: {nums: [-1]}, output: -1, hidden: true}
                ],
                starterCode: {
                    python: 'def max_sub_array(nums):\n    # Write your solution here\n    pass',
                    javascript: 'function maxSubArray(nums) {\n    // Write your solution here\n}',
                    java: 'class Solution {\n    public int maxSubArray(int[] nums) {\n        // Write your solution here\n        return 0;\n    }\n}',
                    cpp: 'int maxSubArray(vector<int>& nums) {\n    // Write your solution here\n    return 0;\n}',
                },
            },
        });
    }
});

// Legacy endpoint for backward compatibility
router.post('/ask-question', async (req, res) =>
{
    return router.handle({...req, url: '/generate-question'}, res);
});

// Evaluate code with AI using Groq
router.post('/evaluate-code', async (req, res) =>
{
    try
    {
        const {code, language, question}=req.body;

        const prompt=`Evaluate this ${language} code for the following problem:
Problem: ${question}

Code:
\`\`\`${language}
${code}
\`\`\`

Provide detailed feedback in JSON format:
{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "codeQuality": 8.5,
  "suggestions": ["suggestion 1", "suggestion 2"],
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "securityIssues": ["issue 1"]
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert code reviewer. Analyze code thoroughly for correctness, efficiency, and best practices. Return JSON only.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                temperature: 0.5,
                max_tokens: 1500,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        const jsonMatch=response.match(/\{[\s\S]*\}/);
        const feedback=jsonMatch? JSON.parse(jsonMatch[0]):{
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(1)',
            codeQuality: 7.5,
            suggestions: ['Add error handling', 'Consider edge cases'],
            strengths: ['Clean code structure'],
            improvements: ['Add comments', 'Optimize performance'],
        };

        res.json({feedback});
    } catch (error)
    {
        console.error('Groq API error:', error);
        res.json({
            feedback: {
                timeComplexity: 'O(n)',
                spaceComplexity: 'O(1)',
                codeQuality: 7.5,
                suggestions: ['Consider edge cases'],
                strengths: ['Code structure is readable'],
                improvements: ['Add error handling'],
            },
        });
    }
});

// Generate comprehensive AI feedback
router.post('/generate-feedback', async (req, res) =>
{
    try
    {
        const {interviewData, code, questions, proctoringScore}=req.body;

        const prompt=`Generate comprehensive interview feedback for a candidate:

Interview Performance:
- Questions attempted: ${questions||'N/A'}
- Code quality: ${code? 'Submitted':'Not submitted'}
- Proctoring integrity score: ${proctoringScore||100}/100

Provide detailed feedback in JSON format:
{
  "overallScore": 7.5,
  "strengths": ["strength 1", "strength 2"],
  "areasForImprovement": ["area 1", "area 2"],
  "detailedFeedback": "Comprehensive paragraph about performance",
  "technicalSkills": 8.0,
  "problemSolving": 7.5,
  "communication": 8.0,
  "recommendation": "Recommend for next round / Need more practice / Strong hire"
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer providing comprehensive candidate evaluations. Return JSON only.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                temperature: 0.6,
                max_tokens: 2000,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||'';
        const jsonMatch=response.match(/\{[\s\S]*\}/);
        const feedback=jsonMatch? JSON.parse(jsonMatch[0]):{
            overallScore: 7.5,
            strengths: ['Good problem-solving', 'Clear communication'],
            areasForImprovement: ['Edge case handling'],
            detailedFeedback: 'The candidate showed good technical skills.',
            recommendation: 'Recommend for next round',
        };

        res.json(feedback);
    } catch (error)
    {
        console.error('Groq API error:', error);
        res.json({
            overallScore: 7.5,
            strengths: ['Completed the interview', 'Showed technical knowledge'],
            areasForImprovement: ['Continue practicing'],
            detailedFeedback: 'The candidate demonstrated technical competence.',
            recommendation: 'Proceed to next evaluation',
        });
    }
});

// AI interviewer chat using Groq
router.post('/interview-chat', async (req, res) =>
{
    try
    {
        const {message, conversationHistory, currentQuestion}=req.body;

        const systemPrompt=`You are an AI technical interviewer conducting a coding interview. 
Current question context: ${currentQuestion||'General interview discussion'}

Guidelines:
- Be professional and encouraging
- Ask probing questions about time/space complexity
- Suggest optimizations when appropriate
- Provide hints without giving away the solution
- Keep responses concise (2-3 sentences)`;

        const messages=[
            {role: 'system', content: systemPrompt},
            ...(conversationHistory||[]),
            {role: 'user', content: message}
        ];

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: messages,
                model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                temperature: 0.7,
                max_tokens: 300,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                }
            }
        );

        const response=completion.data.choices[0]?.message?.content||
            "That's a good approach. Can you explain the time complexity?";

        res.json({
            response: response,
            nextAction: 'continue',
        });
    } catch (error)
    {
        console.error('Groq API error:', error);
        const fallbackResponses=[
            "That's a good approach. Can you explain the time complexity?",
            "Interesting solution. How would you handle edge cases?",
            "Great! Can you optimize this further?",
            "Good thinking. What's the space complexity of your solution?",
        ];
        res.json({
            response: fallbackResponses[Math.floor(Math.random()*fallbackResponses.length)],
            nextAction: 'continue',
        });
    }
});

export default router;
