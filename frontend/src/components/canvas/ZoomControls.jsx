import React from 'react';

export default function ZoomControls({ zoom, zoomIn, zoomOut, zoomReset }) {
  return (
    <div className="absolute bottom-4 left-4 z-40 pointer-events-none md:bottom-4 md:left-4">
      <div className="bg-surface border border-outline-variant rounded-xl shadow-obsidian flex items-center gap-0 pointer-events-auto overflow-hidden zoom-bar">
        <button onClick={zoomOut} className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors" title="Zoom Out (Ctrl+−)">
          <span className="material-symbols-outlined text-[18px]">remove</span>
        </button>
        <button
          onClick={zoomReset}
          className="h-9 px-2 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors border-x border-outline-variant min-w-[52px]"
          title="Reset Zoom (Ctrl+0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors" title="Zoom In (Ctrl++)">
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>
    </div>
  );
}
