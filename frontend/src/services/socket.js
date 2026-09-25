import {io} from 'socket.io-client';
import {authService} from './authService.js';

const SOCKET_URL=import.meta.env.VITE_API_URL||'http://localhost:5001';

class SocketService
{
    constructor()
    {
        this.socket=null;
    }

    connect()
    {
        if (!this.socket)
        {
            this.socket=io(SOCKET_URL, {
                withCredentials: true,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
            });

            this.socket.on('connect', () =>
            {
                console.log('Socket connected:', this.socket.id);
            });

            this.socket.on('disconnect', (reason) =>
            {
                console.log('Socket disconnected:', reason);
            });

            this.socket.on('connect_error', (error) =>
            {
                console.error('Socket connection error:', error.message);
            });

            this.socket.on('reconnect', (attempt) =>
            {
                console.log('Socket reconnected after', attempt, 'attempts');
            });
        }
        return this.socket;
    }

    disconnect()
    {
        if (this.socket)
        {
            this.socket.disconnect();
            this.socket=null;
        }
    }

    getSocket()
    {
        return this.socket;
    }

    joinInterview(interviewId, userName, role)
    {
        if (this.socket)
        {
            this.socket.emit('join-interview', {interviewId, userName, role});
        }
    }

    leaveInterview(interviewId)
    {
        if (this.socket)
        {
            this.socket.emit('leave-interview', {interviewId});
        }
    }

    sendCodeUpdate(interviewId, code, language)
    {
        if (this.socket)
        {
            this.socket.emit('code-update', {interviewId, code, language});
        }
    }

    sendLanguageUpdate(interviewId, language, code)
    {
        if (this.socket)
        {
            this.socket.emit('language-update', {interviewId, language, code});
        }
    }

    sendOutputUpdate(interviewId, output)
    {
        if (this.socket)
        {
            this.socket.emit('output-update', {interviewId, output});
        }
    }

    sendChatMessage(interviewId, message, userName)
    {
        if (this.socket)
        {
            this.socket.emit('chat-message', {interviewId, message, userName});
        }
    }

    sendProctoringEvent(interviewId, event)
    {
        if (this.socket)
        {
            this.socket.emit('proctoring-event', {interviewId, event});
        }
    }

    // Secondary camera methods
    registerSecondaryCamera(interviewId, code)
    {
        if (this.socket)
        {
            this.socket.emit('register-secondary-camera', {interviewId, code});
        }
    }

    connectSecondaryCamera(code, status)
    {
        if (this.socket)
        {
            this.socket.emit('connect-secondary-camera', {code, status});
        }
    }

    sendSecondarySnapshot(code, snapshot)
    {
        if (this.socket)
        {
            this.socket.emit('secondary-snapshot', {code, snapshot});
        }
    }

    // WebRTC signaling
    sendOffer(offer, to)
    {
        if (this.socket)
        {
            this.socket.emit('webrtc-offer', {offer, to});
        }
    }

    sendAnswer(answer, to)
    {
        if (this.socket)
        {
            this.socket.emit('webrtc-answer', {answer, to});
        }
    }

    sendIceCandidate(candidate, to)
    {
        if (this.socket)
        {
            this.socket.emit('webrtc-ice-candidate', {candidate, to});
        }
    }

    on(event, callback)
    {
        if (this.socket)
        {
            this.socket.on(event, callback);
        }
    }

    off(event, callback)
    {
        if (this.socket)
        {
            this.socket.off(event, callback);
        }
    }
}

export default new SocketService();
