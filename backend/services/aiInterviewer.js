import axios from 'axios';

const GROQ_TIMEOUT=15000; // 15s timeout for all AI calls
const MAX_CONVERSATION_HISTORY=20; // Cap conversation history entries per session

class AIInterviewer
{
    constructor()
    {
        this.apiKey=process.env.GROQ_API_KEY;
        this.apiUrl='https://api.groq.com/openai/v1/chat/completions';
        this.model=process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

        if (this.apiKey)
        {
            console.log('✅ Groq API Key loaded (configured)');
        } else
        {
            console.warn('⚠️  Warning: GROQ_API_KEY not found in environment variables');
        }

        // Role-based question banks
        this.roleQuestions={
            'Frontend Developer': [
                {id: 1, question: "What is the difference between let, const, and var in JavaScript?", topic: "JavaScript Basics", difficulty: "Easy"},
                {id: 2, question: "Explain the Virtual DOM and how React uses it.", topic: "React", difficulty: "Medium"},
                {id: 3, question: "What are React Hooks? Explain useState and useEffect.", topic: "React", difficulty: "Medium"},
                {id: 4, question: "How does CSS Grid differ from Flexbox? When would you use each?", topic: "CSS", difficulty: "Medium"},
                {id: 5, question: "What is the event loop in JavaScript?", topic: "JavaScript Advanced", difficulty: "Hard"},
                {id: 6, question: "Explain closures in JavaScript with an example.", topic: "JavaScript Advanced", difficulty: "Hard"},
                {id: 7, question: "What is the purpose of useCallback and useMemo in React?", topic: "React Advanced", difficulty: "Hard"},
                {id: 8, question: "How do you optimize the performance of a React application?", topic: "Performance", difficulty: "Hard"}
            ],
            'Backend Developer': [
                {id: 1, question: "What is the difference between SQL and NoSQL databases?", topic: "Databases", difficulty: "Easy"},
                {id: 2, question: "Explain the concept of RESTful APIs.", topic: "APIs", difficulty: "Easy"},
                {id: 3, question: "What is middleware in Express.js?", topic: "Node.js", difficulty: "Medium"},
                {id: 4, question: "How do you handle authentication and authorization in a Node.js application?", topic: "Security", difficulty: "Medium"},
                {id: 5, question: "What are promises and async/await in JavaScript?", topic: "Async Programming", difficulty: "Medium"},
                {id: 6, question: "Explain database indexing and its importance.", topic: "Database Optimization", difficulty: "Hard"},
                {id: 7, question: "How do you handle transactions in databases?", topic: "Databases", difficulty: "Hard"},
                {id: 8, question: "What strategies do you use for scaling a backend application?", topic: "System Design", difficulty: "Hard"}
            ],
            'Full Stack Developer': [
                {id: 1, question: "Explain the client-server architecture.", topic: "Web Architecture", difficulty: "Easy"},
                {id: 2, question: "What is CORS and why is it important?", topic: "Web Security", difficulty: "Medium"},
                {id: 3, question: "How do you manage state in a full-stack application?", topic: "State Management", difficulty: "Medium"},
                {id: 4, question: "Explain the concept of server-side rendering vs client-side rendering.", topic: "Rendering", difficulty: "Medium"},
                {id: 5, question: "How do you implement real-time communication in a web application?", topic: "WebSockets", difficulty: "Hard"},
                {id: 6, question: "What are microservices and when would you use them?", topic: "Architecture", difficulty: "Hard"},
                {id: 7, question: "How do you ensure security in a full-stack application?", topic: "Security", difficulty: "Hard"},
                {id: 8, question: "Explain your approach to testing a full-stack application.", topic: "Testing", difficulty: "Hard"}
            ],
            'Data Scientist': [
                {id: 1, question: "What is the difference between supervised and unsupervised learning?", topic: "Machine Learning", difficulty: "Easy"},
                {id: 2, question: "Explain what overfitting means and how to prevent it.", topic: "Model Training", difficulty: "Medium"},
                {id: 3, question: "What is feature engineering and why is it important?", topic: "Data Processing", difficulty: "Medium"},
                {id: 4, question: "Explain the difference between precision and recall.", topic: "Model Evaluation", difficulty: "Medium"},
                {id: 5, question: "How do you handle missing data in a dataset?", topic: "Data Cleaning", difficulty: "Medium"},
                {id: 6, question: "Explain the bias-variance tradeoff.", topic: "Machine Learning Theory", difficulty: "Hard"},
                {id: 7, question: "What are neural networks and how do they work?", topic: "Deep Learning", difficulty: "Hard"},
                {id: 8, question: "How do you approach A/B testing and statistical significance?", topic: "Statistics", difficulty: "Hard"}
            ],
            'DevOps Engineer': [
                {id: 1, question: "What is CI/CD and why is it important?", topic: "DevOps Basics", difficulty: "Easy"},
                {id: 2, question: "Explain the difference between Docker and virtual machines.", topic: "Containerization", difficulty: "Medium"},
                {id: 3, question: "What is Infrastructure as Code (IaC)?", topic: "Infrastructure", difficulty: "Medium"},
                {id: 4, question: "How do you monitor application performance in production?", topic: "Monitoring", difficulty: "Medium"},
                {id: 5, question: "Explain the concept of blue-green deployment.", topic: "Deployment Strategies", difficulty: "Medium"},
                {id: 6, question: "How do you handle secrets management in a cloud environment?", topic: "Security", difficulty: "Hard"},
                {id: 7, question: "What is Kubernetes and what problems does it solve?", topic: "Orchestration", difficulty: "Hard"},
                {id: 8, question: "How do you design a disaster recovery plan?", topic: "System Reliability", difficulty: "Hard"}
            ]
        };

        this.conversationHistory=new Map(); // Store conversation history per session
    }

    // Get role-based questions (static)
    getQuestionsForRole(role, count=5)
    {
        const questions=this.roleQuestions[role]||this.roleQuestions['Frontend Developer'];
        // Randomize and select questions
        const shuffled=[...questions].sort(() => Math.random()-0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    // AI-powered question generation
    async generateAIQuestions(role, count=5, difficulty='Mixed', topics=[])
    {
        try
        {
            const topicStr=topics.length>0
                ? `\n- MUST focus on these specific topics: ${topics.join(', ')}`
                :'';

            // Unique seed per interview to guarantee variety
            const uniqueSeed=`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

            const prompt=`You are an expert technical interviewer at a top tech company, hiring for a ${role} position.
Session ID: ${uniqueSeed} (use this to ensure unique question generation — NEVER repeat the same set of questions across sessions)

Generate ${count} unique, high-quality interview questions with the following requirements:
- Difficulty level: ${difficulty}
- Cover different aspects of the role (technical depth, problem-solving, real-world scenarios, system design, debugging, etc.)${topicStr}
- Include a mix of:
  • Conceptual questions ("Explain how X works under the hood")
  • Scenario-based questions ("You encounter X situation, how do you handle it?")
  • Coding/practical questions ("How would you implement X?")
  • Experience questions ("Tell me about a time you...")
- Questions should be in RANDOM order of difficulty — do NOT always start with easy questions
- Questions should be specific, detailed, and NOT generic
- Relevant to current industry standards and best practices (2026)
- Each question should test a DIFFERENT skill or concept
- IMPORTANT: Be creative and generate DIFFERENT questions each time. Do NOT fall into patterns of asking the same first question.

Return ONLY a valid JSON array with this structure (no markdown, no code blocks, no extra text):
[
  {
    "id": 1,
    "question": "Detailed question text here",
    "topic": "Specific topic name",
    "difficulty": "Easy|Medium|Hard",
    "expectedSkills": ["skill1", "skill2"]
  }
]

Make questions conversational, specific, deeply technical, and insightful. Avoid generic questions like "tell me about yourself".`;

            const response=await axios.post(this.apiUrl, {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer at a leading tech company. Generate deeply relevant, insightful, and specific interview questions that truly test a candidate\'s knowledge. Return only valid JSON arrays. Never include markdown formatting.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: this.model,
                temperature: 0.75,
                max_tokens: 2500
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: GROQ_TIMEOUT,
            });

            const questionsText=response.data.choices[0].message.content;
            let questions=this.parseQuestionsResponse(questionsText);

            if (questions.length>0)
            {
                // Shuffle questions to ensure different starting question each time
                questions=questions.sort(() => Math.random()-0.5);
                // Re-assign IDs after shuffle
                questions=questions.map((q, idx) => ({...q, id: idx+1}));
                console.log(`✅ AI generated ${questions.length} unique questions (shuffled)`);
            } else
            {
                console.warn('⚠️ AI returned empty questions, falling back to static bank');
                return this.getQuestionsForRole(role, count);
            }

            return questions.slice(0, count);
        } catch (error)
        {
            console.error('❌ AI Question Generation Error:', error.response?.data||error.message);
            console.log('↩️ Falling back to static question bank');
            // Fallback to static questions
            return this.getQuestionsForRole(role, count);
        }
    }

    // Parse AI-generated questions
    parseQuestionsResponse(text)
    {
        try
        {
            let jsonText=text.trim();
            // Remove markdown code blocks if present
            if (jsonText.startsWith('```json'))
            {
                jsonText=jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (jsonText.startsWith('```'))
            {
                jsonText=jsonText.replace(/```\n?/g, '');
            }

            const parsed=JSON.parse(jsonText);
            // Ensure it's an array
            return Array.isArray(parsed)? parsed:[parsed];
        } catch (error)
        {
            console.error('Parse error for questions:', error);
            // Return empty array, will trigger fallback
            return [];
        }
    }

    // Generate greeting message
    generateGreeting(candidateName, role)
    {
        return `Hello ${candidateName}, welcome to your ${role} interview! I'm your AI interviewer today. 

I'll be asking you a series of questions to assess your knowledge and skills. Feel free to answer via voice or text - whichever you're more comfortable with. 

Let's begin with your interview. Are you ready?`;
    }

    // Generate follow-up question using AI
    async generateFollowUpQuestion(originalQuestion, candidateAnswer, role, sessionId)
    {
        try
        {
            // Get conversation history
            const history=this.conversationHistory.get(sessionId)||[];

            const prompt=`You are an experienced technical interviewer for a ${role} position.

Original Question: ${originalQuestion}
Candidate's Answer: ${candidateAnswer}

Based on the candidate's answer, generate ONE intelligent follow-up question that:
1. Probes deeper into their understanding
2. Tests practical application of the concept
3. Reveals their problem-solving approach
4. Is specific to what they just said

Return ONLY the follow-up question text, nothing else. Keep it concise and conversational.`;

            const response=await axios.post(this.apiUrl, {
                messages: [
                    {role: 'system', content: 'You are an expert technical interviewer. Generate insightful follow-up questions.'},
                    ...history.slice(-MAX_CONVERSATION_HISTORY),
                    {role: 'user', content: prompt}
                ],
                model: this.model,
                temperature: 0.7,
                max_tokens: 200
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: GROQ_TIMEOUT,
            });

            const followUpQuestion=response.data.choices[0].message.content.trim();

            // Update conversation history (with cap)
            history.push(
                {role: 'user', content: prompt},
                {role: 'assistant', content: followUpQuestion}
            );
            // Trim history if too long
            if (history.length>MAX_CONVERSATION_HISTORY)
            {
                history.splice(0, history.length-MAX_CONVERSATION_HISTORY);
            }
            this.conversationHistory.set(sessionId, history);

            return followUpQuestion;
        } catch (error)
        {
            console.error('Error generating follow-up:', error.response?.data||error.message);
            return "Can you elaborate more on your answer?";
        }
    }

    // Evaluate candidate's answer with detailed metrics
    async evaluateAnswer({
        question,
        answer,
        role,
        audioMetrics={} // Voice tone, pauses, confidence from audio analysis
    })
    {
        try
        {
            const prompt=`You are an expert technical interviewer evaluating a candidate for a ${role} position.

Question: ${question}
Candidate's Answer: ${answer}

Evaluate this answer on multiple dimensions and return a JSON response with the following structure (return ONLY valid JSON, no markdown):

{
  "technicalKnowledge": {
    "score": 0-100,
    "feedback": "Assessment of technical accuracy and depth"
  },
  "communication": {
    "score": 0-100,
    "feedback": "Assessment of clarity, structure, and articulation"
  },
  "problemSolving": {
    "score": 0-100,
    "feedback": "Assessment of logical thinking and approach"
  },
  "confidence": {
    "score": 0-100,
    "feedback": "Assessment based on answer completeness and conviction"
  },
  "consistency": {
    "score": 0-100,
    "feedback": "Check for contradictions or logical inconsistencies"
  },
  "overallScore": 0-100,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "detailedFeedback": "Comprehensive feedback on the answer"
}

Be fair but thorough in your evaluation.`;

            const response=await axios.post(this.apiUrl, {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer. Evaluate answers objectively and provide detailed feedback. Return only valid JSON.'
                    },
                    {role: 'user', content: prompt}
                ],
                model: this.model,
                temperature: 0.3,
                seed: 42
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: GROQ_TIMEOUT,
            });

            const evaluationText=response.data.choices[0].message.content;
            const evaluation=this.parseEvaluationResponse(evaluationText);

            // Adjust confidence score if audio metrics are provided
            if (audioMetrics.confidence!==undefined)
            {
                evaluation.confidence.score=Math.round(
                    (evaluation.confidence.score+audioMetrics.confidence)/2
                );
            }

            return evaluation;
        } catch (error)
        {
            console.error('Evaluation Error:', error.response?.data||error.message);
            return this.getFallbackEvaluation();
        }
    }

    // Parse AI evaluation response
    parseEvaluationResponse(text)
    {
        try
        {
            // Remove markdown code blocks if present
            let jsonText=text.trim();
            if (jsonText.startsWith('```json'))
            {
                jsonText=jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (jsonText.startsWith('```'))
            {
                jsonText=jsonText.replace(/```\n?/g, '');
            }

            return JSON.parse(jsonText);
        } catch (error)
        {
            console.error('Parse error:', error);
            return this.getFallbackEvaluation();
        }
    }

    // Fallback evaluation if AI fails
    getFallbackEvaluation()
    {
        return {
            technicalKnowledge: {score: 70, feedback: "Answer shows basic understanding"},
            communication: {score: 70, feedback: "Communication was clear"},
            problemSolving: {score: 65, feedback: "Demonstrated logical thinking"},
            confidence: {score: 70, feedback: "Answer was delivered with reasonable confidence"},
            consistency: {score: 75, feedback: "Answer was consistent throughout"},
            overallScore: 70,
            strengths: ["Basic understanding demonstrated"],
            weaknesses: ["Could provide more depth"],
            detailedFeedback: "The answer shows basic understanding of the concept."
        };
    }

    // Generate final interview report
    async generateFinalReport({
        candidateName,
        role,
        questionAnswerPairs, // Array of {question, answer, evaluation}
        duration,
        sessionId
    })
    {
        try
        {
            // Calculate aggregate scores
            const avgScores=this.calculateAverageScores(questionAnswerPairs);

            // Generate hiring recommendation using AI
            const recommendation=await this.generateHiringRecommendation({
                candidateName,
                role,
                avgScores,
                questionAnswerPairs
            });

            const report={
                candidateName,
                role,
                interviewDate: new Date().toISOString(),
                duration: duration, // in minutes
                totalQuestions: questionAnswerPairs.length,
                scores: {
                    overall: avgScores.overall,
                    technicalKnowledge: avgScores.technicalKnowledge,
                    communication: avgScores.communication,
                    problemSolving: avgScores.problemSolving,
                    confidence: avgScores.confidence,
                    consistency: avgScores.consistency
                },
                strengths: this.aggregateStrengths(questionAnswerPairs),
                weaknesses: this.aggregateWeaknesses(questionAnswerPairs),
                questionDetails: questionAnswerPairs.map(qa => ({
                    question: qa.question,
                    answer: qa.answer,
                    evaluation: qa.evaluation,
                    followUps: qa.followUps||[]
                })),
                recommendation: recommendation,
                generatedAt: new Date().toISOString()
            };

            // Clear conversation history for this session
            this.conversationHistory.delete(sessionId);

            return report;
        } catch (error)
        {
            console.error('Report Generation Error:', error);
            throw error;
        }
    }

    // Calculate average scores from all evaluations
    calculateAverageScores(questionAnswerPairs)
    {
        const totals={
            overall: 0,
            technicalKnowledge: 0,
            communication: 0,
            problemSolving: 0,
            confidence: 0,
            consistency: 0
        };

        questionAnswerPairs.forEach(qa =>
        {
            const evaluation=qa.evaluation||{};
            totals.overall+=(evaluation.overallScore||0);
            totals.technicalKnowledge+=(evaluation.technicalKnowledge?.score||evaluation.technicalKnowledge||0);
            totals.communication+=(evaluation.communication?.score||evaluation.communication||0);
            totals.problemSolving+=(evaluation.problemSolving?.score||evaluation.problemSolving||0);
            totals.confidence+=(evaluation.confidence?.score||evaluation.confidence||0);
            totals.consistency+=(evaluation.consistency?.score||evaluation.consistency||0);
        });

        const count=questionAnswerPairs.length||1;
        return {
            overall: Math.round(totals.overall/count),
            technicalKnowledge: Math.round(totals.technicalKnowledge/count),
            communication: Math.round(totals.communication/count),
            problemSolving: Math.round(totals.problemSolving/count),
            confidence: Math.round(totals.confidence/count),
            consistency: Math.round(totals.consistency/count)
        };
    }

    // Aggregate strengths from all evaluations
    aggregateStrengths(questionAnswerPairs)
    {
        const strengthsMap=new Map();
        questionAnswerPairs.forEach(qa =>
        {
            const strengths=qa.evaluation?.strengths||[];
            strengths.forEach(strength =>
            {
                if (strength) strengthsMap.set(strength, (strengthsMap.get(strength)||0)+1);
            });
        });
        const result=Array.from(strengthsMap.entries())
            .sort((a, b) => b[1]-a[1])
            .slice(0, 5)
            .map(([strength]) => strength);
        return result.length>0? result:['Interview completed — strengths analysis pending'];
    }

    // Aggregate weaknesses from all evaluations
    aggregateWeaknesses(questionAnswerPairs)
    {
        const weaknessesMap=new Map();
        questionAnswerPairs.forEach(qa =>
        {
            const weaknesses=qa.evaluation?.weaknesses||[];
            weaknesses.forEach(weakness =>
            {
                if (weakness) weaknessesMap.set(weakness, (weaknessesMap.get(weakness)||0)+1);
            });
        });
        const result=Array.from(weaknessesMap.entries())
            .sort((a, b) => b[1]-a[1])
            .slice(0, 5)
            .map(([weakness]) => weakness);
        return result.length>0? result:['Continue practicing to identify specific areas'];
    }

    // Generate hiring recommendation using AI
    async generateHiringRecommendation({candidateName, role, avgScores, questionAnswerPairs})
    {
        try
        {
            const prompt=`As an expert hiring manager, provide a hiring recommendation for:

Candidate: ${candidateName}
Role: ${role}

Performance Scores:
- Overall: ${avgScores.overall}/100
- Technical Knowledge: ${avgScores.technicalKnowledge}/100
- Communication: ${avgScores.communication}/100
- Problem Solving: ${avgScores.problemSolving}/100
- Confidence: ${avgScores.confidence}/100

Number of questions answered: ${questionAnswerPairs.length}

Provide a JSON response with:
{
  "recommendation": "Strongly Recommend|Recommend|Maybe|Not Recommend",
  "reasoning": "Brief explanation of the recommendation",
  "fitScore": 0-100,
  "nextSteps": "Suggested next steps in hiring process"
}

Return ONLY valid JSON, no markdown.`;

            const response=await axios.post(this.apiUrl, {
                messages: [
                    {role: 'system', content: 'You are an expert hiring manager. Provide fair and data-driven hiring recommendations. Return only valid JSON.'},
                    {role: 'user', content: prompt}
                ],
                model: this.model,
                temperature: 0.3
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: GROQ_TIMEOUT,
            });

            const recommendationText=response.data.choices[0].message.content;
            return this.parseRecommendationResponse(recommendationText);
        } catch (error)
        {
            console.error('Recommendation Error:', error);
            return this.getFallbackRecommendation(avgScores.overall);
        }
    }

    // Parse recommendation response
    parseRecommendationResponse(text)
    {
        try
        {
            let jsonText=text.trim();
            if (jsonText.startsWith('```json'))
            {
                jsonText=jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (jsonText.startsWith('```'))
            {
                jsonText=jsonText.replace(/```\n?/g, '');
            }
            return JSON.parse(jsonText);
        } catch (error)
        {
            console.error('Parse error:', error);
            return this.getFallbackRecommendation(70);
        }
    }

    // Fallback recommendation
    getFallbackRecommendation(overallScore)
    {
        let recommendation="Maybe";
        if (overallScore>=80) recommendation="Strongly Recommend";
        else if (overallScore>=70) recommendation="Recommend";
        else if (overallScore<60) recommendation="Not Recommend";

        return {
            recommendation,
            reasoning: "Based on overall performance score",
            fitScore: overallScore,
            nextSteps: recommendation.includes("Recommend")
                ? "Proceed to next interview round"
                :"Consider additional screening"
        };
    }
}

export default new AIInterviewer();
