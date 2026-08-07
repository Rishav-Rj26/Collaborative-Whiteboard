import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Text, Transformer, Group, Image as KonvaImage } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { jsPDF } from 'jspdf';
import useCanvasSocket from '../hooks/useCanvasSocket';
import useHistory from '../hooks/useHistory';
import ConfirmModal from './ConfirmModal';
import { API_URL } from '../config';

import Toolbar from './canvas/Toolbar';
import ZoomControls from './canvas/ZoomControls';
import RemoteCursors from './canvas/RemoteCursors';
import TextEditor from './canvas/TextEditor';
import useDrawing from '../hooks/useDrawing';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

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
  const toast = useToast();
  
  const [selectedId, setSelectedId] = useState(null);
  const { elements, setElements, remoteCursors, laserPoints, setLaserPoints } = useCanvasSocket(socket, selectedId, setSelectedId);
  const { undoStack, redoStack, recordAction, undo, redo, clearHistory } = useHistory(socket, boardId, elements, setElements, selectedId, setSelectedId);
  
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#a78bfa');
  const [lineWidth, setLineWidth] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [editingText, setEditingText] = useState(null); 
  const fileInputRef = useRef(null);
  
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const lastElementBeforeTransform = useRef(null);

  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const thumbnailTimerRef = useRef(null);

  const saveThumbnail = useCallback(() => {
    if (!stageRef.current || !socket) return;
    try {
      const uri = stageRef.current.toDataURL({ pixelRatio: 0.15 });
      socket.emit('save-thumbnail', { boardId, thumbnail: uri });
    } catch { }
  }, [boardId, socket]);

  const debouncedThumbnail = useCallback(() => {
    if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    thumbnailTimerRef.current = setTimeout(saveThumbnail, 2000);
  }, [saveThumbnail]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        const center = { x: stageSize.width / 2 / zoom - stagePos.x / zoom, y: stageSize.height / 2 / zoom - stagePos.y / zoom };
        const img = new window.Image();
        img.src = data.url;
        img.onload = () => {
          const newElement = {
            id: uuidv4(), tool: 'image', src: data.url, pageId: activePageId,
            x: center.x - img.width / 4, y: center.y - img.height / 4,
            width: img.width / 2, height: img.height / 2,
            rotation: 0, scaleX: 1, scaleY: 1
          };
          setElements(prev => [...prev, newElement]);
          setTool('select');
          setSelectedId(newElement.id);
          socket.emit('update-element', { boardId, element: newElement });
          recordAction({ type: 'add', element: newElement });
          toast.success('Image uploaded');
          debouncedThumbnail();
        };
      }
    } catch (err) { toast.error('Image upload failed'); }
  };

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
            link.download = `board-${boardId}.${format}`; link.href = uri;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
          }
          toast.success(`Exported as ${format.toUpperCase()}`);
        }, 50);
      }
    };
    window.addEventListener('export-canvas', handleExport);
    return () => window.removeEventListener('export-canvas', handleExport);
  }, [boardId, stageSize, toast]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => setStageSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }));
    observer.observe(containerRef.current);
    setStageSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    return () => observer.disconnect();
  }, []);

  const clearCanvas = () => {
    setConfirmModal({
      open: true, title: 'Clear Canvas', message: 'Are you sure you want to clear the entire canvas?',
      onConfirm: () => {
        setElements([]); clearHistory(); setSelectedId(null);
        socket.emit('clear-canvas', boardId);
        setConfirmModal(prev => ({ ...prev, open: false }));
        toast.info('Canvas cleared');
        debouncedThumbnail();
      }
    });
  };

  useKeyboardShortcuts({ role, editingText, undo, redo, setZoom, setStagePos, selectedId, elements, setElements, recordAction, socket, boardId, setSelectedId, debouncedThumbnail, setTool });
  const { handleMouseDown, handleMouseMove, handleMouseUp } = useDrawing({ tool, color, lineWidth, role, activePageId, user, boardId, socket, elements, setElements, setSelectedId, setEditingText, recordAction, debouncedThumbnail, setLaserPoints });

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));
  const zoomReset = () => { setZoom(1); setStagePos({ x: 0, y: 0 }); };
  const handleWheel = (e) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey) {
      const scaleBy = 1.05;
      const stage = e.target.getStage();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      setZoom(newScale);
      setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    } else setStagePos(prev => ({ x: prev.x - e.evt.deltaX, y: prev.y - e.evt.deltaY }));
  };

  useEffect(() => {
    if (selectedId && trRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
    }
  }, [selectedId, elements]);

  const handleTransformStart = (e) => { lastElementBeforeTransform.current = elements.find(el => el.id === e.target.id()); };
  const handleTransformEnd = (e) => {
    const node = e.target;
    const newEl = { ...elements.find(el => el.id === node.id()), x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() };
    recordAction({ type: 'update', before: lastElementBeforeTransform.current, after: newEl });
    setElements(prev => prev.map(el => el.id === newEl.id ? newEl : el));
    socket.emit('update-element', { boardId, element: newEl });
    debouncedThumbnail();
  };
  const handleDragStart = (e) => { lastElementBeforeTransform.current = elements.find(el => el.id === e.target.id()); };
  const handleDragEnd = (e) => {
    const newEl = { ...elements.find(el => el.id === e.target.id()), x: e.target.x(), y: e.target.y() };
    recordAction({ type: 'update', before: lastElementBeforeTransform.current, after: newEl });
    setElements(prev => prev.map(el => el.id === newEl.id ? newEl : el));
    socket.emit('update-element', { boardId, element: newEl });
    debouncedThumbnail();
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

  return (
    <div ref={containerRef} className="w-full h-full relative canvas-grid-bg overflow-hidden" 
         style={{ cursor: (tool === 'select' || role === 'viewer') ? 'default' : tool === 'pan' ? 'grab' : (tool === 'text' || tool === 'sticky') ? 'text' : 'crosshair' }}>
      
      <ConfirmModal
        open={confirmModal.open} title={confirmModal.title} message={confirmModal.message}
        confirmLabel="Clear" variant="danger" onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
      />

      <Toolbar role={role} tool={tool} setTool={setTool} setSelectedId={setSelectedId} color={color} setColor={setColor} lineWidth={lineWidth} setLineWidth={setLineWidth} fileInputRef={fileInputRef} handleImageUpload={handleImageUpload} undo={undo} redo={redo} undoStack={undoStack} redoStack={redoStack} clearCanvas={clearCanvas} />
      <ZoomControls zoom={zoom} zoomIn={zoomIn} zoomOut={zoomOut} zoomReset={zoomReset} />
      <TextEditor editingText={editingText} zoom={zoom} stageRef={stageRef} setEditingText={setEditingText} setElements={setElements} elements={elements} socket={socket} boardId={boardId} recordAction={recordAction} tool={tool} setTool={setTool} debouncedThumbnail={debouncedThumbnail} />
      <RemoteCursors remoteCursors={remoteCursors} user={user} zoom={zoom} stagePos={stagePos} />

      <Stage
        ref={stageRef} width={stageSize.width} height={stageSize.height}
        scaleX={zoom} scaleY={zoom} x={stagePos.x} y={stagePos.y}
        onWheel={handleWheel} draggable={tool === 'pan'}
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
