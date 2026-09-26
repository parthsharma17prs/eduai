import {useState, useEffect, useCallback} from 'react';
import {io} from 'socket.io-client';
import {API_BASE_URL} from '../services/api';
import './ProctorDashboard.css';

const API_URL = API_BASE_URL;
const SOCKET_URL = API_BASE_URL;

function ProctorDashboard()
{
    const [sessions, setSessions]=useState([]);
    const [selectedSession, setSelectedSession]=useState(null);
    const [socket, setSocket]=useState(null);
    const [filterStatus, setFilterStatus]=useState('all'); // all, risk, warning, good
    const [sortBy, setSortBy]=useState('score'); // score, time, events
    const [searchTerm, setSearchTerm]=useState('');
    const [stats, setStats]=useState({
        total: 0,
        risk: 0,
        warning: 0,
        good: 0,
        totalViolations: 0,
    });

    // Fetch sessions
    const fetchSessions=useCallback(async () =>
    {
        try
        {
            const response=await fetch(`${API_URL}/api/proctoring/dashboard/sessions`);
            const data=await response.json();
            setSessions(data);

            // Calculate stats
            const stats={
                total: data.length,
                risk: data.filter(s => s.integrityScore<60).length,
                warning: data.filter(s => s.integrityScore>=60&&s.integrityScore<80).length,
                good: data.filter(s => s.integrityScore>=80).length,
                totalViolations: data.reduce((sum, s) => sum+s.totalEvents, 0),
            };
            setStats(stats);
        } catch (error)
        {
            console.error('Error fetching sessions:', error);
        }
    }, []);

    // Initialize socket connection
    useEffect(() =>
    {
        const newSocket=io(SOCKET_URL);
        setSocket(newSocket);

        // Join proctor dashboard room
        newSocket.emit('join-proctor-dashboard');

        // Listen for real-time updates
        newSocket.on('proctoring-alert', (data) =>
        {
            console.log('Proctoring alert received:', data);
            // Refresh sessions on new alert
            fetchSessions();
        });

        newSocket.on('session-update', (data) =>
        {
            console.log('Session update:', data);
            fetchSessions();
        });

        return () => newSocket.close();
    }, [fetchSessions]);

    // Fetch sessions on mount and refresh periodically
    useEffect(() =>
    {
        fetchSessions();
        const interval=setInterval(fetchSessions, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, [fetchSessions]);

    const getScoreColor=(score) =>
    {
        if (score>=80) return '#10b981';
        if (score>=60) return '#f59e0b';
        return '#ef4444';
    };

    const getScoreStatus=(score) =>
    {
        if (score>=80) return {text: 'Good', color: '#10b981'};
        if (score>=60) return {text: 'Warning', color: '#f59e0b'};
        return {text: 'Risk', color: '#ef4444'};
    };

    const formatDuration=(minutes) =>
    {
        const hours=Math.floor(minutes/60);
        const mins=minutes%60;
        if (hours>0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const getSeverityBadge=(severity) =>
    {
        const colors={
            low: '#60a5fa',
            medium: '#f59e0b',
            high: '#ef4444',
            critical: '#dc2626',
        };
        return colors[severity]||'#64748b';
    };

    const formatEventType=(eventType) =>
    {
        const typeMap={
            'no_face': 'No Face',
            'multiple_faces': 'Multiple Faces',
            'looking_away': 'Looking Away',
            'eyes_closed': 'Eyes Closed',
            'window_blur': 'Focus Lost',
            'tab_switch': 'Tab Switch',
            'fullscreen_exit': 'Fullscreen Exit',
            'copy_paste_attempt': 'Copy/Paste',
            'ai_generated_code': 'AI Code',
            'large_paste': 'Large Paste',
            'suspicious_typing': 'Suspicious Typing',
            'auto_terminate': 'Terminated',
        };
        return typeMap[eventType]||eventType;
    };

    // Filter and sort sessions
    const filteredSessions=sessions
        .filter(session =>
        {
            // Filter by status
            if (filterStatus==='risk'&&session.integrityScore>=60) return false;
            if (filterStatus==='warning'&&(session.integrityScore<60||session.integrityScore>=80)) return false;
            if (filterStatus==='good'&&session.integrityScore<80) return false;

            // Filter by search term
            if (searchTerm)
            {
                const term=searchTerm.toLowerCase();
                return session.candidateName?.toLowerCase().includes(term)||
                    session.candidateEmail?.toLowerCase().includes(term)||
                    session.interviewId?.toLowerCase().includes(term);
            }

            return true;
        })
        .sort((a, b) =>
        {
            if (sortBy==='score') return a.integrityScore-b.integrityScore;
            if (sortBy==='time') return new Date(b.startTime)-new Date(a.startTime);
            if (sortBy==='events') return b.totalEvents-a.totalEvents;
            return 0;
        });

    return (
        <div className="proctor-dashboard">
            <div className="dashboard-header">
                <div className="header-content">
                    <h1>Proctor Dashboard</h1>
                    <p>Real-time monitoring of all active interview sessions</p>
                </div>
                <div className="header-actions">
                    <div className="live-indicator">
                        <span className="pulse"></span>
                        LIVE
                    </div>
                    <button className="refresh-btn" onClick={fetchSessions}>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Statistics Overview */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon"><span style={{display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-primary)'}} /></div>
                    <div className="stat-content">
                        <div className="stat-label">Active Sessions</div>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                </div>
                <div className="stat-card good">
                    <div className="stat-icon"><span style={{display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: '#10b981'}} /></div>
                    <div className="stat-content">
                        <div className="stat-label">Good Standing</div>
                        <div className="stat-value">{stats.good}</div>
                    </div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-icon"><span style={{display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: '#f59e0b'}} /></div>
                    <div className="stat-content">
                        <div className="stat-label">Warnings</div>
                        <div className="stat-value">{stats.warning}</div>
                    </div>
                </div>
                <div className="stat-card risk">
                    <div className="stat-icon"><span style={{display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444'}} /></div>
                    <div className="stat-content">
                        <div className="stat-label">High Risk</div>
                        <div className="stat-value">{stats.risk}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><span style={{display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444'}} /></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Violations</div>
                        <div className="stat-value">{stats.totalViolations}</div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="dashboard-controls">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search by name, email, or session ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-buttons">
                    <button
                        className={filterStatus==='all'? 'active':''}
                        onClick={() => setFilterStatus('all')}
                    >
                        All
                    </button>
                    <button
                        className={filterStatus==='risk'? 'active risk':''}
                        onClick={() => setFilterStatus('risk')}
                    >
                        Risk
                    </button>
                    <button
                        className={filterStatus==='warning'? 'active warning':''}
                        onClick={() => setFilterStatus('warning')}
                    >
                        Warning
                    </button>
                    <button
                        className={filterStatus==='good'? 'active good':''}
                        onClick={() => setFilterStatus('good')}
                    >
                        Good
                    </button>
                </div>
                <div className="sort-buttons">
                    <label>Sort by:</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="score">Integrity Score</option>
                        <option value="time">Start Time</option>
                        <option value="events">Event Count</option>
                    </select>
                </div>
            </div>

            {/* Sessions Grid */}
            {filteredSessions.length===0? (
                <div className="no-sessions">
                    <div className="no-sessions-icon"><span style={{display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', border: '3px solid var(--accent-primary)'}} /></div>
                    <h3>No active sessions</h3>
                    <p>Sessions will appear here when interviews are in progress</p>
                </div>
            ):(
                <div className="sessions-grid">
                    {filteredSessions.map(session =>
                    {
                        const status=getScoreStatus(session.integrityScore);
                        return (
                            <div
                                key={session.interviewId}
                                className={`session-card ${selectedSession===session.interviewId? 'selected':''}`}
                                onClick={() => setSelectedSession(
                                    selectedSession===session.interviewId? null:session.interviewId
                                )}
                            >
                                <div className="session-header">
                                    <div className="session-info">
                                        <div className="candidate-avatar">
                                            {session.candidateName?.charAt(0).toUpperCase()||'?'}
                                        </div>
                                        <div className="candidate-details">
                                            <h3>{session.candidateName||'Unknown Candidate'}</h3>
                                            <p>{session.candidateEmail||'No email'}</p>
                                        </div>
                                    </div>
                                    <div className="session-status" style={{color: status.color}}>
                                        <span style={{display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: status.color}} />
                                        <span>{status.text}</span>
                                    </div>
                                </div>

                                <div className="session-metrics">
                                    <div className="metric">
                                        <div className="metric-label">Integrity Score</div>
                                        <div
                                            className="metric-value"
                                            style={{color: getScoreColor(session.integrityScore)}}
                                        >
                                            {session.integrityScore}/100
                                        </div>
                                    </div>
                                    <div className="metric">
                                        <div className="metric-label">Duration</div>
                                        <div className="metric-value">
                                            {formatDuration(session.duration)}
                                        </div>
                                    </div>
                                    <div className="metric">
                                        <div className="metric-label">Events</div>
                                        <div className="metric-value">{session.totalEvents}</div>
                                    </div>
                                </div>

                                <div className="violations-summary">
                                    {session.violations.critical>0&&(
                                        <span className="violation-badge critical">
                                            {session.violations.critical} Critical
                                        </span>
                                    )}
                                    {session.violations.high>0&&(
                                        <span className="violation-badge high">
                                            {session.violations.high} High
                                        </span>
                                    )}
                                    {session.violations.medium>0&&(
                                        <span className="violation-badge medium">
                                            {session.violations.medium} Medium
                                        </span>
                                    )}
                                    {session.violations.low>0&&(
                                        <span className="violation-badge low">
                                            {session.violations.low} Low
                                        </span>
                                    )}
                                    {session.totalEvents===0&&(
                                        <span className="no-violations">✓ No violations</span>
                                    )}
                                </div>

                                {selectedSession===session.interviewId&&(
                                    <div className="session-details">
                                        <div className="details-header">
                                            <h4>Recent Events</h4>
                                        </div>
                                        <div className="recent-events">
                                            {session.recentEvents&&session.recentEvents.length>0? (
                                                session.recentEvents.slice().reverse().map((event, index) => (
                                                    <div key={index} className="event-item">
                                                        <div
                                                            className="event-severity"
                                                            style={{
                                                                background: getSeverityBadge(event.severity)
                                                            }}
                                                        />
                                                        <div className="event-content">
                                                            <div className="event-type">
                                                                {formatEventType(event.eventType)}
                                                            </div>
                                                            <div className="event-time">
                                                                {new Date(event.timestamp).toLocaleTimeString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ):(
                                                <div className="no-events-detail">No events recorded</div>
                                            )}
                                        </div>
                                        <div className="session-actions">
                                            <button className="view-full-btn">
                                                View Full Report
                                            </button>
                                            <button className="join-session-btn">
                                                Join Session
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ProctorDashboard;
