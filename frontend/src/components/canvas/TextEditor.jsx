import React from 'react';

export default function TextEditor({
  editingText,
  zoom,
  stageRef,
  setEditingText,
  setElements,
  elements,
  socket,
  boardId,
  recordAction,
  tool,
  setTool,
  debouncedThumbnail
}) {
  if (!editingText) return null;

  const getAbsolutePosition = (el) => {
    if (!stageRef.current) return { x: el.x, y: el.y };
    const transform = stageRef.current.getAbsoluteTransform();
    return transform.point({ x: el.x, y: el.y });
  };

  const handleBlur = (e) => {
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
    debouncedThumbnail();
  };

  return (
    <textarea
      autoFocus
      className="absolute z-50 outline-none resize-none m-0 overflow-hidden"
      style={{
        top: getAbsolutePosition(editingText).y + (editingText.tool === 'sticky' ? 12 * zoom : 0),
        left: getAbsolutePosition(editingText).x + (editingText.tool === 'sticky' ? 12 * zoom : 0),
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
      onBlur={handleBlur}
    />
  );
}
