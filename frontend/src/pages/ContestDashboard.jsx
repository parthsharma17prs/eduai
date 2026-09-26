import {useState, useEffect, useCallback} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {Code2, Plus, Globe, Gamepad2, Trash2, Play, Trophy, Users, Clock, Zap, ChevronRight, Sparkles, Settings, Eye, EyeOff, AlertCircle} from 'lucide-react';
import {API_BASE_URL} from '../services/api';
import './ContestDashboard.css';

const API_URL = API_BASE_URL;

const DIFFICULTY_COLORS={easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444'};
const STATUS_LABELS={draft: 'Draft', waiting: 'Open', active: 'Live', completed: 'Ended'};

async function apiFetch(path, opts={})
{
    const res=await fetch(`${API_URL}${path}`, {
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        ...opts,
    });
    if (!res.ok)
    {
        const err=await res.json().catch(() => ({}));
        throw new Error(err.error||`Request failed (${res.status})`);
    }
    return res.json();
}

export default function ContestDashboard()
{
    const navigate=useNavigate();
    const [searchParams]=useSearchParams();
    const [contests, setContests]=useState([]);
    const [loading, setLoading]=useState(true);
    const [view, setView]=useState(searchParams.get('view')||(searchParams.get('code')? 'join':'list'));
    const [selectedContest, setSelectedContest]=useState(null);
    const [publicContests, setPublicContests]=useState([]);
    const [browseLoading, setBrowseLoading]=useState(false);
    const [error, setError]=useState('');
    const [successMsg, setSuccessMsg]=useState('');

    // Join state
    const [joinCode, setJoinCode]=useState(searchParams.get('code')||'');
    const [joinName, setJoinName]=useState('');
    const [joinLoading, setJoinLoading]=useState(false);
    const [joinContestInfo, setJoinContestInfo]=useState(null);

    // Create form
    const [form, setForm]=useState({title: '', topic: '', description: '', difficulty: 'medium', duration: 90});

    // Challenge builder
    const [challenges, setChallenges]=useState([]);
    const [genPanel, setGenPanel]=useState(false);
    const [genForm, setGenForm]=useState({topic: '', count: 3, difficulty: 'medium'});
    const [generating, setGenerating]=useState(false);
    const [savingC, setSavingC]=useState(false);

    // Manual challenge form
    const [cForm, setCForm]=useState({
        title: '', description: '', difficulty: 'medium', points: 100, timeLimit: 30,
        examples: [{input: '', output: '', explanation: ''}],
        constraints: [''],
        testCases: [{input: '', output: '', hidden: false}],
        hints: [''],
    });
    const [showCForm, setShowCForm]=useState(false);

    const flash=(msg, isError=false) =>
    {
        if (isError) setError(msg);
        else setSuccessMsg(msg);
        setTimeout(() => {setError(''); setSuccessMsg('');}, 4000);
    };

    const fetchContests=useCallback(async () =>
    {
        try
        {
            setLoading(true);
            const data=await apiFetch('/api/contest/my-contests');
            setContests(data.contests||[]);
        } catch (e)
        {
            flash(e.message, true);
        } finally {setLoading(false);}
    }, []);

    useEffect(() => {fetchContests();}, [fetchContests]);

    const fetchPublicContests=useCallback(async () =>
    {
        setBrowseLoading(true);
        try
        {
            const data=await apiFetch('/api/contest/browse');
            setPublicContests(data.contests||[]);
        } catch (e)
        {
            flash(e.message, true);
        } finally {setBrowseLoading(false);}
    }, []);

    useEffect(() =>
    {
        if (view==='browse') fetchPublicContests();
    }, [view, fetchPublicContests]);

    // Create contest
    const handleCreate=async (e) =>
    {
        e.preventDefault();
        if (!form.title.trim()||!form.topic.trim()) return flash('Title and topic are required', true);
        try
        {
            setLoading(true);
            const data=await apiFetch('/api/contest/create', {method: 'POST', body: JSON.stringify(form)});
            flash(`Contest "${data.contest.title}" created! Room code: ${data.contest.code}`);
            setSelectedContest(data.contest);
            setChallenges([]);
            setView('edit');
            fetchContests();
        } catch (e) {flash(e.message, true);}
        finally {setLoading(false);}
    };

    // AI generation
    const handleGenerate=async () =>
    {
        if (!genForm.topic.trim()) return flash('Enter a topic for generation', true);
        setGenerating(true);
        try
        {
            const data=await apiFetch('/api/contest/generate-challenges', {
                method: 'POST',
                body: JSON.stringify({...genForm, existingChallenges: challenges}),
            });
            setChallenges(prev => [...prev, ...data.challenges]);
            flash(`Generated ${data.challenges.length} challenges!`);
            setGenPanel(false);
        } catch (e) {flash(e.message, true);}
        finally {setGenerating(false);}
    };

    // Save challenges
    const saveChallenges=async (replace=false) =>
    {
        if (!selectedContest) return;
        if (challenges.length===0) return flash('No challenges to save', true);
        setSavingC(true);
        try
        {
            await apiFetch(`/api/contest/${selectedContest.id}/challenges`, {
                method: 'POST',
                body: JSON.stringify({challenges, replace}),
            });
            flash('Challenges saved!');
        } catch (e) {flash(e.message, true);}
        finally {setSavingC(false);}
    };

    // Remove challenge
    const removeChallenge=(idx) => setChallenges(prev => prev.filter((_, i) => i!==idx));

    // Add manual challenge
    const addManualChallenge=() =>
    {
        if (!cForm.title.trim()||!cForm.description.trim()) return flash('Title and description are required', true);
        if (cForm.testCases.length===0) return flash('Add at least one test case', true);
        setChallenges(prev => [...prev, {...cForm}]);
        setCForm({
            title: '', description: '', difficulty: 'medium', points: 100, timeLimit: 30,
            examples: [{input: '', output: '', explanation: ''}],
            constraints: [''],
            testCases: [{input: '', output: '', hidden: false}],
            hints: [''],
        });
        setShowCForm(false);
        flash('Challenge added!');
    };

    // Publish
    const handlePublish=async (contestId) =>
    {
        try
        {
            await apiFetch(`/api/contest/${contestId}/publish`, {method: 'POST'});
            flash('Contest published! Participants can now join.');
            fetchContests();
        } catch (e) {flash(e.message, true);}
    };

    // Delete
    const handleDelete=async (contestId) =>
    {
        if (!confirm('Delete this contest? This cannot be undone.')) return;
        try
        {
            await apiFetch(`/api/contest/${contestId}`, {method: 'DELETE'});
            flash('Contest deleted');
            fetchContests();
            if (view==='edit') setView('list');
        } catch (e) {flash(e.message, true);}
    };

    // Open for editing
    const openEdit=async (contest) =>
    {
        try
        {
            const data=await apiFetch(`/api/contest/${contest.id}`);
            setSelectedContest(data.contest);
            setChallenges(data.contest.challenges||[]);
            setView('edit');
        } catch (e) {flash(e.message, true);}
    };

    // Join handlers
    const handleJoinLookup=async (e) =>
    {
        e.preventDefault();
        if (!joinCode.trim()) return flash('Enter a room code', true);
        setJoinLoading(true);
        try
        {
            const res=await fetch(`${API_URL}/api/contest/room/${joinCode.trim().toUpperCase()}`, {credentials: 'include'});
            const data=await res.json();
            if (!data.success) throw new Error(data.error);
            setJoinContestInfo(data.contest);
        } catch (e) {flash(e.message, true);}
        finally {setJoinLoading(false);}
    };

    const handleJoinSubmit=(e) =>
    {
        e.preventDefault();
        if (!joinName.trim()) return flash('Enter your name', true);
        navigate(`/contest/play?code=${joinCode.trim().toUpperCase()}&name=${encodeURIComponent(joinName.trim())}`);
    };

    return (
        <div className="cdb-root">
            {/* Sidebar */}
            <aside className="cdb-sidebar">
                <div className="cdb-brand"><Code2 size={20} /> Contest Manager</div>
                <nav className="cdb-nav">
                    <button className={`cdb-nav-btn ${view==='list'? 'active':''}`} onClick={() => setView('list')}>
                        <Trophy size={16} /> My Contests
                    </button>
                    <button className={`cdb-nav-btn ${view==='create'? 'active':''}`} onClick={() => {setView('create'); setForm({title: '', topic: '', description: '', difficulty: 'medium', duration: 90});}}>
                        <Plus size={16} /> New Contest
                    </button>
                    <button className={`cdb-nav-btn ${view==='browse'? 'active':''}`} onClick={() => setView('browse')}>
                        <Globe size={16} /> Browse
                    </button>
                    <button className={`cdb-nav-btn ${view==='join'? 'active':''}`} onClick={() => {setView('join'); setJoinContestInfo(null);}}>
                        <Gamepad2 size={16} /> Join Contest
                    </button>
                </nav>
            </aside>

            {/* Main */}
            <main className="cdb-main">
                {(error||successMsg)&&(
                    <div className={`cdb-toast ${error? 'error':'success'}`}>{error||successMsg}</div>
                )}

                {/* LIST VIEW */}
                {view==='list'&&(
                    <div className="cdb-section">
                        <h2 className="cdb-heading">My Contests</h2>
                        {loading? <div className="cdb-spinner">Loading...</div>
                            :contests.length===0? (
                                <div className="cdb-empty">
                                    <Code2 size={48} />
                                    <p>No contests yet. Create your first one!</p>
                                    <button className="cdb-btn-primary" onClick={() => setView('create')}>Create Contest</button>
                                </div>
                            ):(
                                <div className="cdb-grid">
                                    {contests.map(c => (
                                        <div className="cdb-card" key={c.id}>
                                            <div className="cdb-card-header">
                                                <span className="cdb-code"># {c.code}</span>
                                                <span className={`cdb-status cdb-status-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                                            </div>
                                            <h3 className="cdb-card-title">{c.title}</h3>
                                            <p className="cdb-card-topic">{c.topic}</p>
                                            <div className="cdb-card-meta">
                                                <span style={{color: DIFFICULTY_COLORS[c.difficulty]}}><Zap size={12} /> {c.difficulty}</span>
                                                <span><Code2 size={12} /> {c.challengeCount} Problems</span>
                                                <span><Users size={12} /> {c.participantCount}</span>
                                                <span><Clock size={12} /> {c.duration}min</span>
                                            </div>
                                            <div className="cdb-card-actions">
                                                {c.status==='draft'&&(
                                                    <>
                                                        <button className="cdb-btn-sm" onClick={() => openEdit(c)}>Edit</button>
                                                        {c.challengeCount>0&&(
                                                            <button className="cdb-btn-sm cdb-btn-publish" onClick={() => handlePublish(c.id)}>Publish</button>
                                                        )}
                                                    </>
                                                )}
                                                {c.status==='waiting'&&(
                                                    <button className="cdb-btn-sm cdb-btn-start" onClick={() => navigate(`/contest/host/${c.id}`)}>Open Lobby</button>
                                                )}
                                                {c.status==='active'&&(
                                                    <button className="cdb-btn-sm cdb-btn-start" onClick={() => navigate(`/contest/host/${c.id}`)}>Rejoin Live</button>
                                                )}
                                                {c.status==='completed'&&(
                                                    <button className="cdb-btn-sm" onClick={() => navigate(`/contest/results/${c.id}`)}>Results</button>
                                                )}
                                                {c.status!=='active'&&(
                                                    <button className="cdb-btn-sm cdb-btn-delete" onClick={() => handleDelete(c.id)}><Trash2 size={12} /></button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>
                )}

                {/* BROWSE VIEW */}
                {view==='browse'&&(
                    <div className="cdb-section">
                        <div className="cdb-browse-header">
                            <h2 className="cdb-heading">Browse Contests</h2>
                            <button className="cdb-btn-secondary" onClick={fetchPublicContests} disabled={browseLoading}>
                                {browseLoading? 'Refreshing...':'Refresh'}
                            </button>
                        </div>
                        {browseLoading? <div className="cdb-spinner">Loading...</div>
                            :publicContests.length===0? (
                                <div className="cdb-empty">
                                    <Globe size={48} />
                                    <p>No active contests right now. Check back soon!</p>
                                    <button className="cdb-btn-primary" onClick={() => setView('join')}>Join by Code</button>
                                </div>
                            ):(
                                <div className="cdb-grid">
                                    {publicContests.map(c => (
                                        <div className="cdb-card" key={c.id}>
                                            <div className="cdb-card-header">
                                                <span className="cdb-code"># {c.code}</span>
                                                <span className={`cdb-status cdb-status-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                                            </div>
                                            <h3 className="cdb-card-title">{c.title}</h3>
                                            <p className="cdb-card-topic">{c.topic} by {c.hostName}</p>
                                            <div className="cdb-card-meta">
                                                <span style={{color: DIFFICULTY_COLORS[c.difficulty]}}><Zap size={12} /> {c.difficulty}</span>
                                                <span><Code2 size={12} /> {c.challengeCount}</span>
                                                <span><Users size={12} /> {c.participantCount}</span>
                                            </div>
                                            <button className="cdb-btn-primary cdb-btn-full" onClick={() => {setJoinCode(c.code); setView('join');}}>
                                                Join Contest <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>
                )}

                {/* JOIN VIEW */}
                {view==='join'&&(
                    <div className="cdb-section cdb-join-section">
                        <h2 className="cdb-heading">Join a Contest</h2>
                        <div className="cdb-join-card">
                            {!joinContestInfo? (
                                <form onSubmit={handleJoinLookup}>
                                    <label className="cdb-label">Room Code</label>
                                    <input
                                        className="cdb-input cdb-input-code"
                                        placeholder="ABCD12"
                                        value={joinCode}
                                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                        maxLength={6}
                                    />
                                    <button className="cdb-btn-primary cdb-btn-full" disabled={joinLoading}>
                                        {joinLoading? 'Looking up...':'Find Contest'}
                                    </button>
                                </form>
                            ):(
                                <form onSubmit={handleJoinSubmit}>
                                    <div className="cdb-join-info">
                                        <h3>{joinContestInfo.title}</h3>
                                        <p>{joinContestInfo.topic} | {joinContestInfo.challengeCount} problems</p>
                                        <p>Hosted by {joinContestInfo.hostName}</p>
                                    </div>
                                    <label className="cdb-label">Your Name</label>
                                    <input
                                        className="cdb-input"
                                        placeholder="Enter your name"
                                        value={joinName}
                                        onChange={e => setJoinName(e.target.value)}
                                        maxLength={30}
                                    />
                                    <button className="cdb-btn-primary cdb-btn-full">Join Contest</button>
                                    <button type="button" className="cdb-btn-secondary cdb-btn-full" onClick={() => setJoinContestInfo(null)}>
                                        Back
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* CREATE VIEW */}
                {view==='create'&&(
                    <div className="cdb-section">
                        <h2 className="cdb-heading">Create New Contest</h2>
                        <form className="cdb-form" onSubmit={handleCreate}>
                            <label className="cdb-label">Title</label>
                            <input className="cdb-input" placeholder="Contest title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />

                            <label className="cdb-label">Topic</label>
                            <input className="cdb-input" placeholder="e.g., Data Structures, Algorithms" value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} />

                            <label className="cdb-label">Description (optional)</label>
                            <textarea className="cdb-textarea" placeholder="Contest description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />

                            <div className="cdb-form-row">
                                <div>
                                    <label className="cdb-label">Difficulty</label>
                                    <select className="cdb-select" value={form.difficulty} onChange={e => setForm({...form, difficulty: e.target.value})}>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="cdb-label">Duration (minutes)</label>
                                    <input type="number" className="cdb-input" value={form.duration} onChange={e => setForm({...form, duration: Number(e.target.value)})} min={15} max={480} />
                                </div>
                            </div>

                            <button className="cdb-btn-primary" disabled={loading}>{loading? 'Creating...':'Create Contest'}</button>
                        </form>
                    </div>
                )}

                {/* EDIT VIEW */}
                {view==='edit'&&selectedContest&&(
                    <div className="cdb-section">
                        <div className="cdb-edit-header">
                            <div>
                                <h2 className="cdb-heading">{selectedContest.title}</h2>
                                <p className="cdb-code-large"># {selectedContest.code}</p>
                            </div>
                            <div className="cdb-edit-actions">
                                <button className="cdb-btn-secondary" onClick={() => setView('list')}>Back</button>
                                <button className="cdb-btn-primary" onClick={() => saveChallenges(true)} disabled={savingC||challenges.length===0}>
                                    {savingC? 'Saving...':'Save Challenges'}
                                </button>
                            </div>
                        </div>

                        {/* AI Generation */}
                        <div className="cdb-gen-section">
                            <button className="cdb-btn-gen" onClick={() => setGenPanel(!genPanel)}>
                                <Sparkles size={16} /> AI Generate Challenges
                            </button>
                            {genPanel&&(
                                <div className="cdb-gen-panel">
                                    <input className="cdb-input" placeholder="Topic for challenges" value={genForm.topic} onChange={e => setGenForm({...genForm, topic: e.target.value})} />
                                    <div className="cdb-gen-row">
                                        <select className="cdb-select" value={genForm.count} onChange={e => setGenForm({...genForm, count: Number(e.target.value)})}>
                                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} challenges</option>)}
                                        </select>
                                        <select className="cdb-select" value={genForm.difficulty} onChange={e => setGenForm({...genForm, difficulty: e.target.value})}>
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                        <button className="cdb-btn-primary" onClick={handleGenerate} disabled={generating}>
                                            {generating? 'Generating...':'Generate'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Manual Challenge Form */}
                        <button className="cdb-btn-secondary cdb-btn-add-manual" onClick={() => setShowCForm(!showCForm)}>
                            <Plus size={16} /> Add Manual Challenge
                        </button>

                        {showCForm&&(
                            <div className="cdb-manual-form">
                                <h4>New Challenge</h4>
                                <input className="cdb-input" placeholder="Title" value={cForm.title} onChange={e => setCForm({...cForm, title: e.target.value})} />
                                <textarea className="cdb-textarea" placeholder="Problem description..." value={cForm.description} onChange={e => setCForm({...cForm, description: e.target.value})} rows={4} />

                                <div className="cdb-form-row">
                                    <select className="cdb-select" value={cForm.difficulty} onChange={e => setCForm({...cForm, difficulty: e.target.value})}>
                                        <option value="easy">Easy (100pts)</option>
                                        <option value="medium">Medium (150pts)</option>
                                        <option value="hard">Hard (200pts)</option>
                                    </select>
                                    <input type="number" className="cdb-input" placeholder="Points" value={cForm.points} onChange={e => setCForm({...cForm, points: Number(e.target.value)})} />
                                </div>

                                <label className="cdb-label">Test Cases</label>
                                {cForm.testCases.map((tc, i) => (
                                    <div key={i} className="cdb-tc-row">
                                        <input className="cdb-input" placeholder="Input" value={tc.input} onChange={e =>
                                        {
                                            const tcs=[...cForm.testCases];
                                            tcs[i].input=e.target.value;
                                            setCForm({...cForm, testCases: tcs});
                                        }} />
                                        <input className="cdb-input" placeholder="Expected Output" value={tc.output} onChange={e =>
                                        {
                                            const tcs=[...cForm.testCases];
                                            tcs[i].output=e.target.value;
                                            setCForm({...cForm, testCases: tcs});
                                        }} />
                                        <label className="cdb-checkbox">
                                            <input type="checkbox" checked={tc.hidden} onChange={e =>
                                            {
                                                const tcs=[...cForm.testCases];
                                                tcs[i].hidden=e.target.checked;
                                                setCForm({...cForm, testCases: tcs});
                                            }} />
                                            <EyeOff size={14} /> Hidden
                                        </label>
                                        {cForm.testCases.length>1&&(
                                            <button className="cdb-btn-icon" onClick={() =>
                                            {
                                                setCForm({...cForm, testCases: cForm.testCases.filter((_, j) => j!==i)});
                                            }}><Trash2 size={14} /></button>
                                        )}
                                    </div>
                                ))}
                                <button className="cdb-btn-sm" onClick={() => setCForm({...cForm, testCases: [...cForm.testCases, {input: '', output: '', hidden: false}]})}>
                                    + Add Test Case
                                </button>

                                <div className="cdb-manual-actions">
                                    <button className="cdb-btn-secondary" onClick={() => setShowCForm(false)}>Cancel</button>
                                    <button className="cdb-btn-primary" onClick={addManualChallenge}>Add Challenge</button>
                                </div>
                            </div>
                        )}

                        {/* Challenges List */}
                        <div className="cdb-challenges-list">
                            <h3>Challenges ({challenges.length})</h3>
                            {challenges.length===0? (
                                <p className="cdb-empty-hint">No challenges yet. Generate with AI or add manually.</p>
                            ):(
                                challenges.map((c, i) => (
                                    <div key={i} className="cdb-challenge-item">
                                        <div className="cdb-challenge-header">
                                            <span className="cdb-challenge-num">#{i+1}</span>
                                            <span className="cdb-challenge-title">{c.title}</span>
                                            <span className={`cdb-difficulty cdb-difficulty-${c.difficulty}`}>{c.difficulty}</span>
                                            <span className="cdb-points">{c.points}pts</span>
                                            <button className="cdb-btn-icon cdb-btn-delete" onClick={() => removeChallenge(i)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <p className="cdb-challenge-desc">{c.description?.slice(0, 150)}...</p>
                                        <div className="cdb-challenge-meta">
                                            <span><Eye size={12} /> {c.testCases?.filter(t => !t.hidden).length||0} visible</span>
                                            <span><EyeOff size={12} /> {c.testCases?.filter(t => t.hidden).length||0} hidden</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

