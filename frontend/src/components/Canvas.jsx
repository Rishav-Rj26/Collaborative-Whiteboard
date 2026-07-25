import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Text, Transformer, Group } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { Pencil, Square, Circle, Minus, Eraser, Trash2, Undo, Redo, MousePointer2, Type, MousePointerClick, StickyNote } from 'lucide-react';

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 70%, 50%)`;
};

export default function Canvas({ socket, boardId }) {
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([[]]); 
  const [historyStep, setHistoryStep] = useState(0);
  
  const [tool, setTool] = useState('select'); // select, pen, line, rect, ellipse, eraser, text, sticky
  const [color, setColor] = useState('#191c1d');
  const [lineWidth, setLineWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight - 56 });
  const [remoteCursors, setRemoteCursors] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  
  // Text editing state
  const [editingText, setEditingText] = useState(null); 
  
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);

  // Handle Export
  useEffect(() => {
    const handleExport = () => {
      if (stageRef.current) {
        setSelectedId(null);
        setTimeout(() => {
          const uri = stageRef.current.toDataURL({ pixelRatio: 2, bg: '#f8f9fa' });
          const link = document.createElement('a');
          link.download = `board-${boardId}.png`;
          link.href = uri;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, 50);
      }
    };
    window.addEventListener('export-canvas', handleExport);
    return () => window.removeEventListener('export-canvas', handleExport);
  }, [boardId]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('board-state', (serverElements) => {
      setElements(serverElements);
      setHistory([serverElements]);
      setHistoryStep(0);
    });

    socket.on('update-element', ({ element }) => {
      setElements(prev => {
        const index = prev.findIndex(e => e.id === element.id);
        if (index !== -1) {
          const newElements = [...prev];
          newElements[index] = element;
          return newElements;
        }
        return [...prev, element];
      });
    });

    socket.on('delete-element', (elementId) => {
      setElements(prev => prev.filter(e => e.id !== elementId));
      if (selectedId === elementId) setSelectedId(null);
    });

    socket.on('cursor-move', (data) => {
      setRemoteCursors(prev => ({
        ...prev,
        [data.userId]: data
      }));
    });

    socket.on('cursor-remove', (userId) => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    return () => {
      socket.off('board-state');
      socket.off('update-element');
      socket.off('delete-element');
      socket.off('cursor-move');
      socket.off('cursor-remove');
    };
  }, [socket, selectedId]);

  const saveHistory = useCallback((newElements) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push([...newElements]);
      setHistoryStep(newHistory.length - 1);
      return newHistory;
    });
  }, [historyStep]);

  const undo = useCallback(() => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      setElements(history[newStep]);
      socket.emit('set-elements', { boardId, elements: history[newStep] });
      setSelectedId(null);
    }
  }, [historyStep, history, socket, boardId]);

  const redo = useCallback(() => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      setElements(history[newStep]);
      socket.emit('set-elements', { boardId, elements: history[newStep] });
      setSelectedId(null);
    }
  }, [historyStep, history, socket, boardId]);

  const clearCanvas = () => {
    if (window.confirm("Are you sure you want to clear the canvas?")) {
      setElements([]);
      saveHistory([]);
      setSelectedId(null);
      socket.emit('clear-canvas', boardId);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editingText) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) redo();
        else undo();
        e.preventDefault();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo();
        e.preventDefault();
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setElements(prev => {
          const newElements = prev.filter(el => el.id !== selectedId);
          socket.emit('delete-element', { boardId, elementId: selectedId });
          saveHistory(newElements);
          return newElements;
        });
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingText, boardId, socket, undo, redo, saveHistory]);

  const checkDeselect = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
    }
  };

  const handleMouseDown = (e) => {
    if (tool === 'select') {
      checkDeselect(e);
      return;
    }

    if (editingText) return;

    const pos = e.target.getStage().getPointerPosition();

    if (tool === 'text') {
      const newElement = {
        id: uuidv4(),
        tool: 'text',
        x: pos.x,
        y: pos.y,
        text: '',
        color: color,
        fontSize: 24
      };
      setElements([...elements, newElement]);
      setEditingText(newElement);
      setSelectedId(null);
      return;
    }

    if (tool === 'sticky') {
      // Map dark colors to pastel for sticky notes if selected
      const pastelColor = color === '#191c1d' ? '#fef3c7' : color;
      
      const newElement = {
        id: uuidv4(),
        tool: 'sticky',
        x: pos.x,
        y: pos.y,
        width: 150,
        height: 150,
        text: '',
        color: pastelColor,
        fontSize: 16
      };
      setElements([...elements, newElement]);
      setEditingText(newElement);
      setSelectedId(null);
      return;
    }

    setIsDrawing(true);
    setSelectedId(null);
    
    const newElement = {
      id: uuidv4(),
      tool,
      points: [pos.x, pos.y],
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      color: tool === 'eraser' ? '#f8f9fa' : color,
      strokeWidth: tool === 'eraser' ? 20 : lineWidth,
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    };

    setElements([...elements, newElement]);
    socket.emit('update-element', { boardId, element: newElement });
  };

  const lastCursorEmit = useRef(0);

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    const now = Date.now();
    if (now - lastCursorEmit.current > 30) { 
      socket.emit('cursor-move', { boardId, cursor: point });
      lastCursorEmit.current = now;
    }

    if (!isDrawing || tool === 'select' || tool === 'text' || tool === 'sticky') return;

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
      socket.emit('update-element', { boardId, element: lastElement });
      return newElements;
    });
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistory(elements);
    }
  };

  useEffect(() => {
    if (selectedId && trRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, elements]);

  const handleTransformEnd = (e) => {
    const node = e.target;
    const newEl = {
      ...elements.find(el => el.id === node.id()),
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY()
    };

    setElements(prev => {
      const next = prev.map(el => el.id === newEl.id ? newEl : el);
      saveHistory(next);
      return next;
    });
    
    socket.emit('update-element', { boardId, element: newEl });
  };

  const handleDragEnd = (e) => {
    const id = e.target.id();
    const newEl = {
      ...elements.find(el => el.id === id),
      x: e.target.x(),
      y: e.target.y()
    };
    setElements(prev => {
      const next = prev.map(el => el.id === newEl.id ? newEl : el);
      saveHistory(next);
      return next;
    });
    socket.emit('update-element', { boardId, element: newEl });
  };

  const renderElement = (el) => {
    const isSelected = el.id === selectedId;
    const isDraggable = tool === 'select';
    
    const commonProps = {
      key: el.id,
      id: el.id,
      x: el.x || 0,
      y: el.y || 0,
      rotation: el.rotation || 0,
      scaleX: el.scaleX || 1,
      scaleY: el.scaleY || 1,
      draggable: isDraggable,
      onClick: () => { if (tool === 'select') setSelectedId(el.id); },
      onTap: () => { if (tool === 'select') setSelectedId(el.id); },
      onDragEnd: handleDragEnd,
      onTransformEnd: handleTransformEnd,
    };

    switch (el.tool) {
      case 'pen':
      case 'eraser':
      case 'line':
        return (
          <Line
            {...commonProps}
            points={el.points}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
            tension={el.tool === 'pen' ? 0.5 : 0}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'}
          />
        );
      case 'rect':
        return (
          <Rect
            {...commonProps}
            width={el.width}
            height={el.height}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
          />
        );
      case 'ellipse':
        return (
          <Ellipse
            {...commonProps}
            width={el.width}
            height={el.height}
            radiusX={Math.abs((el.width||0) / 2)}
            radiusY={Math.abs((el.height||0) / 2)}
            offset={{ x: -(el.width||0) / 2, y: -(el.height||0) / 2 }}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
          />
        );
      case 'text':
        return (
          <Text
            {...commonProps}
            text={el.text}
            fontSize={el.fontSize || 24}
            fill={el.color}
            fontFamily="Inter"
            onDblClick={() => { if (tool === 'select') setEditingText(el); }}
          />
        );
      case 'sticky':
        return (
          <Group {...commonProps}>
            <Rect
              width={el.width || 150}
              height={el.height || 150}
              fill={el.color}
              shadowColor="rgba(0,0,0,0.2)"
              shadowBlur={10}
              shadowOffset={{ x: 2, y: 4 }}
            />
            <Text
              text={el.text}
              width={el.width || 150}
              height={el.height || 150}
              padding={10}
              fontSize={el.fontSize || 16}
              fill="#191c1d"
              fontFamily="Inter"
              wrap="word"
              onDblClick={() => { if (tool === 'select') setEditingText(el); }}
            />
          </Group>
        );
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-background overflow-hidden" 
         style={{ cursor: tool === 'select' ? 'default' : (tool === 'text' || tool === 'sticky') ? 'text' : 'crosshair' }}>
      
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface shadow-level-2 rounded-xl p-2 flex items-center gap-4 border border-outline/20 z-40">
        <div className="flex gap-1 items-center px-2">
          {[
            { id: 'select', icon: MousePointerClick },
            { id: 'pen', icon: Pencil },
            { id: 'line', icon: Minus },
            { id: 'rect', icon: Square },
            { id: 'ellipse', icon: Circle },
            { id: 'text', icon: Type },
            { id: 'sticky', icon: StickyNote },
            { id: 'eraser', icon: Eraser },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); setSelectedId(null); }}
              className={`p-2 rounded-md transition-colors ${tool === t.id ? 'bg-primary/10 text-primary' : 'text-on-surface/70 hover:bg-surface-dim'}`}
              title={t.id}
            >
              <t.icon size={18} />
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-outline/20"></div>
        <div className="flex gap-1 items-center px-2">
          {['#191c1d', '#4f46e5', '#ba1a1a', '#fef3c7'].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-outline scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              title={`Color ${c}`}
            />
          ))}
        </div>
        <div className="w-px h-6 bg-outline/20"></div>
        <div className="flex items-center gap-2 px-2">
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={lineWidth} 
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-20 accent-primary"
            title="Stroke Width"
          />
        </div>
        <div className="w-px h-6 bg-outline/20"></div>
        <div className="flex gap-1 items-center px-2">
          <button onClick={undo} disabled={historyStep === 0} className="p-2 rounded-md text-on-surface/70 hover:bg-surface-dim disabled:opacity-30" title="Undo (Ctrl+Z)">
            <Undo size={18} />
          </button>
          <button onClick={redo} disabled={historyStep === history.length - 1} className="p-2 rounded-md text-on-surface/70 hover:bg-surface-dim disabled:opacity-30" title="Redo (Ctrl+Y)">
            <Redo size={18} />
          </button>
          <button onClick={clearCanvas} className="p-2 rounded-md text-error hover:bg-error/10" title="Clear Canvas">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Text Editing Overlay */}
      {editingText && (
        <textarea
          autoFocus
          className="absolute z-50 bg-transparent outline-none resize-none m-0 overflow-hidden"
          style={{
            top: editingText.y + (editingText.tool === 'sticky' ? 10 : 0),
            left: editingText.x + (editingText.tool === 'sticky' ? 10 : 0),
            width: editingText.tool === 'sticky' ? (editingText.width - 20) : 'auto',
            height: editingText.tool === 'sticky' ? (editingText.height - 20) : 'auto',
            color: editingText.tool === 'sticky' ? '#191c1d' : editingText.color,
            fontSize: `${editingText.fontSize}px`,
            fontFamily: 'Inter',
            minWidth: editingText.tool === 'sticky' ? '0' : '100px',
            minHeight: editingText.tool === 'sticky' ? '0' : '40px',
            border: editingText.tool === 'text' ? '1px dashed #ccc' : 'none'
          }}
          defaultValue={editingText.text}
          onBlur={(e) => {
            const val = e.target.value;
            const newEl = { ...editingText, text: val };
            
            setElements(prev => {
              let next;
              if (val.trim() === '' && editingText.tool === 'text') {
                next = prev.filter(el => el.id !== editingText.id);
                socket.emit('delete-element', { boardId, elementId: editingText.id });
              } else {
                next = prev.map(el => el.id === editingText.id ? newEl : el);
                socket.emit('update-element', { boardId, element: newEl });
              }
              saveHistory(next);
              return next;
            });
            setEditingText(null);
            if (tool === 'text' || tool === 'sticky') setTool('select');
          }}
        />
      )}

      {/* Remote Cursors Layer */}
      <div className="absolute inset-0 pointer-events-none z-30">
        {Object.values(remoteCursors).map(cursor => (
          <div 
            key={cursor.userId}
            className="absolute transition-all duration-75 ease-linear"
            style={{ 
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              color: stringToColor(cursor.name)
            }}
          >
            <MousePointer2 size={16} fill="currentColor" className="-rotate-12 drop-shadow-md" />
            <div 
              className="ml-3 mt-1 px-2 py-0.5 text-xs text-white rounded shadow-sm whitespace-nowrap"
              style={{ backgroundColor: stringToColor(cursor.name) }}
            >
              {cursor.name}
            </div>
          </div>
        ))}
      </div>

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          {elements.map((el) => renderElement(el))}
          {selectedId && tool === 'select' && (
            <Transformer 
              ref={trRef} 
              boundBoxFunc={(oldBox, newBox) => {
                if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
