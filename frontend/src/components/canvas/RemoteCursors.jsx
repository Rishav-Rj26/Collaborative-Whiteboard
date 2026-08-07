import React from 'react';
import { stringToColor } from '../../hooks/useCanvasSocket';

export default function RemoteCursors({ remoteCursors, user, zoom, stagePos }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {Object.values(remoteCursors).map(cursor => {
         if (cursor.userId === user?.id) return null;
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
  );
}
