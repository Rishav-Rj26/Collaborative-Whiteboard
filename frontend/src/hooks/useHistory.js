import { useState, useCallback } from 'react';

export default function useHistory(socket, boardId, elements, setElements, selectedId, setSelectedId) {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const recordAction = useCallback((action) => {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);
    
    if (action.type === 'add') {
      socket.emit('delete-element', { boardId, elementId: action.element.id });
      setElements(prev => prev.filter(e => e.id !== action.element.id));
      if (selectedId === action.element.id) setSelectedId(null);
    } else if (action.type === 'delete') {
      socket.emit('update-element', { boardId, element: action.element });
      setElements(prev => [...prev, action.element]);
    } else if (action.type === 'update') {
      socket.emit('update-element', { boardId, element: action.before });
      setElements(prev => prev.map(e => e.id === action.before.id ? action.before : e));
    }
  }, [undoStack, socket, boardId, selectedId, setElements, setSelectedId]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);
    
    if (action.type === 'add') {
      socket.emit('update-element', { boardId, element: action.element });
      setElements(prev => [...prev, action.element]);
    } else if (action.type === 'delete') {
      socket.emit('delete-element', { boardId, elementId: action.element.id });
      setElements(prev => prev.filter(e => e.id !== action.element.id));
      if (selectedId === action.element.id) setSelectedId(null);
    } else if (action.type === 'update') {
      socket.emit('update-element', { boardId, element: action.after });
      setElements(prev => prev.map(e => e.id === action.after.id ? action.after : e));
    }
  }, [redoStack, socket, boardId, selectedId, setElements, setSelectedId]);

  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return { undoStack, redoStack, recordAction, undo, redo, clearHistory };
}
