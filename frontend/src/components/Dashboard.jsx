import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';

export default function Dashboard() {
  const [joinId, setJoinId] = useState('');
  const navigate = useNavigate();

  const createBoard = () => {
    // Generate a random 6-character board ID
    const newBoardId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/board/${newBoardId}`);
  };

  const joinBoard = (e) => {
    e.preventDefault();
    if (joinId.trim()) {
      navigate(`/board/${joinId.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface shadow-level-2 rounded-xl p-8 border border-outline/20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-on-surface mb-2">Boardly</h1>
          <p className="text-on-surface/70">Collaborative Whiteboard Workspace</p>
        </div>

        <div className="space-y-6">
          <button 
            onClick={createBoard}
            className="w-full bg-primary hover:bg-primary-dim text-on-primary font-medium py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Create New Board
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-outline/20"></div>
            <span className="flex-shrink-0 mx-4 text-on-surface/50 text-sm">or join existing</span>
            <div className="flex-grow border-t border-outline/20"></div>
          </div>

          <form onSubmit={joinBoard} className="space-y-3">
            <div>
              <label htmlFor="boardId" className="block text-sm font-medium text-on-surface mb-1">
                Board ID
              </label>
              <input
                id="boardId"
                type="text"
                placeholder="e.g. A1B2C3"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                className="w-full px-4 py-2 border border-outline/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-on-surface placeholder:text-on-surface/30 uppercase"
              />
            </div>
            <button 
              type="submit"
              disabled={!joinId.trim()}
              className="w-full border border-outline/30 bg-surface hover:bg-background text-on-surface font-medium py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Users size={20} />
              Join Board
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
