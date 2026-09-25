import {useState, useEffect} from 'react';
import {FileText as DocumentIcon, Book as BookIcon, Bot as RobotIcon, CheckCircle as CheckCircleIcon, RefreshCw as RefreshIcon, Folder as FolderIcon, Sparkles as SparklesIcon, Loader2 as LoadingIcon} from 'lucide-react';
import './QuestionSelector.css';

const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5001';

function QuestionSelector({onQuestionSelected, onClose})
{
    const [mode, setMode]=useState('library'); // library, ai, custom
    const [loading, setLoading]=useState(false);
    const [error, setError]=useState(null);

    // AI Generation
    const [aiDifficulty, setAiDifficulty]=useState('medium');
    const [aiCategory, setAiCategory]=useState('algorithms');
    const [customPrompt, setCustomPrompt]=useState('');
    const [generatedQuestion, setGeneratedQuestion]=useState(null);

    // Custom Question
    const [customQuestion, setCustomQuestion]=useState({
        title: '',
        difficulty: 'medium',
        category: 'algorithms',
        description: '',
        examples: [{input: '', output: ''}],
        starterCode: {
            python: 'def solution():\n    pass',
            javascript: 'function solution() {\n    // your code here\n}',
            java: 'public class Solution {\n    // your code here\n}',
            cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}',
        },
    });

    // Library questions
    const [libraryQuestions, setLibraryQuestions]=useState([]);
    const [selectedLibraryQuestion, setSelectedLibraryQuestion]=useState(null);

    // ESC key handler to close modal
    useEffect(() =>
    {
        const handleKeyDown=(e) =>
        {
            if (e.key==='Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Auto-load library questions on mount
    useEffect(() =>
    {
        loadLibraryQuestions();
    }, []);

    const loadLibraryQuestions=async () =>
    {
        try
        {
            setLoading(true);
            const response=await fetch(`${API_URL}/api/questions`, {credentials: 'include'});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data=await response.json();
            setLibraryQuestions(Array.isArray(data)? data:(data.data||[]));
        } catch (err)
        {
            setError('Failed to load questions');
        } finally
        {
            setLoading(false);
        }
    };

    const handleGenerateAI=async () =>
    {
        setLoading(true);
        setError(null);
        try
        {
            const response=await fetch(`${API_URL}/api/ai/generate-question`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({
                    difficulty: aiDifficulty,
                    category: aiCategory,
                    customPrompt: customPrompt||null,
                }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data=await response.json();
            setGeneratedQuestion(data.question);
        } catch (err)
        {
            setError('Failed to generate question. Please try again.');
        } finally
        {
            setLoading(false);
        }
    };

    const handleUseGeneratedQuestion=async () =>
    {
        if (!generatedQuestion) return;

        // Ensure required fields exist
        const questionData=generatedQuestion.question||generatedQuestion;
        if (!questionData.title||!questionData.description)
        {
            setError('Generated question is missing title or description. Please regenerate.');
            return;
        }

        try
        {
            // Save to database
            const response=await fetch(`${API_URL}/api/questions`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify(questionData),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const savedQuestion=await response.json();
            onQuestionSelected(savedQuestion.data||savedQuestion);
        } catch (err)
        {
            setError('Failed to save question');
        }
    };

    const handleCreateCustom=async () =>
    {
        if (!customQuestion.title||!customQuestion.description)
        {
            setError('Please fill in title and description');
            return;
        }

        setLoading(true);
        try
        {
            const response=await fetch(`${API_URL}/api/questions`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify(customQuestion),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const savedQuestion=await response.json();
            onQuestionSelected(savedQuestion);
        } catch (err)
        {
            setError('Failed to save custom question');
        } finally
        {
            setLoading(false);
        }
    };

    const handleSelectLibraryQuestion=async (questionId) =>
    {
        try
        {
            const response=await fetch(`${API_URL}/api/questions/${questionId}`, {credentials: 'include'});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const question=await response.json();
            onQuestionSelected(question);
        } catch (err)
        {
            setError('Failed to load question');
        }
    };

    const addExample=() =>
    {
        setCustomQuestion(prev => ({
            ...prev,
            examples: [...prev.examples, {input: '', output: ''}],
        }));
    };

    const updateExample=(index, field, value) =>
    {
        setCustomQuestion(prev =>
        {
            const newExamples=[...prev.examples];
            newExamples[index][field]=value;
            return {...prev, examples: newExamples};
        });
    };

    const removeExample=(index) =>
    {
        setCustomQuestion(prev => ({
            ...prev,
            examples: prev.examples.filter((_, i) => i!==index),
        }));
    };

    return (
        <div className="question-selector-overlay">
            <div className="question-selector-modal">
                <div className="modal-header">
                    <h2><DocumentIcon size={20} /> Select or Create Question</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="mode-tabs">
                    <button
                        className={mode==='library'? 'active':''}
                        onClick={() => {setMode('library'); loadLibraryQuestions();}}
                    >
                        <BookIcon size={16} /> Question Library
                    </button>
                    <button
                        className={mode==='ai'? 'active':''}
                        onClick={() => setMode('ai')}
                    >
                        <RobotIcon size={16} /> AI Generate
                    </button>
                    <button
                        className={mode==='custom'? 'active':''}
                        onClick={() => setMode('custom')}
                    >
                        <DocumentIcon size={16} /> Custom Question
                    </button>
                </div>

                {error&&<div className="error-message">{error}</div>}

                <div className="modal-content">
                    {/* LIBRARY MODE */}
                    {mode==='library'&&(
                        <div className="library-mode">
                            <h3>Choose from Existing Questions</h3>
                            {loading? (
                                <div className="loading-spinner">Loading...</div>
                            ):(
                                <div className="questions-list">
                                    {libraryQuestions.map(q => (
                                        <div key={q._id||q.id} className="library-question-card">
                                            <div className="question-header-row">
                                                <h4>{q.title}</h4>
                                                <span className={`badge badge-${q.difficulty}`}>
                                                    {q.difficulty}
                                                </span>
                                            </div>
                                            <p className="question-category"><FolderIcon size={14} /> {q.category}</p>
                                            <p className="question-preview">{q.description}</p>
                                            <button
                                                className="select-btn"
                                                onClick={() => handleSelectLibraryQuestion(q._id||q.id)}
                                            >
                                                Select This Question
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* AI GENERATION MODE */}
                    {mode==='ai'&&(
                        <div className="ai-mode">
                            <h3><RobotIcon size={20} /> Generate Question with AI</h3>

                            <div className="form-group">
                                <label>Difficulty Level</label>
                                <select
                                    value={aiDifficulty}
                                    onChange={(e) => setAiDifficulty(e.target.value)}
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Category/Topic</label>
                                <select
                                    value={aiCategory}
                                    onChange={(e) => setAiCategory(e.target.value)}
                                >
                                    <option value="algorithms">Algorithms</option>
                                    <option value="arrays">Arrays</option>
                                    <option value="strings">Strings</option>
                                    <option value="trees">Trees</option>
                                    <option value="graphs">Graphs</option>
                                    <option value="dynamic-programming">Dynamic Programming</option>
                                    <option value="sorting">Sorting</option>
                                    <option value="searching">Searching</option>
                                    <option value="linked-lists">Linked Lists</option>
                                    <option value="stack-queue">Stack & Queue</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Custom Prompt (Optional)</label>
                                <textarea
                                    placeholder="E.g., 'Generate a question about finding the longest palindrome in a string'"
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <button
                                className="generate-btn"
                                onClick={handleGenerateAI}
                                disabled={loading}
                            >
                                {loading? <><LoadingIcon size={16} /> Generating...</>:<><SparklesIcon size={16} /> Generate Question</>}
                            </button>

                            {generatedQuestion&&(
                                <div className="generated-question-preview">
                                    <h4>{generatedQuestion.title}</h4>
                                    <span className={`badge badge-${generatedQuestion.difficulty}`}>
                                        {generatedQuestion.difficulty}
                                    </span>
                                    <p><strong>Category:</strong> {generatedQuestion.category}</p>
                                    <p><strong>Description:</strong> {generatedQuestion.description}</p>

                                    {generatedQuestion.examples&&(
                                        <div className="examples">
                                            <strong>Examples:</strong>
                                            {generatedQuestion.examples.map((ex, i) => (
                                                <div key={i} className="example">
                                                    <div>Input: {typeof ex.input==='object'? JSON.stringify(ex.input):String(ex.input)}</div>
                                                    <div>Output: {typeof ex.output==='object'? JSON.stringify(ex.output):String(ex.output)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        className="use-question-btn"
                                        onClick={handleUseGeneratedQuestion}
                                    >
                                        <CheckCircleIcon size={16} /> Use This Question
                                    </button>
                                    <button
                                        className="regenerate-btn"
                                        onClick={handleGenerateAI}
                                    >
                                        <RefreshIcon size={16} /> Regenerate
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CUSTOM MODE */}
                    {mode==='custom'&&(
                        <div className="custom-mode">
                            <h3><DocumentIcon size={20} /> Create Your Own Question</h3>

                            <div className="form-group">
                                <label>Question Title *</label>
                                <input
                                    type="text"
                                    placeholder="E.g., Two Sum"
                                    value={customQuestion.title}
                                    onChange={(e) => setCustomQuestion({...customQuestion, title: e.target.value})}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Difficulty</label>
                                    <select
                                        value={customQuestion.difficulty}
                                        onChange={(e) => setCustomQuestion({...customQuestion, difficulty: e.target.value})}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Category</label>
                                    <input
                                        type="text"
                                        placeholder="E.g., arrays"
                                        value={customQuestion.category}
                                        onChange={(e) => setCustomQuestion({...customQuestion, category: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description *</label>
                                <textarea
                                    placeholder="Describe the problem clearly..."
                                    value={customQuestion.description}
                                    onChange={(e) => setCustomQuestion({...customQuestion, description: e.target.value})}
                                    rows={4}
                                />
                            </div>

                            <div className="form-group">
                                <label>Examples</label>
                                {customQuestion.examples.map((example, index) => (
                                    <div key={index} className="example-input-group">
                                        <input
                                            type="text"
                                            placeholder="Input"
                                            value={example.input}
                                            onChange={(e) => updateExample(index, 'input', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Output"
                                            value={example.output}
                                            onChange={(e) => updateExample(index, 'output', e.target.value)}
                                        />
                                        {customQuestion.examples.length>1&&(
                                            <button
                                                className="remove-btn"
                                                onClick={() => removeExample(index)}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button className="add-example-btn" onClick={addExample}>
                                    + Add Example
                                </button>
                            </div>

                            <div className="form-group">
                                <label>Starter Code (Optional)</label>
                                <div className="code-inputs">
                                    <div className="code-input">
                                        <strong>Python:</strong>
                                        <textarea
                                            value={customQuestion.starterCode.python}
                                            onChange={(e) => setCustomQuestion({
                                                ...customQuestion,
                                                starterCode: {...customQuestion.starterCode, python: e.target.value}
                                            })}
                                            rows={3}
                                        />
                                    </div>
                                    <div className="code-input">
                                        <strong>JavaScript:</strong>
                                        <textarea
                                            value={customQuestion.starterCode.javascript}
                                            onChange={(e) => setCustomQuestion({
                                                ...customQuestion,
                                                starterCode: {...customQuestion.starterCode, javascript: e.target.value}
                                            })}
                                            rows={3}
                                        />
                                    </div>
                                    <div className="code-input">
                                        <strong>Java:</strong>
                                        <textarea
                                            value={customQuestion.starterCode.java}
                                            onChange={(e) => setCustomQuestion({
                                                ...customQuestion,
                                                starterCode: {...customQuestion.starterCode, java: e.target.value}
                                            })}
                                            rows={3}
                                        />
                                    </div>
                                    <div className="code-input">
                                        <strong>C++:</strong>
                                        <textarea
                                            value={customQuestion.starterCode.cpp}
                                            onChange={(e) => setCustomQuestion({
                                                ...customQuestion,
                                                starterCode: {...customQuestion.starterCode, cpp: e.target.value}
                                            })}
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                className="create-btn"
                                onClick={handleCreateCustom}
                                disabled={loading}
                            >
                                {loading? <><LoadingIcon size={16} /> Creating...</>:<><CheckCircleIcon size={16} /> Create & Use Question</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default QuestionSelector;
