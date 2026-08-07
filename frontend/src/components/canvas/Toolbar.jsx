import React from 'react';

const TOOL_SHORTCUTS = {
  select: 'V', pan: 'H', pen: 'P', line: 'L',
  rect: 'R', ellipse: 'O', eraser: 'E',
  text: 'T', sticky: 'S', laser: 'G',
};

const STROKE_PRESETS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },
  { label: 'L', value: 8 },
];

export default function Toolbar({
  role, tool, setTool, setSelectedId, color, setColor,
  lineWidth, setLineWidth, fileInputRef, handleImageUpload,
  undo, redo, undoStack, redoStack, clearCanvas
}) {
  if (role === 'viewer') return null;

  const ToolButton = ({ id, icon, title }) => (
    <button
      onClick={() => { setTool(id); setSelectedId(null); }} 
      title={`${title} (${TOOL_SHORTCUTS[id] || ''})`}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${tool === id ? 'text-primary bg-primary/20' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
    >
      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{icon}</span>
      {TOOL_SHORTCUTS[id] && <span className="shortcut-badge">{TOOL_SHORTCUTS[id]}</span>}
    </button>
  );

  return (
    <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 md:bottom-auto md:left-4 md:top-1/2 md:-translate-y-1/2 md:translate-x-0 flex md:flex-col gap-2 z-40 pointer-events-none">
      <div className="bg-surface border border-outline-variant rounded-xl p-1 shadow-obsidian flex flex-row md:flex-col gap-1 pointer-events-auto md:w-12 h-12 md:h-auto items-center overflow-x-auto max-w-[90vw] md:max-w-none no-scrollbar">
        
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
          className="min-w-10 w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>image</span>
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        
        <div className="h-8 w-[1px] md:w-8 md:h-[1px] bg-outline-variant mx-1 md:mx-0 md:my-1 shrink-0"></div>
        
        {/* Colors */}
        <div className="flex flex-row md:flex-col gap-2 px-1 md:py-1 items-center shrink-0">
          {['#fafafa', '#ef4444', '#a78bfa', '#34d399', '#f59e0b'].map(c => (
            <button 
              key={c} onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary border-transparent' : 'border-outline-variant'}`}
              style={{ backgroundColor: c, ringOffsetColor: '#0c0c0f' }} title={`Color ${c}`}
            />
          ))}
        </div>

        {/* Stroke Width */}
        <div className="h-8 w-[1px] md:w-8 md:h-[1px] bg-outline-variant mx-1 md:mx-0 md:my-1 shrink-0"></div>
        <div className="flex flex-row md:flex-col gap-1 px-1 md:py-1 items-center shrink-0">
          {STROKE_PRESETS.map(sw => (
            <button
              key={sw.value}
              onClick={() => setLineWidth(sw.value)}
              title={`Stroke: ${sw.label}`}
              className={`min-w-8 w-8 h-6 rounded flex items-center justify-center transition-colors ${lineWidth === sw.value ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
            >
              <div 
                className="rounded-full" 
                style={{ width: sw.value * 3 + 4, height: sw.value + 1, backgroundColor: 'currentColor' }}
              />
            </button>
          ))}
        </div>
        
        {/* Undo/Redo/Trash */}
        <div className="h-8 w-[1px] md:w-8 md:h-[1px] bg-outline-variant mx-1 md:mx-0 md:my-1 shrink-0"></div>
        <button onClick={undo} disabled={undoStack.length === 0} className="min-w-10 w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors disabled:opacity-30 shrink-0" title="Undo (Ctrl+Z)"><span className="material-symbols-outlined text-[20px]">undo</span></button>
        <button onClick={redo} disabled={redoStack.length === 0} className="min-w-10 w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors disabled:opacity-30 shrink-0" title="Redo (Ctrl+Y)"><span className="material-symbols-outlined text-[20px]">redo</span></button>
        <button onClick={clearCanvas} className="min-w-10 w-10 h-10 rounded-lg flex items-center justify-center text-error hover:bg-error-container transition-colors shrink-0" title="Clear Canvas"><span className="material-symbols-outlined text-[20px]">delete</span></button>
      </div>
    </div>
  );
}
