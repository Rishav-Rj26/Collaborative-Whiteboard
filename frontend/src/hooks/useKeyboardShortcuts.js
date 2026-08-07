import { useEffect } from 'react';

const TOOL_SHORTCUTS = {
  v: 'select', h: 'pan', p: 'pen', l: 'line',
  r: 'rect', o: 'ellipse', e: 'eraser',
  t: 'text', s: 'sticky', g: 'laser',
};

export default function useKeyboardShortcuts({
  role,
  editingText,
  undo,
  redo,
  setZoom,
  setStagePos,
  selectedId,
  elements,
  setElements,
  recordAction,
  socket,
  boardId,
  setSelectedId,
  debouncedThumbnail,
  setTool
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (role === 'viewer') return;
      if (editingText) return;

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) redo(); else undo();
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo(); e.preventDefault();
        return;
      }

      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '0')) {
        setZoom(1); setStagePos({ x: 0, y: 0 });
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        setZoom(prev => Math.min(prev * 1.2, 5));
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        setZoom(prev => Math.max(prev / 1.2, 0.1));
        e.preventDefault();
        return;
      }

      // Delete selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const el = elements.find(e => e.id === selectedId);
        if (el) {
          recordAction({ type: 'delete', element: el });
          setElements(prev => prev.filter(e => e.id !== selectedId));
          socket.emit('delete-element', { boardId, elementId: selectedId });
          setSelectedId(null);
          debouncedThumbnail();
        }
        return;
      }

      // Tool shortcuts (only when no modifier keys)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const toolId = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (toolId) {
          setTool(toolId);
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingText, boardId, socket, undo, redo, elements, role, debouncedThumbnail, setZoom, setStagePos, setElements, recordAction, setSelectedId, setTool]);
}
