import { X } from 'lucide-react';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
  if (!open) return null;

  const confirmClasses = variant === 'danger'
    ? 'bg-error text-on-error hover:bg-error/90'
    : 'bg-primary text-on-primary hover:bg-primary/90';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center modal-backdrop" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="modal-content bg-surface-container-highest rounded-xl border border-outline-variant p-6 w-full max-w-md mx-4 shadow-level-3">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-title text-on-surface">{title}</h3>
          <button onClick={onCancel} className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-variant/40 transition-colors -mt-1 -mr-1">
            <X size={18} />
          </button>
        </div>
        <p className="text-body-md text-on-surface-variant mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-variant/40 rounded-lg transition-colors font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
