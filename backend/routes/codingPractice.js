import express from 'express';
import axios from 'axios';
import {verifyAuth, verifyAuthOptional} from '../middleware/auth.js';
import testRunner from '../services/testRunner.js';
import questionBank from '../services/questionBank.js';
import aiDetector from '../services/aiDetector.js';

const router=express.Router();
const GROQ_TIMEOUT=30000;

// ═══════════════════════════════════════════════════════
// GET /questions – list all questions from question bank
// ═══════════════════════════════════════════════════════
router.get('/questions', verifyAuthOptional, (req, res) =>
{
    try
    {
        const {difficulty, company, topics, domain}=req.query;
        const filters={};
        if (difficulty) filters.difficulty=difficulty;
        if (company) filters.company=company;
        if (domain) filters.domain=domain;
        if (topics) filters.topics=topics.split(',');

        const questions=questionBank.getAllQuestions(filters);
        res.json({
            success: true,
            count: questions.length,
            questions: questions.map(q => ({
                id: q.id,
                title: q.title,
                difficulty: q.difficulty,
                domain: q.domain,
                topics: q.topics,
                companies: q.companies,
                description: q.description,
                examples: q.examples,
                constraints: q.constraints,
                hints: q.hints,
                starterCode: q.starterCode,
                functionName: q.functionName,
                testCases: (q.testCases||[]).filter(tc => !tc.hidden),
                totalTestCases: (q.testCases||[]).length,
                hiddenTestCases: (q.testCases||[]).filter(tc => tc.hidden).length
            }))
        });
    } catch (error)
    {
        console.error('Get questions error:', error);
        res.status(500).json({success: false, error: 'Failed to get questions', message: error.message});
    }
});

// ═══════════════════════════════════════════════════════
// GET /questions/:id – get full question details
// ═══════════════════════════════════════════════════════
router.get('/questions/:id', verifyAuthOptional, (req, res) =>
{
    try
    {
        const question=questionBank.getQuestionById(req.params.id);
        if (!question) return res.status(404).json({success: false, error: 'Question not found'});

        res.json({
            success: true,
            question: {
                ...question,
                testCases: (question.testCases||[]).filter(tc => !tc.hidden),
                totalTestCases: (question.testCases||[]).length,
                hiddenTestCases: (question.testCases||[]).filter(tc => tc.hidden).length
            }
        });
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to get question', message: error.message});
    }
});

// ═══════════════════════════════════════════════════════
// POST /run – run code against VISIBLE test cases (real execution)
// ═══════════════════════════════════════════════════════
router.post('/run', verifyAuthOptional, async (req, res) =>
{
    const {code, language, questionId, testCases: clientTestCases, functionName: clientFuncName}=req.body;

    if (!code||!language) return res.status(400).json({success: false, error: 'Code and language are required'});

    try
    {
        let testCases=[];
        let functionName=clientFuncName||{};

        // For question bank questions – get test cases from the bank
        if (questionId&&!questionId.startsWith('ai_'))
        {
            const question=questionBank.getQuestionById(questionId);
            if (!question) return res.status(404).json({success: false, error: 'Question not found'});
            testCases=question.testCases.filter(tc => !tc.hidden);
            functionName=question.functionName||{};
        } else if (clientTestCases&&clientTestCases.length>0)
        {
            // For AI-generated questions, client sends test cases
            testCases=clientTestCases.filter(tc => !tc.hidden);
        }

        if (testCases.length===0)
        {
            // No test cases – just execute the code directly
            const result=await testRunner.executeCode(code, language);
            return res.json({
                success: true,
                output: result.output||'',
                error: result.error||null,
                results: null
            });
        }

        const normalizedTestCases=normalizeTestCases(testCases, false);
        const testResults=await testRunner.runTests(code, language, normalizedTestCases, functionName);

        res.json({
            success: true,
            output: testResults.allPassed? 'All visible test cases passed!':'Some test cases failed.',
            results: {
                allPassed: testResults.allPassed,
                totalTests: testResults.totalTests,
                passedTests: testResults.passedTests,
                failedTests: testResults.failedTests,
                visibleTests: testResults.testResults.map(t => ({
                    caseNumber: t.caseNumber,
                    passed: t.passed,
                    input: t.input,
                    expectedOutput: t.expectedOutput,
                    actualOutput: t.actualOutput,
                    error: t.error,
                    executionTime: t.executionTime
                }))
            }
        });
    } catch (error)
    {
        console.error('Run error:', error);
        res.status(500).json({success: false, error: error.message});
    }
});

// ═══════════════════════════════════════════════════════
// POST /submit – run code against ALL test cases (visible + hidden)
// ═══════════════════════════════════════════════════════
router.post('/submit', verifyAuthOptional, async (req, res) =>
{
    const {code, language, questionId, testCases: clientTestCases, functionName: clientFuncName, userId}=req.body;

    if (!code||!language) return res.status(400).json({success: false, error: 'Code and language are required'});

    try
    {
        let testCases=[];
        let functionName=clientFuncName||{};

        if (questionId&&!questionId.startsWith('ai_'))
        {
            const question=questionBank.getQuestionById(questionId);
            if (!question) return res.status(404).json({success: false, error: 'Question not found'});
            testCases=question.testCases;
            functionName=question.functionName||{};
        } else if (clientTestCases&&clientTestCases.length>0)
        {
            testCases=clientTestCases;
        }

        if (testCases.length===0)
        {
            return res.status(400).json({success: false, error: 'No test cases available for this question'});
        }

        const normalizedTestCases=normalizeTestCases(testCases);
        const testResults=await testRunner.runTests(code, language, normalizedTestCases, functionName);

        // Track progress for question bank questions
        if (userId&&questionId&&!questionId.startsWith('ai_'))
        {
            try
            {
                questionBank.markQuestionSolved(userId, questionId, language, code, {
                    allPassed: testResults.allPassed,
                    passedTests: testResults.passedTests,
                    totalTests: testResults.totalTests
                });
            } catch (e) {console.warn('Failed to track progress:', e.message);}
        }

        res.json({
            success: true,
            message: testResults.allPassed? 'Accepted! All test cases passed.':'Wrong Answer. Some test cases failed.',
            solved: testResults.allPassed,
            results: {
                allPassed: testResults.allPassed,
                totalTests: testResults.totalTests,
                passedTests: testResults.passedTests,
                failedTests: testResults.failedTests,
                hiddenPassed: testResults.hiddenPassed,
                hiddenTotal: testResults.hiddenTotal,
                visibleTests: testResults.testResults.filter(t => !t.hidden).map(t => ({
                    caseNumber: t.caseNumber,
                    passed: t.passed,
                    input: t.input,
                    expectedOutput: t.expectedOutput,
                    actualOutput: t.actualOutput,
                    error: t.error,
                    executionTime: t.executionTime
                })),
                hiddenTests: testResults.testResults.filter(t => t.hidden).map(t => ({
                    caseNumber: t.caseNumber,
                    passed: t.passed,
                    error: t.error,
                    executionTime: t.executionTime
                }))
            }
        });
    } catch (error)
    {
        console.error('Submit error:', error);
        res.status(500).json({success: false, error: error.message});
    }
});

// ═══════════════════════════════════════════════════════
// POST /generate – generate a new coding question using AI
// ═══════════════════════════════════════════════════════
router.post('/generate', verifyAuthOptional, async (req, res) =>
{
    const {difficulty, topics, language, customPrompt}=req.body;

    try
    {
        if (!process.env.GROQ_API_KEY) return res.status(500).json({success: false, error: 'AI service not configured. Set GROQ_API_KEY.'});

        const difficultyLevel=difficulty||'Medium';
        const topicList=topics&&topics.length>0? topics.join(', '):'algorithms and data structures';
        const lang=language||'python';
        const customReq=customPrompt? `\nAdditional requirements: ${customPrompt}`:'';

        const prompt=`Generate a unique ${difficultyLevel} coding problem focused on ${topicList}.${customReq}

CRITICAL RULES:
- The problem must have ONE clear, unambiguous algorithm.
- Every test case output MUST be exactly what the reference solution produces.
- Provide a correct reference solution in ${lang}.
- Test case inputs must be JSON objects with keys matching the function parameters.
- Test case outputs must be actual values (arrays, numbers, booleans, strings).
- Function names must be the SAME across all languages.

Requirements:
- Clear problem statement
- 2-3 examples with input/output/explanation
- Constraints list
- At least 5 test cases (3 visible with hidden:false, 2 hidden with hidden:true) with CORRECT expected outputs
- Starter code for python, javascript, java, cpp
- A correct reference solution in ${lang}
- 2-3 hints

Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "Problem Title",
  "description": "Clear problem description",
  "examples": [{"input": "nums = [1,2,3], target = 5", "output": "result", "explanation": "brief explanation"}],
  "constraints": ["constraint 1"],
  "hints": ["hint 1", "hint 2"],
  "referenceSolution": "def function_name(params):\\n    return result",
  "testCases": [{"input": {"param1": [1,2,3]}, "output": 10, "hidden": false}],
  "starterCode": {"python": "def func(params):\\n    pass", "javascript": "function func(params) {\\n}", "java": "class Solution {\\n    public int func(int[] params) {\\n        return 0;\\n    }\\n}", "cpp": "int func(vector<int>& params) {\\n    return 0;\\n}"},
  "functionName": {"python": "func", "javascript": "func", "java": "func", "cpp": "func"}
}`;

        const response=await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            messages: [
                {role: 'system', content: 'You are an expert coding question generator like LeetCode. Return ONLY valid JSON. Every test case output MUST be correct. Test case inputs must be JSON objects with parameter names as keys.'},
                {role: 'user', content: prompt}
            ],
            model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
            temperature: 0.4,
            seed: Math.floor(Math.random()*10000),
            stream: false
        }, {
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`},
            timeout: GROQ_TIMEOUT
        });

        let question=parseQuestionResponse(response.data.choices[0].message.content);
        question.id='ai_'+Date.now();
        question.difficulty=difficulty||'Medium';
        question.topics=topics||['AI Generated'];
        question.domain='AI Generated';
        question.companies=[];
        question.isAIGenerated=true;

        // Validate test cases by running reference solution
        if (question.referenceSolution&&question.testCases?.length>0)
        {
            try
            {
                question=await validateAndFixTestCases(question, lang);
            } catch (valError)
            {
                console.warn('Test case validation failed:', valError.message);
                delete question.referenceSolution;
            }
        } else
        {
            delete question.referenceSolution;
        }

        res.json({success: true, question});
    } catch (error)
    {
        console.error('AI Question Generation Error:', error.response?.data||error.message);
        res.status(500).json({success: false, error: error.response?.data?.error?.message||error.message});
    }
});

// ═══════════════════════════════════════════════════════
// POST /hint – get AI hint for a problem
// ═══════════════════════════════════════════════════════
router.post('/hint', verifyAuthOptional, async (req, res) =>
{
    const {code, language, title, description}=req.body;

    try
    {
        if (!process.env.GROQ_API_KEY)
        {
            return res.json({success: true, hint: 'AI hints require API configuration. Try breaking the problem into smaller steps.'});
        }

        const prompt=`The user is solving this coding problem:
Title: ${title||'Unknown'}
Description: ${description||'No description'}

Their current code (${language||'unknown'}):
${code||'No code written yet'}

Give a helpful hint WITHOUT revealing the full solution. Be concise (2-3 sentences).`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {role: 'system', content: 'You are a helpful coding tutor. Give hints, not solutions. Be encouraging and brief.'},
                    {role: 'user', content: prompt}
                ],
                model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                temperature: 0.7,
                max_tokens: 200,
            },
            {
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`},
                timeout: GROQ_TIMEOUT,
            }
        );

        const hint=completion.data.choices[0]?.message?.content||'Try breaking the problem into smaller steps.';
        res.json({success: true, hint});
    } catch (error)
    {
        console.error('Hint error:', error.message);
        res.json({success: true, hint: 'Think about which data structure would optimize your solution. Consider edge cases carefully.'});
    }
});

// ═══════════════════════════════════════════════════════
// POST /detect – AI code detection (is code AI-generated?)
// ═══════════════════════════════════════════════════════
router.post('/detect', verifyAuthOptional, async (req, res) =>
{
    const {code, language}=req.body;
    if (!code||code.trim().length<20) return res.status(400).json({success: false, error: 'Code must be at least 20 characters for detection.'});

    try
    {
        const result=await aiDetector.detectAIGenerated(code, language||'javascript', {});
        res.json({success: true, detection: result});
    } catch (error)
    {
        console.error('AI detection error:', error.message);
        res.status(500).json({success: false, error: 'AI detection failed: '+error.message});
    }
});

// ═══════════════════════════════════════════════════════
// POST /analyze – AI code analysis (quality, complexity, suggestions)
// ═══════════════════════════════════════════════════════
router.post('/analyze', verifyAuthOptional, async (req, res) =>
{
    const {code, language, title, description}=req.body;
    if (!code||code.trim().length<10) return res.status(400).json({success: false, error: 'Code is too short to analyze.'});

    try
    {
        if (!process.env.GROQ_API_KEY) return res.status(500).json({success: false, error: 'AI service not configured.'});

        const prompt=`Analyze this ${language||'code'} solution${title? ` for "${title}"`:''}.
${description? `Problem: ${description}\n`:''}
CODE:
\`\`\`${language||'code'}
${code}
\`\`\`

Provide a comprehensive analysis. Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "timeComplexity": "O(?)",
  "spaceComplexity": "O(?)",
  "approach": "Brief description of the algorithm/approach used",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "codeSmells": ["smell 1"],
  "edgeCases": ["edge case that may fail"],
  "readability": <0-100>,
  "efficiency": <0-100>,
  "correctness": <0-100>
}`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {role: 'system', content: 'You are an expert code reviewer. Analyze code thoroughly and return only valid JSON. Be specific and practical.'},
                    {role: 'user', content: prompt}
                ],
                model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                temperature: 0.2,
                max_tokens: 1000,
            },
            {
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`},
                timeout: GROQ_TIMEOUT,
            }
        );

        let text=completion.data.choices[0]?.message?.content||'{}';
        text=text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let analysis;
        try {analysis=JSON.parse(text);}
        catch (e) {analysis={overallScore: 50, approach: 'Could not parse analysis', strengths: [], weaknesses: [], suggestions: ['Try again'], timeComplexity: 'Unknown', spaceComplexity: 'Unknown'};}
        res.json({success: true, analysis});
    } catch (error)
    {
        console.error('Code analysis error:', error.message);
        res.status(500).json({success: false, error: 'Code analysis failed: '+error.message});
    }
});

// ═══════════════════════════════════════════════════════
// POST /prompt – AI coding assistant (generate code from prompt)
// ═══════════════════════════════════════════════════════
router.post('/prompt', verifyAuthOptional, async (req, res) =>
{
    const {prompt, language, title, description, currentCode}=req.body;
    if (!prompt||prompt.trim().length<5) return res.status(400).json({success: false, error: 'Prompt must be at least 5 characters.'});

    try
    {
        if (!process.env.GROQ_API_KEY) return res.status(500).json({success: false, error: 'AI service not configured.'});

        const systemPrompt=`You are an expert coding assistant. Help the user with their coding problem.
${title? `Problem: ${title}`:''} ${description? `\nDescription: ${description}`:''}
Language: ${language||'javascript'}
${currentCode? `\nUser's current code:\n\`\`\`\n${currentCode}\n\`\`\``:''}\n
The user's request: ${prompt}

Provide a helpful response. If they ask for code, include working code. If they ask for explanation, explain clearly.
Use markdown formatting. Keep it concise but thorough.`;

        const completion=await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                messages: [
                    {role: 'system', content: 'You are an expert programming assistant. Provide clear, working solutions. Use markdown with code blocks.'},
                    {role: 'user', content: systemPrompt}
                ],
                model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                temperature: 0.3,
                max_tokens: 1500,
            },
            {
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`},
                timeout: GROQ_TIMEOUT,
            }
        );

        const response=completion.data.choices[0]?.message?.content||'No response generated.';
        res.json({success: true, response});
    } catch (error)
    {
        console.error('AI prompt error:', error.message);
        res.status(500).json({success: false, error: 'AI prompt failed: '+error.message});
    }
});

// ═══════════════════════════════════════════════════════
// GET /filters – get available filter options
// ═══════════════════════════════════════════════════════
router.get('/filters', (req, res) =>
{
    try
    {
        res.json({success: true, filters: questionBank.getFilterOptions()});
    } catch (error)
    {
        res.status(500).json({success: false, error: 'Failed to get filters'});
    }
});

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function normalizeTestCases(testCases, keepHidden=true)
{
    return testCases.map(tc =>
    {
        let normalizedInput=tc.input;
        if (typeof normalizedInput==='string') normalizedInput={__raw: normalizedInput};
        else if (Array.isArray(normalizedInput))
        {
            const obj={};
            normalizedInput.forEach((val, i) => {obj['param'+i]=val;});
            normalizedInput=obj;
        }
        let normalizedOutput=tc.output!==undefined? tc.output:tc.expectedOutput;
        if (typeof normalizedOutput==='string') {try {normalizedOutput=JSON.parse(normalizedOutput);} catch (e) {} }
        return {input: normalizedInput, output: normalizedOutput, hidden: keepHidden? (tc.hidden||false):false};
    });
}

function parseQuestionResponse(responseText)
{
    try
    {
        let cleaned=responseText.trim();
        if (cleaned.startsWith('```json')) cleaned=cleaned.substring(7);
        else if (cleaned.startsWith('```')) cleaned=cleaned.substring(3);
        if (cleaned.endsWith('```')) cleaned=cleaned.substring(0, cleaned.length-3);
        cleaned=cleaned.trim();
        const question=JSON.parse(cleaned);
        if (!question.title||!question.description) throw new Error('Missing required fields');
        question.examples=question.examples||[];
        question.constraints=question.constraints||[];
        question.hints=question.hints||[];
        question.testCases=question.testCases||[];
        question.starterCode=question.starterCode||{};
        question.functionName=question.functionName||{};
        return question;
    } catch (error)
    {
        console.error('Failed to parse AI question:', error);
        return {title: 'AI Generated Problem', description: 'The AI generated response could not be parsed. Please try again.', examples: [], constraints: [], hints: [], testCases: [], starterCode: {}, functionName: {}};
    }
}

function detectLanguage(code)
{
    if (code.includes('def ')&&code.includes(':')) return 'python';
    if (code.includes('function ')||code.includes('=>')||code.includes('const ')) return 'javascript';
    if (code.includes('public class')||code.includes('public static')) return 'java';
    if (code.includes('#include')||code.includes('std::')) return 'cpp';
    return null;
}

async function validateAndFixTestCases(question, language)
{
    const refSolution=question.referenceSolution;
    const funcName=question.functionName;
    if (!refSolution||!funcName) return question;
    const lang=detectLanguage(refSolution)||language||'python';
    let fixedCount=0;

    // Only validate first 3 test cases to avoid timeout
    const maxValidate=Math.min(question.testCases.length, 3);

    for (let i=0;i<maxValidate;i++)
    {
        const tc=question.testCases[i];
        try
        {
            let normalizedInput=tc.input;
            if (typeof normalizedInput==='string') normalizedInput={__raw: normalizedInput};
            else if (Array.isArray(normalizedInput))
            {
                const obj={};
                normalizedInput.forEach((val, idx) => {obj['param'+idx]=val;});
                normalizedInput=obj;
            }
            const testCase={input: normalizedInput, output: tc.output, hidden: tc.hidden};
            const testCode=testRunner.generateTestCode(refSolution, lang, testCase, funcName);
            const result=await testRunner.executeCode(testCode, lang);
            if (result.output&&!result.error)
            {
                let actualOutput;
                try {actualOutput=JSON.parse(result.output.trim());} catch (e) {actualOutput=result.output.trim();}
                if (JSON.stringify(tc.output)!==JSON.stringify(actualOutput))
                {
                    console.log(`[AI Validation] Test case ${i+1}: Expected ${JSON.stringify(tc.output)} but ref solution produced ${JSON.stringify(actualOutput)}. Fixing.`);
                    question.testCases[i].output=actualOutput;
                    fixedCount++;
                }
            }
        } catch (err) {console.warn(`[AI Validation] Failed to validate test case ${i+1}:`, err.message);}
    }
    if (fixedCount>0) console.log(`[AI Validation] Fixed ${fixedCount}/${maxValidate} test cases for "${question.title}"`);
    delete question.referenceSolution;
    return question;
}

export default router;
