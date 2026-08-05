import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Text, Transformer, Group, Image as KonvaImage } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import useCanvasSocket, { stringToColor } from '../hooks/useCanvasSocket';
import useHistory from '../hooks/useHistory';

const URLImage = ({ el, commonProps }) => {
  const [image, setImage] = useState(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = el.src;
    img.crossOrigin = 'Anonymous';
    img.onload = () => setImage(img);
  }, [el.src]);
  return <KonvaImage {...commonProps} image={image} width={el.width} height={el.height} />;
};

export default function Canvas({ socket, boardId, role, activePageId }) {
  const { user, token } = useAuth();
  
  const [selectedId, setSelectedId] = useState(null);
  const { elements, setElements, remoteCursors, laserPoints, setLaserPoints } = useCanvasSocket(socket, selectedId, setSelectedId);
  const { undoStack, redoStack, recordAction, undo, redo, clearHistory } = useHistory(socket, boardId, elements, setElements, selectedId, setSelectedId);
  
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#a78bfa'); // Obsidian primary color
  const [lineWidth, setLineWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  const [editingText, setEditingText] = useState(null); 
  const fileInputRef = useRef(null);
  
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const lastElementBeforeTransform = useRef(null);



  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    e.target.value = ''; // Reset input
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (data.url) {
        const center = {
           x: stageSize.width / 2 / zoom - stagePos.x / zoom,
           y: stageSize.height / 2 / zoom - stagePos.y / zoom
        };
        const img = new window.Image();
        img.src = data.url;
        img.onload = () => {
          const newElement = {
            id: uuidv4(), tool: 'image', src: data.url,
            pageId: activePageId,
            x: center.x - img.width / 4, y: center.y - img.height / 4,
            width: img.width / 2, height: img.height / 2, // scale down by default
            rotation: 0, scaleX: 1, scaleY: 1
          };
          setElements(prev => [...prev, newElement]);
          setTool('select');
          setSelectedId(newElement.id);
          socket.emit('update-element', { boardId, element: newElement });
          recordAction({ type: 'add', element: newElement });
        };
      }
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  // Handle Export (triggered from Whiteboard.jsx)
  useEffect(() => {
    const handleExport = (e) => {
      const format = e.detail?.format || 'png';
      if (stageRef.current) {
        setSelectedId(null);
        setTimeout(() => {
          const uri = stageRef.current.toDataURL({ pixelRatio: 2, bg: '#09090b', mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png' });
          if (format === 'pdf') {
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [stageSize.width, stageSize.height] });
            pdf.addImage(uri, 'PNG', 0, 0, stageSize.width, stageSize.height);
            pdf.save(`board-${boardId}.pdf`);
          } else {
            const link = document.createElement('a');
            link.download = `board-${boardId}.${format}`;
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }, 50);
      }
    };
    window.addEventListener('export-canvas', handleExport);
    return () => window.removeEventListener('export-canvas', handleExport);
  }, [boardId, stageSize]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setStageSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const clearCanvas = () => {
    if (window.confirm("Are you sure you want to clear the canvas? This cannot be undone.")) {
      setElements([]); clearHistory(); setSelectedId(null);
      socket.emit('clear-canvas', boardId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (role === 'viewer') return;
      if (editingText) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) redo(); else undo();
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo(); e.preventDefault();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const el = elements.find(e => e.id === selectedId);
        if (el) {
          recordAction({ type: 'delete', element: el });
          setElements(prev => prev.filter(e => e.id !== selectedId));
          socket.emit('delete-element', { boardId, elementId: selectedId });
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingText, boardId, socket, undo, redo, elements]);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey) {
      // Zoom
      const scaleBy = 1.05;
      const stage = e.target.getStage();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      setZoom(newScale);
      setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    } else {
      // Pan
      setStagePos(prev => ({ x: prev.x - e.evt.deltaX, y: prev.y - e.evt.deltaY }));
    }
  };

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

  const handleMouseDown = (e) => {
    if (e.evt.button === 1 || e.evt.button === 2) return; // Ignore middle/right clicks
    if (role === 'viewer') {
      if (tool === 'select') checkDeselect(e);
      return;
    }
    
    if (tool === 'select' || tool === 'pan') {
      if (tool === 'select') checkDeselect(e);
      return;
    }
    if (editingText) return;

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
        color: isSticky ? '#fef08a' : color, // Default yellow for sticky
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
      color: tool === 'eraser' ? '#09090b' : color, // Match obsidian background for eraser
      strokeWidth: tool === 'eraser' ? 20 : lineWidth,
      rotation: 0, scaleX: 1, scaleY: 1
    };

    setElements([...elements, newElement]);
    socket.emit('update-element', { boardId, element: newElement });
  };

  const lastCursorEmit = useRef(0);

  const handleMouseMove = (e) => {
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
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      if (tool === 'laser') return; // Do not record action for laser
      const lastElement = elements[elements.length - 1];
      recordAction({ type: 'add', element: lastElement });
      // Finally save the finished stroke/shape to the DB
      socket.emit('update-element', { boardId, element: lastElement });
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

  const handleTransformStart = (e) => { lastElementBeforeTransform.current = elements.find(el => el.id === e.target.id()); };
  const handleTransformEnd = (e) => {
    const node = e.target;
    const newEl = {
      ...elements.find(el => el.id === node.id()),
      x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY()
    };
    recordAction({ type: 'update', before: lastElementBeforeTransform.current, after: newEl });
    setElements(prev => prev.map(el => el.id === newEl.id ? newEl : el));
    socket.emit('update-element', { boardId, element: newEl });
  };
  const handleDragStart = (e) => { lastElementBeforeTransform.current = elements.find(el => el.id === e.target.id()); };
  const handleDragEnd = (e) => {
    const newEl = { ...elements.find(el => el.id === e.target.id()), x: e.target.x(), y: e.target.y() };
    recordAction({ type: 'update', before: lastElementBeforeTransform.current, after: newEl });
    setElements(prev => prev.map(el => el.id === newEl.id ? newEl : el));
    socket.emit('update-element', { boardId, element: newEl });
  };

  const renderElement = (el) => {
    const isDraggable = tool === 'select';
    const commonProps = {
      key: el.id, id: el.id, x: el.x || 0, y: el.y || 0,
      rotation: el.rotation || 0, scaleX: el.scaleX || 1, scaleY: el.scaleY || 1,
      draggable: isDraggable,
      onClick: () => { if (tool === 'select') setSelectedId(el.id); },
      onTap: () => { if (tool === 'select') setSelectedId(el.id); },
      onDragStart: handleDragStart, onDragEnd: handleDragEnd,
      onTransformStart: handleTransformStart, onTransformEnd: handleTransformEnd,
    };
    switch (el.tool) {
      case 'pen': case 'eraser': case 'line':
        return <Line {...commonProps} points={el.points} stroke={el.color} strokeWidth={el.strokeWidth} tension={el.tool === 'pen' ? 0.5 : 0} lineCap="round" lineJoin="round" globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'} />;
      case 'rect':
        return <Rect {...commonProps} width={el.width} height={el.height} stroke={el.color} strokeWidth={el.strokeWidth} />;
      case 'ellipse':
        return <Ellipse {...commonProps} width={el.width} height={el.height} radiusX={Math.abs((el.width||0)/2)} radiusY={Math.abs((el.height||0)/2)} offset={{ x: -(el.width||0)/2, y: -(el.height||0)/2 }} stroke={el.color} strokeWidth={el.strokeWidth} />;
      case 'text':
        return <Text {...commonProps} text={el.text} fontSize={el.fontSize || 24} fill={el.color} fontFamily="Geist" onDblClick={() => { if (tool === 'select') setEditingText(el); }} />;
      case 'sticky':
        return (
          <Group {...commonProps}>
            <Rect width={el.width || 150} height={el.height || 150} fill={el.color} cornerRadius={4} shadowColor="rgba(0,0,0,0.4)" shadowBlur={12} shadowOffset={{ x: 2, y: 6 }} />
            <Text text={el.text} width={el.width || 150} height={el.height || 150} padding={12} fontSize={el.fontSize || 14} fill="#09090b" fontFamily="Geist" wrap="word" onDblClick={() => { if (tool === 'select') setEditingText(el); }} />
          </Group>
        );
      case 'image':
        return <URLImage key={el.id} el={el} commonProps={commonProps} />;
      default: return null;
    }
  };

  const getAbsolutePosition = (el) => {
    if (!stageRef.current) return { x: el.x, y: el.y };
    const transform = stageRef.current.getAbsoluteTransform();
    return transform.point({ x: el.x, y: el.y });
  };

  // Tool UI Helper
  const ToolButton = ({ id, icon, title }) => (
    <button
      onClick={() => { setTool(id); setSelectedId(null); }} title={title}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${tool === id ? 'text-primary bg-primary/20' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
    >
      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{icon}</span>
    </button>
  );

  return (
    <div ref={containerRef} className="w-full h-full relative canvas-grid-bg overflow-hidden" 
         style={{ cursor: (tool === 'select' || role === 'viewer') ? 'default' : tool === 'pan' ? 'grab' : (tool === 'text' || tool === 'sticky') ? 'text' : 'crosshair' }}>
      
      {/* Floating Left Sidebar - Obsidian Toolbar */}
      {role !== 'viewer' && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40 pointer-events-none">
        <div className="bg-surface border border-outline-variant rounded-xl p-1 shadow-obsidian flex flex-col gap-1 pointer-events-auto w-12 items-center">
          
          <ToolButton id="select" icon="near_me" title="Select" />
          <ToolButton id="pan" icon="pan_tool" title="Pan" />
          <ToolButton id="pen" icon="edit" title="Pen" />
          <ToolButton id="line" icon="horizontal_rule" title="Line" />
          <ToolButton id="rect" icon="crop_square" title="Rectangle" />
          <ToolButton id="ellipse" icon="radio_button_unchecked" title="Circle" />
          <ToolButton id="eraser" icon="ink_eraser" title="Eraser" />
          <ToolButton id="text" icon="title" title="Text" />
          <ToolButton id="sticky" icon="sticky_note_2" title="Sticky Note" />
          <ToolButton id="laser" icon="gesture" title="Laser Pointer" />
          
          <button
            onClick={() => fileInputRef.current?.click()} title="Upload Image"
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>image</span>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          
          <div className="w-8 h-[1px] bg-outline-variant my-1"></div>
          
          {/* Colors */}
          <div className="flex flex-col gap-2 py-1 items-center">
            {['#fafafa', '#ef4444', '#a78bfa', '#34d399', '#f59e0b'].map(c => (
              <button 
                key={c} onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary border-transparent' : 'border-outline-variant'}`}
                style={{ backgroundColor: c, ringOffsetColor: '#0c0c0f' }} title={`Color ${c}`}
              />
            ))}
          </div>
          
          {/* Undo/Redo/Trash */}
          <div className="w-8 h-[1px] bg-outline-variant my-1"></div>
          <button onClick={undo} disabled={undoStack.length === 0} className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors disabled:opacity-30" title="Undo"><span className="material-symbols-outlined text-[20px]">undo</span></button>
          <button onClick={redo} disabled={redoStack.length === 0} className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors disabled:opacity-30" title="Redo"><span className="material-symbols-outlined text-[20px]">redo</span></button>
          <button onClick={clearCanvas} className="w-10 h-10 rounded-lg flex items-center justify-center text-error hover:bg-error-container transition-colors" title="Clear Canvas"><span className="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      </div>
      )}

      {/* Text Editing Overlay */}
      {editingText && (
        <textarea
          autoFocus
          className="absolute z-50 outline-none resize-none m-0 overflow-hidden"
          style={{
            top: getAbsolutePosition(editingText).y + (editingText.tool === 'sticky' ? 12*zoom : 0),
            left: getAbsolutePosition(editingText).x + (editingText.tool === 'sticky' ? 12*zoom : 0),
            width: (editingText.tool === 'sticky' ? (editingText.width - 24) : 'auto') * zoom,
            height: (editingText.tool === 'sticky' ? (editingText.height - 24) : 'auto') * zoom,
            color: editingText.tool === 'sticky' ? '#09090b' : editingText.color,
            fontSize: `${editingText.fontSize * zoom}px`,
            fontFamily: 'Geist',
            minWidth: editingText.tool === 'sticky' ? '0' : '150px',
            minHeight: editingText.tool === 'sticky' ? '0' : '40px',
            border: editingText.tool === 'text' ? '1px dashed #52525b' : 'none',
            background: editingText.tool === 'text' ? 'rgba(9, 9, 11, 0.8)' : 'transparent',
            borderRadius: editingText.tool === 'text' ? '4px' : '0',
            padding: editingText.tool === 'text' ? '4px' : '0',
          }}
          defaultValue={editingText.text}
          onBlur={(e) => {
            const val = e.target.value;
            const newEl = { ...editingText, text: val };
            if (val.trim() === '' && editingText.tool === 'text') {
              socket.emit('delete-element', { boardId, elementId: editingText.id });
              setElements(prev => prev.filter(el => el.id !== editingText.id));
              recordAction({ type: 'delete', element: editingText });
            } else {
              socket.emit('update-element', { boardId, element: newEl });
              setElements(prev => prev.map(el => el.id === editingText.id ? newEl : el));
              const isNew = !elements.find(el => el.text && el.id === editingText.id);
              if (isNew) recordAction({ type: 'add', element: newEl });
              else recordAction({ type: 'update', before: editingText, after: newEl });
            }
            setEditingText(null);
            if (tool === 'text' || tool === 'sticky') setTool('select');
          }}
        />
      )}

      {/* Remote Cursors */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {Object.values(remoteCursors).map(cursor => {
           if(cursor.userId === user?.id) return null;
           // Project cursor relative to zoom/pan
           const absX = cursor.x * zoom + stagePos.x;
           const absY = cursor.y * zoom + stagePos.y;
           return (
             <div key={cursor.userId} className="absolute transition-all duration-75 ease-linear" style={{ transform: `translate(${absX}px, ${absY}px)`, color: stringToColor(cursor.name) }}>
               <span className="material-symbols-outlined absolute -top-1 -left-1" style={{ fontVariationSettings: "'FILL' 1" }}>near_me</span>
               <div className="ml-5 mt-4 px-2 py-0.5 text-[10px] text-white rounded-md shadow-sm whitespace-nowrap font-medium" style={{ backgroundColor: stringToColor(cursor.name) }}>
                 {cursor.name}
               </div>
             </div>
           )
        })}
      </div>

      <Stage
        ref={stageRef} width={stageSize.width} height={stageSize.height}
        scaleX={zoom} scaleY={zoom} x={stagePos.x} y={stagePos.y}
        onWheel={handleWheel}
        draggable={tool === 'pan'}
        onDragEnd={(e) => { if(tool === 'pan') setStagePos({ x: e.target.x(), y: e.target.y() }); }}
        onMouseDown={handleMouseDown} onMousemove={handleMouseMove} onMouseup={handleMouseUp} onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
      >
        <Layer>
          {elements.filter(el => el.pageId === activePageId || !el.pageId).map((el) => renderElement(el))}
          {selectedId && tool === 'select' && role !== 'viewer' && (
            <Transformer 
              ref={trRef} 
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) ? oldBox : newBox}
              borderStroke="#a78bfa" anchorStroke="#a78bfa" anchorFill="#18181b" anchorSize={8}
            />
          )}
          {/* Laser Points */}
          {Object.entries(laserPoints).map(([uid, points]) => {
            if (points.length < 2) return null;
            const pts = points.flatMap(p => [p.x, p.y]);
            const strokeColor = points[points.length - 1].color;
            return <Line key={`laser-${uid}`} points={pts} stroke={strokeColor} strokeWidth={4} tension={0.5} lineCap="round" lineJoin="round" opacity={0.6} shadowColor={strokeColor} shadowBlur={8} listening={false} />;
          })}
        </Layer>
      </Stage>
    </div>
  );
}
