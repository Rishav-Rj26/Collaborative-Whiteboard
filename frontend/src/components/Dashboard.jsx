import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Loader2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { API_URL } from '../config';
import BoardlyLogo from './BoardlyLogo';

export default function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [joinId, setJoinId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, shared, recent
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const toast = useToast();

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, boardId: null });

  const fetchBoards = async () => {
    try {
      const res = await fetch(`${API_URL}/boards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBoards(data.boards || []);
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoards(); }, [token]);

  const createBoard = async () => {
    try {
      const res = await fetch(`${API_URL}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim() || 'Untitled Board' }),
      });
      const data = await res.json();
      setShowCreate(false);
      setNewTitle('');
      toast.success('Board created');
      navigate(`/board/${data.board.id}`);
    } catch (err) {
      console.error('Failed to create board:', err);
      toast.error('Failed to create board');
    }
  };

  const deleteBoard = async (boardId) => {
    try {
      await fetch(`${API_URL}/boards/${boardId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setBoards(prev => prev.filter(b => b.id !== boardId));
      toast.success('Board deleted');
    } catch (err) {
      console.error('Failed to delete board:', err);
      toast.error('Failed to delete board');
    }
  };

  const renameBoard = async (boardId, newTitle) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (res.ok) {
        setBoards(prev => prev.map(b => b.id === boardId ? { ...b, title: newTitle.trim() } : b));
        toast.success('Board renamed');
      }
    } catch (err) {
      toast.error('Failed to rename board');
    }
    setEditingTitleId(null);
  };

  const joinBoard = async (e) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    try {
      await fetch(`${API_URL}/boards/${joinId.trim()}/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      toast.success('Joined board');
      navigate(`/board/${joinId.trim()}`);
    } catch (err) {
      console.error('Failed to join board:', err);
      toast.error('Failed to join board');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Filter and sort boards
  const filteredBoards = boards
    .filter(b => {
      if (activeFilter === 'shared') return b.owner_id !== user?.id;
      return true; // 'all' or 'recent'
    })
    .filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (activeFilter === 'recent') {
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      }
      return 0;
    });

  const displayBoards = activeFilter === 'recent' ? filteredBoards.slice(0, 5) : filteredBoards;

  return (
    <div className="bg-background text-on-background h-screen overflow-hidden flex relative">
      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title="Delete Board"
        message="This board and all its contents will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          deleteBoard(confirmModal.boardId);
          setConfirmModal({ open: false, boardId: null });
        }}
        onCancel={() => setConfirmModal({ open: false, boardId: null })}
      />

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 glass-panel h-screen w-64 flex flex-col border-r border-outline-variant py-6 transform transition-transform duration-300 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BoardlyLogo size={40} />
            <div>
              <h1 className="text-on-surface text-sm font-bold">Project Workspace</h1>
              <p className="text-label text-on-surface-variant">Collaborative Team</p>
            </div>
          </div>
          <button className="md:hidden text-on-surface-variant p-1" onClick={() => setSidebarOpen(false)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-2">
          <button onClick={() => setActiveFilter('all')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-label-md transition-colors w-full text-left ${activeFilter === 'all' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-variant/40'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
            All Boards
          </button>
          <button onClick={() => setActiveFilter('shared')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-label-md transition-colors w-full text-left ${activeFilter === 'shared' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-variant/40'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            Shared with Me
          </button>
          <button onClick={() => setActiveFilter('recent')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-label-md transition-colors w-full text-left ${activeFilter === 'recent' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-variant/40'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Recent
          </button>
        </nav>
        <div className="px-4 mt-auto">
          <button onClick={() => setShowCreate(true)} className="w-full py-3 bg-primary text-on-primary rounded-lg text-label-md font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Board
          </button>
        </div>
        <div className="px-2 mt-6 flex flex-col gap-1">
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 text-on-surface-variant text-label-md transition-colors hover:bg-surface-variant/40 rounded-lg w-full text-left">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-transparent relative z-10">
        {/* Top Nav */}
        <header className="w-full h-16 flex justify-between items-center px-8 lg:px-10 border-b border-outline-variant glass-panel">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-on-surface-variant" onClick={() => setSidebarOpen(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="hidden md:flex w-8 h-8 bg-primary rounded items-center justify-center">
              <span className="text-on-primary font-bold text-xs">B</span>
            </div>
          </div>
          <div className="flex-1 max-w-md mx-4">
            <div className="relative flex items-center w-full h-10 rounded-lg bg-surface-container/50 border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <svg className="absolute left-3 w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search boards..." className="w-full h-full bg-transparent border-none focus:ring-0 text-on-surface pl-10 pr-4 text-sm outline-none placeholder-on-surface-variant" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold border border-outline-variant">
              {user?.name?.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-[1280px] mx-auto">
            <header className="mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <h2 className="text-display text-on-background mb-2">
                  {activeFilter === 'shared' ? 'Shared with Me' : activeFilter === 'recent' ? 'Recent Boards' : 'Dashboard'}
                </h2>
                <p className="text-body-lg text-on-surface-variant">Welcome back. Here are your {activeFilter === 'recent' ? 'recent' : ''} boards.</p>
              </div>

              {/* Join Board */}
              <form onSubmit={joinBoard} className="flex gap-2 items-center">
                <input
                  type="text" value={joinId} onChange={(e) => setJoinId(e.target.value)}
                  placeholder="Board ID to join..."
                  className="px-4 py-2.5 bg-surface-container/50 border border-outline-variant rounded-lg text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary w-48"
                />
                <button type="submit" disabled={!joinId.trim()} className="px-4 py-2.5 border border-outline-variant rounded-lg text-sm text-on-surface font-medium hover:bg-surface-variant/40 transition-colors disabled:opacity-40">
                  Join
                </button>
              </form>
            </header>

            {/* Create Board Modal */}
            {showCreate && (
              <div className="fixed inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center z-50 modal-backdrop">
                <div className="modal-content bg-surface-container-highest rounded-xl p-6 border border-outline-variant shadow-level-3 w-full max-w-md mx-4">
                  <h3 className="text-title text-on-surface mb-4">Create New Board</h3>
                  <input
                    autoFocus type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Board name"
                    className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface placeholder-outline focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary mb-4"
                    onKeyDown={(e) => e.key === 'Enter' && createBoard()}
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setShowCreate(false); setNewTitle(''); }} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-variant/40 rounded-lg transition-colors">Cancel</button>
                    <button onClick={createBoard} className="px-4 py-2 bg-primary text-on-primary font-medium rounded-lg transition-all text-sm hover:bg-primary/90">Create</button>
                  </div>
                </div>
              </div>
            )}

            {/* Board Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-primary" />
              </div>
            ) : displayBoards.length === 0 ? (
              /* ── Empty State ── */
              <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
                {/* Illustration */}
                <div className="relative w-48 h-48 mb-8">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-28 h-28 border-2 border-primary/20 rounded-2xl rotate-6">
                      <div className="absolute inset-3 border border-primary/15 rounded-xl -rotate-3"></div>
                      <div className="absolute inset-6 bg-primary/5 rounded-lg rotate-2"></div>
                    </div>
                  </div>
                  <div className="absolute top-6 right-10 w-3 h-3 rounded-full bg-tertiary/40 animate-pulse"></div>
                  <div className="absolute bottom-8 left-8 w-2 h-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute top-16 left-6 w-12 h-0.5 bg-primary/15 rounded-full -rotate-12"></div>
                  <div className="absolute bottom-14 right-8 w-10 h-0.5 bg-tertiary/15 rounded-full rotate-12"></div>
                  {/* Pen icon in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[40px] text-primary/30" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>draw</span>
                  </div>
                </div>
                
                <h3 className="text-headline text-on-surface mb-3">No boards yet</h3>
                <p className="text-body-lg text-on-surface-variant text-center max-w-md mb-8">
                  Create your first board to start collaborating in real-time with your team.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-6 py-3 bg-primary text-on-primary rounded-lg text-label-md font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Create Your First Board
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayBoards.map((board, index) => (
                  <div
                    key={board.id}
                    className="board-card-enter glass-card rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 group cursor-pointer shadow-xl"
                    style={{ animationDelay: `${index * 60}ms` }}
                    onClick={() => navigate(`/board/${board.id}`)}
                  >
                    <div className="h-40 w-full relative overflow-hidden bg-surface-container/20">
                      {board.thumbnail ? (
                        <img 
                          src={board.thumbnail} 
                          alt={board.title}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'auto' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-container to-surface-container-high">
                          <span className="text-4xl font-bold text-on-surface-variant/20">{board.title?.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low/80 to-transparent opacity-60"></div>
                    </div>
                    <div className="p-4" onClick={(e) => e.stopPropagation()}>
                      {editingTitleId === board.id ? (
                        <input
                          autoFocus
                          type="text"
                          className="w-full bg-surface-container border border-primary rounded px-2 py-1 text-sm text-on-surface mb-1 outline-none"
                          value={editingTitleText}
                          onChange={(e) => setEditingTitleText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameBoard(board.id, editingTitleText);
                            if (e.key === 'Escape') setEditingTitleId(null);
                          }}
                          onBlur={() => renameBoard(board.id, editingTitleText)}
                        />
                      ) : (
                        <h3 
                          className="text-headline-mobile text-on-surface mb-1 truncate text-base font-semibold hover:text-primary transition-colors"
                          onDoubleClick={() => {
                            if (board.owner_id === user?.id) {
                              setEditingTitleId(board.id);
                              setEditingTitleText(board.title);
                            }
                          }}
                          title={board.owner_id === user?.id ? "Double-click to rename" : ""}
                        >
                          {board.title}
                        </h3>
                      )}
                      <p className="text-body-sm text-on-surface-variant mb-4 flex items-center gap-1 cursor-pointer" onClick={() => navigate(`/board/${board.id}`)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {formatDate(board.updated_at || board.created_at)}
                      </p>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1 text-label text-on-surface-variant">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                          {board.member_count}
                        </div>
                        {board.owner_id === user?.id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmModal({ open: true, boardId: board.id }); }}
                            className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Create New Card */}
                <button
                  onClick={() => setShowCreate(true)}
                  className="board-card-enter bg-surface-container-low/30 backdrop-blur-md border border-dashed border-outline-variant/50 rounded-xl flex flex-col items-center justify-center min-h-[250px] hover:border-primary/50 hover:bg-surface-container-low/50 transition-all duration-300 group shadow-xl"
                  style={{ animationDelay: `${boards.length * 60}ms` }}
                >
                  <div className="w-12 h-12 rounded-full bg-surface-variant/40 flex items-center justify-center text-on-surface-variant group-hover:bg-primary/20 group-hover:text-primary transition-colors mb-4">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  </div>
                  <span className="text-label-md text-on-surface-variant group-hover:text-primary transition-colors">Create Blank Board</span>
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
