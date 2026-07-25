import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Canvas from './Canvas';
import { ArrowLeft, Share2, Check, Download, MessageSquare, X, Send } from 'lucide-react';

const SOCKET_SERVER_URL = 'http://localhost:3001';

export default function Whiteboard() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  
  // To track our own ID for message styling
  const [myUserId, setMyUserId] = useState(null);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-board', boardId);
    });

    newSocket.on('active-users', (users) => {
      setActiveUsers(users);
      // Hacky way to find our own ID since we don't get it back directly in this dummy setup
      // In a real app we'd have the JWT / user context globally
      if (!myUserId && newSocket.id) {
        // Find user by socket connection? Actually dummy auth creates a new ID per connection.
      }
    });
    
    newSocket.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      setUnreadCount(prev => {
         // Hack to access current state of isChatOpen
         return window.isChatOpenGlobal ? prev : prev + 1;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [boardId]);

  // Handle unread hack
  useEffect(() => {
    window.isChatOpenGlobal = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isChatOpen, messages]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
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
      {/* Toolbar / Header */}
      <div className="h-14 bg-surface border-b border-outline/20 flex items-center justify-between px-4 shadow-level-1 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-background rounded-md text-on-surface transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="font-semibold text-lg text-on-surface flex items-center gap-2">
            Board: <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded text-sm">{boardId}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Active Users Avatar Stack */}
          <div className="flex items-center -space-x-2">
            {activeUsers.slice(0, 5).map((user, i) => (
              <div 
                key={user.id} 
                title={user.name}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-on-primary border-2 border-surface relative z-10 hover:z-20 transition-transform hover:scale-110"
                style={{ backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, 50%)` }}
              >
                {user.name.substring(0, 2).toUpperCase()}
              </div>
            ))}
            {activeUsers.length > 5 && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-surface-dim text-on-surface border-2 border-surface relative z-0">
                +{activeUsers.length - 5}
              </div>
            )}
          </div>
          
          <div className="w-px h-6 bg-outline/20"></div>

          <button
            onClick={() => window.dispatchEvent(new Event('export-canvas'))}
            className="flex items-center gap-2 px-2 py-1.5 text-on-surface hover:bg-surface-dim transition-colors rounded-md text-sm font-medium"
            title="Export PNG"
          >
            <Download size={16} />
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-colors rounded-md text-sm font-medium"
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? 'Copied!' : 'Share'}
          </button>

          <div className="w-px h-6 bg-outline/20"></div>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`relative flex items-center gap-2 px-2 py-1.5 transition-colors rounded-md text-sm font-medium ${isChatOpen ? 'bg-surface-dim text-on-surface' : 'text-on-surface hover:bg-surface-dim'}`}
            title="Chat"
          >
            <MessageSquare size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-error">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex relative w-full h-full overflow-hidden">
        {/* Canvas */}
        <div className="flex-grow relative h-full">
          {socket ? (
            <Canvas socket={socket} boardId={boardId} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface/50">
              Connecting to server...
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {isChatOpen && (
          <div className="w-80 h-full bg-surface border-l border-outline/20 flex flex-col shadow-level-3 z-30 transition-transform">
            <div className="p-4 border-b border-outline/20 flex justify-between items-center bg-surface-dim/30">
              <h2 className="font-semibold flex items-center gap-2"><MessageSquare size={18}/> Board Chat</h2>
              <button onClick={() => setIsChatOpen(false)} className="text-on-surface/70 hover:text-on-surface">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="text-center text-on-surface/50 text-sm mt-10">
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col">
                    <span className="text-[10px] font-medium text-on-surface/50 mb-0.5 ml-1">{msg.name}</span>
                    <div className="bg-surface-dim/50 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-on-surface break-words">
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-outline/20 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-grow bg-background border border-outline/30 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-primary text-on-primary p-2 rounded-full hover:bg-primary-dim disabled:opacity-50 transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
