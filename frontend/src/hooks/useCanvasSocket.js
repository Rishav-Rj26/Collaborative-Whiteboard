import { useState, useEffect } from 'react';

export const stringToColor = (str) => {
  if (!str) return '#0ea5e9';
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  const colors = ['#0ea5e9', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6'];
  return colors[Math.abs(hash) % colors.length];
};

export default function useCanvasSocket(socket, selectedId, setSelectedId) {
  const [elements, setElements] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [laserPoints, setLaserPoints] = useState({});

  useEffect(() => {
    if (!socket) return;
    
    socket.on('board-state', (serverElements) => setElements(serverElements));
    
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
    
    socket.on('cursor-move', (data) => setRemoteCursors(prev => ({ ...prev, [data.userId]: data })));
    
    socket.on('cursor-remove', (userId) => {
      setRemoteCursors(prev => { const next = { ...prev }; delete next[userId]; return next; });
    });
    
    socket.on('laser-draw', (data) => {
      setLaserPoints(prev => ({
        ...prev,
        [data.userId]: [...(prev[data.userId] || []), { x: data.x, y: data.y, timestamp: Date.now(), color: stringToColor(data.name) }]
      }));
    });

    return () => {
      socket.off('board-state');
      socket.off('update-element');
      socket.off('delete-element');
      socket.off('cursor-move');
      socket.off('cursor-remove');
      socket.off('laser-draw');
    };
  }, [socket, selectedId, setSelectedId]);

  // Cleanup laser points older than 1 second
  useEffect(() => {
    let animationFrameId;
    const animate = () => {
      const now = Date.now();
      let updated = false;
      setLaserPoints(prev => {
        const next = { ...prev };
        for (const [uid, points] of Object.entries(next)) {
          const filtered = points.filter(p => now - p.timestamp < 1000);
          if (filtered.length !== points.length) {
            updated = true;
            if (filtered.length === 0) delete next[uid];
            else next[uid] = filtered;
          }
        }
        return updated ? next : prev;
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return { elements, setElements, remoteCursors, laserPoints, setLaserPoints };
}
