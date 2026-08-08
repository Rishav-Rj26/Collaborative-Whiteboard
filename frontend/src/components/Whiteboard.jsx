import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Canvas from './Canvas';
import ConfirmModal from './ConfirmModal';
import { ArrowLeft, Share2, Check, Download, MessageSquare, X, Send } from 'lucide-react';
import { SOCKET_URL, API_URL } from '../config';
import { stringToColor } from '../hooks/useCanvasSocket';

export default function Whiteboard() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Roles and Pages
  const [role, setRole] = useState('viewer');
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [historySnapshots, setHistorySnapshots] = useState([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState({ open: false, snapshotId: null });

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const chatOpenRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    const newSocket = io(SOCKET_URL, { auth: { token } });
    setSocket(newSocket);
    newSocket.on('connect', () => newSocket.emit('join-board', boardId));
    newSocket.on('active-users', (users) => setActiveUsers(users));
    newSocket.on('role', (r) => setRole(r));
    newSocket.on('board-pages', (p) => {
      setPages(p);
      setActivePageId(current => current || p[0]?.id || null);
    });
    newSocket.on('page-added', (p) => setPages(prev => [...prev, p]));
    newSocket.on('page-deleted', (pid) => {
      setPages(prev => prev.filter(p => p.id !== pid));
      setActivePageId(current => current === pid ? null : current);
    });
    newSocket.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (!chatOpenRef.current) setUnreadCount(prev => prev + 1);
    });
    return () => newSocket.disconnect();
  }, [boardId, token]);

  // Ensure activePageId is valid if pages load later
  useEffect(() => {
    if (pages.length > 0 && (!activePageId || !pages.find(p => p.id === activePageId))) {
      setActivePageId(pages[0].id);
    }
  }, [pages, activePageId]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/boards/${boardId}/snapshots`, { headers: { 'Authorization': `Bearer ${token}` } });
      if(res.ok) {
         const data = await res.json();
         setHistorySnapshots(data.snapshots);
      }
    } catch (err) {
      toast.error('Failed to load history');
    }
  };

  const executeRestore = async (snapshotId) => {
    try {
      await fetch(`${API_URL}/boards/${boardId}/snapshots/${snapshotId}/restore`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      setShowHistory(false);
      setConfirmModal({ open: false, snapshotId: null });
      toast.success('Version restored');
    } catch (err) {
      toast.error('Failed to restore version');
      setConfirmModal({ open: false, snapshotId: null });
    }
  };

  const restoreSnapshot = (snapshotId) => {
    setConfirmModal({ open: true, snapshotId });
  };

  const saveSnapshot = async () => {
    try {
      await fetch(`${API_URL}/boards/${boardId}/snapshots`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      toast.success('Version saved');
      loadHistory();
    } catch (err) {
      toast.error('Failed to save version');
    }
  };

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
      toast.info('Board ID copied to clipboard');
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
      <ConfirmModal
        open={confirmModal.open}
        title="Restore Version"
        message="Are you sure you want to restore this version? Current unsaved changes will be permanently lost."
        confirmLabel="Restore"
        variant="danger"
        onConfirm={() => executeRestore(confirmModal.snapshotId)}
        onCancel={() => setConfirmModal({ open: false, snapshotId: null })}
      />

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

        {/* Right Controls */}
        <div className="bg-surface border border-outline-variant rounded-xl p-1 shadow-xl flex items-center gap-1 md:gap-3 pointer-events-auto">
          <div className="hidden md:flex items-center gap-2 mr-4">
            {activeUsers.slice(0, 3).map((u, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-bold text-white shadow-level-2" style={{ backgroundColor: stringToColor(u.name), marginLeft: i > 0 ? -12 : 0 }} title={u.name}>
                {u.name.substring(0, 2).toUpperCase()}
              </div>
            ))}
            {activeUsers.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container flex items-center justify-center text-[10px] font-bold text-on-surface-variant shadow-level-2" style={{ marginLeft: -12 }}>
                +{activeUsers.length - 3}
              </div>
            )}
          </div>

          <button onClick={() => { setShowHistory(true); loadHistory(); }} className="flex items-center gap-2 px-2 py-2 md:px-3 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors rounded-lg">
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span className="hidden md:inline">History</span>
          </button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('export-canvas', { detail: { format: 'png' } }))} className="flex items-center gap-2 px-2 py-2 md:px-3 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors rounded-lg">
            <Download size={16} />
            <span className="hidden md:inline">Export</span>
          </button>
          
          <button onClick={() => setIsChatOpen(!isChatOpen)} className="relative flex items-center gap-2 px-2 py-2 md:px-3 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors rounded-lg">
            <MessageSquare size={16} />
            <span className="hidden md:inline">Chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface"></span>
            )}
          </button>

          <div className="w-[1px] h-4 bg-outline-variant mx-1 md:mx-2"></div>
          <button onClick={handleShare} className="flex items-center gap-2 px-2 py-2 md:px-4 md:py-2 text-sm font-bold bg-primary text-on-primary rounded-lg shadow-level-2 hover:bg-primary/90 transition-all">
            <Share2 size={16} />
            <span className="hidden md:inline">Share</span>
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50 pointer-events-none">
        <div className="bg-surface border border-outline-variant rounded-xl shadow-lg flex items-center pointer-events-auto overflow-hidden">
          {pages.map((p) => (
             <button key={p.id} onClick={() => setActivePageId(p.id)} className={`px-4 py-2 text-sm transition-colors border-r border-outline-variant ${activePageId === p.id ? 'bg-primary/20 text-primary font-medium' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}>
               {p.title}
             </button>
          ))}
          {role !== 'viewer' && (
            <button onClick={() => {
              const title = window.prompt("New page title:", `Page ${pages.length + 1}`);
              if (title && socket) socket.emit('add-page', { boardId, title, orderIndex: pages.length });
            }} className="px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface flex items-center">
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="absolute inset-0 bg-black/60 z-[100] flex items-center justify-center pointer-events-auto">
          <div className="bg-surface rounded-xl border border-outline-variant p-6 w-[400px] shadow-level-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-on-surface">Board History</h2>
              <button onClick={() => setShowHistory(false)} className="text-on-surface-variant hover:text-on-surface"><X size={20}/></button>
            </div>
            <button onClick={saveSnapshot} className="w-full mb-4 bg-primary text-on-primary py-2 rounded-lg font-medium hover:bg-primary-container transition-colors">
              Save Version Now
            </button>
            <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2">
              {historySnapshots.map(snap => (
                <div key={snap.id} className="flex justify-between items-center p-3 bg-surface-container rounded-lg">
                  <span className="text-sm text-on-surface">{new Date(snap.created_at).toLocaleString()}</span>
                  <button onClick={() => restoreSnapshot(snap.id)} className="text-sm text-primary hover:underline">Restore</button>
                </div>
              ))}
              {historySnapshots.length === 0 && <p className="text-sm text-on-surface-variant text-center my-4">No saved versions yet.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex-grow flex relative w-full h-full overflow-hidden">
        <div className="flex-grow relative h-full">
          {socket ? (
            <Canvas socket={socket} boardId={boardId} role={role} activePageId={activePageId} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface-variant canvas-grid-bg">
              Connecting...
            </div>
          )}
        </div>

      {/* Right Sidebar Drawer: Chat */}
      <div className={`fixed inset-y-0 right-0 z-50 md:relative md:z-auto w-full md:w-80 bg-surface-container-low border-l border-outline-variant flex flex-col transform transition-transform duration-300 ease-in-out ${isChatOpen ? 'translate-x-0' : 'translate-x-full md:hidden md:w-0'}`}>
        <div className="h-14 border-b border-outline-variant flex items-center justify-between px-4 shrink-0 glass-panel">
          <div className="flex items-center gap-2 text-on-surface font-semibold">
            <MessageSquare size={16} className="text-primary" />
            Team Chat
          </div>
          <button onClick={() => setIsChatOpen(false)} className="text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 p-1.5 rounded-lg transition-colors">
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
      </div>
    </div>
  );
}
