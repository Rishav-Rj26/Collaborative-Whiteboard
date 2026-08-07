import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function useDrawing({
  tool,
  color,
  lineWidth,
  role,
  activePageId,
  user,
  boardId,
  socket,
  elements,
  setElements,
  setSelectedId,
  setEditingText,
  recordAction,
  debouncedThumbnail,
  setLaserPoints
}) {
  const [isDrawing, setIsDrawing] = useState(false);
  const lastCursorEmit = useRef(0);

  const getRelativePointerPosition = (stage) => {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    return transform.point(pos);
  };

  const checkDeselect = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelectedId(null);
  };

  const handleMouseDown = useCallback((e) => {
    if (e.evt.button === 1 || e.evt.button === 2) return;
    if (role === 'viewer') {
      if (tool === 'select') checkDeselect(e);
      return;
    }
    
    if (tool === 'select' || tool === 'pan') {
      if (tool === 'select') checkDeselect(e);
      return;
    }

    const pos = getRelativePointerPosition(e.target.getStage());

    if (tool === 'laser') {
      setIsDrawing(true);
      return;
    }

    if (tool === 'text' || tool === 'sticky') {
      const isSticky = tool === 'sticky';
      const newElement = {
        id: uuidv4(),
        tool,
        pageId: activePageId,
        x: pos.x, y: pos.y,
        text: '',
        color: isSticky ? '#fef08a' : color,
        fontSize: isSticky ? 14 : 24,
        ...(isSticky && { width: 150, height: 150 })
      };
      setElements([...elements, newElement]);
      setEditingText(newElement);
      setSelectedId(null);
      return;
    }

    setIsDrawing(true);
    setSelectedId(null);
    
    const newElement = {
      id: uuidv4(), tool,
      pageId: activePageId,
      points: [pos.x, pos.y],
      x: (tool === 'pen' || tool === 'eraser' || tool === 'line') ? 0 : pos.x,
      y: (tool === 'pen' || tool === 'eraser' || tool === 'line') ? 0 : pos.y,
      width: 0, height: 0,
      color: tool === 'eraser' ? '#09090b' : color,
      strokeWidth: tool === 'eraser' ? 20 : lineWidth,
      rotation: 0, scaleX: 1, scaleY: 1
    };

    setElements([...elements, newElement]);
    socket.emit('update-element', { boardId, element: newElement });
  }, [role, tool, color, lineWidth, activePageId, elements, setElements, setEditingText, setSelectedId, socket, boardId]);

  const handleMouseMove = useCallback((e) => {
    const stage = e.target.getStage();
    const point = getRelativePointerPosition(stage);
    
    const now = Date.now();
    if (now - lastCursorEmit.current > 30) { 
      socket.emit('cursor-move', { boardId, cursor: point });
      lastCursorEmit.current = now;
    }

    if (!isDrawing || tool === 'select' || tool === 'pan' || tool === 'text' || tool === 'sticky') return;

    if (tool === 'laser') {
      setLaserPoints(prev => ({
        ...prev,
        [user.id]: [...(prev[user.id] || []), { x: point.x, y: point.y, timestamp: Date.now(), color: color }]
      }));
      socket.emit('laser-draw', { boardId, laserPoint: point });
      return;
    }

    setElements(prev => {
      const lastElement = { ...prev[prev.length - 1] };
      if (lastElement.tool === 'pen' || lastElement.tool === 'eraser') {
        lastElement.points = lastElement.points.concat([point.x, point.y]);
      } else if (lastElement.tool === 'line') {
        lastElement.points = [lastElement.points[0], lastElement.points[1], point.x, point.y];
      } else if (lastElement.tool === 'rect' || lastElement.tool === 'ellipse') {
        lastElement.width = point.x - lastElement.x;
        lastElement.height = point.y - lastElement.y;
      }
      const newElements = [...prev];
      newElements[newElements.length - 1] = lastElement;
      socket.emit('draw-progress', { boardId, element: lastElement });
      return newElements;
    });
  }, [isDrawing, tool, color, user, socket, boardId, setLaserPoints, setElements]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      if (tool === 'laser') return;
      const lastElement = elements[elements.length - 1];
      recordAction({ type: 'add', element: lastElement });
      socket.emit('update-element', { boardId, element: lastElement });
      debouncedThumbnail();
    }
  }, [isDrawing, tool, elements, recordAction, socket, boardId, debouncedThumbnail]);

  return { handleMouseDown, handleMouseMove, handleMouseUp };
}
