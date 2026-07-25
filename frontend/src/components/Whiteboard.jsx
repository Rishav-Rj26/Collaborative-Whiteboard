import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import Canvas from './Canvas';
import { ArrowLeft, Share2, Check, Download, MessageSquare, X, Send } from 'lucide-react';

const SOCKET_SERVER_URL = 'http://localhost:3001';

export default function Whiteboard() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [copied, setCopied] = useState(false);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const chatOpenRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    const newSocket = io(SOCKET_SERVER_URL, { auth: { token } });
    setSocket(newSocket);
    newSocket.on('connect', () => newSocket.emit('join-board', boardId));
    newSocket.on('active-users', (users) => setActiveUsers(users));
    newSocket.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (!chatOpenRef.current) setUnreadCount(prev => prev + 1);
    });
    return () => newSocket.disconnect();
  }, [boardId, token]);

  useEffect(() => {
    chatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isChatOpen, messages]);

  const handleShare = () => {
    navigator.clipboard.writeText(boardId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      socket.emit('chat-message', { boardId, text: chatInput.trim() });
      setChatInput('');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden relative">
      {/* Floating Top Bar — Obsidian style */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
        {/* Left: Logo + Title + Undo/Redo */}
        <div className="bg-surface border border-outline-variant rounded-xl p-1 shadow-xl flex items-center gap-1 pointer-events-auto">
          <button onClick={() => navigate('/')} className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors" title="Back to Dashboard">
            <ArrowLeft size={18} />
          </button>
          <div className="w-px h-6 bg-outline-variant mx-1"></div>
          <button onClick={handleShare} className="flex items-center gap-1 hover:bg-surface-container-low px-2 py-1 rounded transition-colors" title="Copy Board ID">
            <span className="text-title text-on-surface text-sm truncate max-w-[200px]">
              {boardId.substring(0, 8)}...
            </span>
            <svg className="w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
          </button>
        </div>

        {/* Right: Avatars + Share + Chat */}
        <div className="bg-surface border border-outline-variant rounded-xl p-1 shadow-xl flex items-center gap-2 pointer-events-auto">
          {/* Avatars */}
          <div className="flex items-center -space-x-2 ml-2">
            {activeUsers.slice(0, 4).map((u, i) => (
              <div
                key={u.id} title={u.name}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-surface relative hover:z-20 transition-transform hover:scale-110"
                style={{ backgroundColor: `hsl(${(i * 137.5 + 270) % 360}, 60%, 55%)`, zIndex: 10 - i }}
              >
                {u.name.substring(0, 2).toUpperCase()}
              </div>
            ))}
            {activeUsers.length > 4 && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-container-highest text-on-surface-variant border-2 border-surface z-0">
                +{activeUsers.length - 4}
              </div>
            )}
          </div>

          <button
            onClick={handleShare}
            className="bg-primary text-on-primary text-sm font-medium px-4 h-10 rounded-lg hover:bg-primary-container transition-colors flex items-center gap-2 shadow-level-2"
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>

      {/* Bottom Right Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 z-50 pointer-events-none">
        <button
          onClick={() => window.dispatchEvent(new Event('export-canvas'))}
          className="bg-surface-container border border-outline-variant rounded-lg w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shadow-lg pointer-events-auto"
          title="Export PNG"
        >
          <Download size={18} />
        </button>
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`relative border border-outline-variant rounded-lg w-10 h-10 flex items-center justify-center transition-colors shadow-lg pointer-events-auto ${isChatOpen ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
          title="Chat"
        >
          <MessageSquare size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Canvas */}
      <div className="flex-grow flex relative w-full h-full overflow-hidden">
        <div className="flex-grow relative h-full">
          {socket ? (
            <Canvas socket={socket} boardId={boardId} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface-variant canvas-grid-bg">
              Connecting...
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {isChatOpen && (
          <div className="w-80 h-full bg-surface border-l border-outline-variant flex flex-col shadow-level-3 z-30">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center">
              <h2 className="text-title text-on-surface text-sm flex items-center gap-2">
                <MessageSquare size={16}/> Chat
              </h2>
              <button onClick={() => setIsChatOpen(false)} className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-variant/40 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="text-center text-on-surface-variant text-sm mt-10 opacity-60">No messages yet.</div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col">
                    <span className="text-label text-on-surface-variant/70 mb-0.5 ml-1">{msg.name}</span>
                    <div className="bg-surface-container rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-on-surface break-words">
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-3 border-t border-outline-variant flex gap-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message..."
                className="flex-grow bg-surface-container border border-outline-variant rounded-full px-4 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-on-surface-variant" />
              <button type="submit" disabled={!chatInput.trim()} className="bg-primary text-on-primary p-2 rounded-full hover:bg-primary-container disabled:opacity-40 transition-all">
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
