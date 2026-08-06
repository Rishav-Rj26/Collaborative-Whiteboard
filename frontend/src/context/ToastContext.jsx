import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    // Mark as exiting for animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Actually remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
    }, 250);
  }, []);

  const addToast = useCallback((message, variant = 'info', duration = 3500) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, variant, exiting: false }]);
    timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }, [addToast]);

  // Fix: useCallback can't wrap an object literal. Use a ref-stable object instead.
  const toastRef = useRef(null);
  if (!toastRef.current) {
    toastRef.current = {
      success: (msg, dur) => addToast(msg, 'success', dur),
      error: (msg, dur) => addToast(msg, 'error', dur),
      info: (msg, dur) => addToast(msg, 'info', dur),
    };
  }
  // Keep methods in sync with latest addToast
  toastRef.current.success = (msg, dur) => addToast(msg, 'success', dur);
  toastRef.current.error = (msg, dur) => addToast(msg, 'error', dur);
  toastRef.current.info = (msg, dur) => addToast(msg, 'info', dur);

  return (
    <ToastContext.Provider value={toastRef.current}>
      {children}
      {/* Toast container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: 380 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-level-3 text-sm font-medium cursor-pointer select-none ${t.exiting ? 'toast-exit' : 'toast-enter'} ${
              t.variant === 'success'
                ? 'bg-tertiary-container border-tertiary/30 text-on-tertiary-container'
                : t.variant === 'error'
                ? 'bg-error-container border-error/30 text-on-error-container'
                : 'bg-surface-container-highest border-outline-variant text-on-surface'
            }`}
            onClick={() => removeToast(t.id)}
          >
            {/* Icon */}
            <span className="material-symbols-outlined text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
              {t.variant === 'success' ? 'check_circle' : t.variant === 'error' ? 'error' : 'info'}
            </span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
