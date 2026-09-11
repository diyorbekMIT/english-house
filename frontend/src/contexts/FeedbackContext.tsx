import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

export interface ConfirmDetail {
  label: string;
  value: string | number;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  details?: ConfirmDetail[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'warning';
}

export interface ToastOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  durationMs: number;
}

interface FeedbackContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showToast: (options: ToastOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export const useFeedback = (): FeedbackContextType => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
  } | null>(null);

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({
        isOpen: true,
        options: {
          confirmText: "Ha, tasdiqlash",
          cancelText: "Bekor qilish",
          variant: "primary",
          ...options,
        },
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setConfirmState(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setConfirmState(null);
  }, []);

  // Keyboard navigation for confirm dialog
  useEffect(() => {
    if (!confirmState?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState?.isOpen, handleCancel]);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ type, title, message, durationMs = 4000 }: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, message, durationMs }]);

    if (durationMs > 0) {
      setTimeout(() => {
        removeToast(id);
      }, durationMs);
    }
  }, [removeToast]);

  return (
    <FeedbackContext.Provider value={{ confirm, showToast }}>
      {children}

      {/* ── CONFIRMATION MODAL ────────────────────────────────────────── */}
      {confirmState?.isOpen && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden transition-all transform scale-100 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with icon badge */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : confirmState.options.variant === 'warning'
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-blue-50 text-[#1E3A8A] border border-blue-200'
                }`}
              >
                {confirmState.options.variant === 'danger' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : confirmState.options.variant === 'warning' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {confirmState.options.title}
                </h3>
                {confirmState.options.message && (
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    {confirmState.options.message}
                  </p>
                )}
              </div>
            </div>

            {/* Optional details summary */}
            {confirmState.options.details && confirmState.options.details.length > 0 && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                {confirmState.options.details.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 font-medium">{item.label}:</span>
                    <span className="text-slate-900 font-semibold text-right break-words">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                {confirmState.options.cancelText || 'Bekor qilish'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmState.options.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#1E3A8A] hover:bg-[#1e3275]'
                }`}
              >
                {confirmState.options.confirmText || 'Ha, tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST CONTAINER ───────────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-6 z-[9999] flex flex-col items-center gap-3 pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border-t-4 overflow-hidden transition-all animate-in zoom-in-95 fade-in duration-200 ${
              t.type === 'success'
                ? 'border-t-emerald-500'
                : t.type === 'error'
                ? 'border-t-rose-500'
                : t.type === 'warning'
                ? 'border-t-amber-500'
                : 'border-t-blue-500'
            }`}
          >
            <div className="flex items-start gap-3.5 p-5">
              {/* Status icon badge */}
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                  t.type === 'success'
                    ? 'bg-emerald-100 text-emerald-700'
                    : t.type === 'error'
                    ? 'bg-rose-100 text-rose-700'
                    : t.type === 'warning'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-[#1E3A8A]'
                }`}
              >
                {t.type === 'success' && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {t.type === 'error' && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {t.type === 'warning' && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
                  </svg>
                )}
                {t.type === 'info' && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {t.title}
                </h4>
                {t.message && (
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    {t.message}
                  </p>
                )}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors shrink-0"
                aria-label="Yopish"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Auto-dismiss progress bar */}
            {t.durationMs > 0 && (
              <div className="h-1 w-full bg-slate-100">
                <div
                  className={`h-full ${
                    t.type === 'success'
                      ? 'bg-emerald-500'
                      : t.type === 'error'
                      ? 'bg-rose-500'
                      : t.type === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{
                    animation: `toast-shrink ${t.durationMs}ms linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </FeedbackContext.Provider>
  );
};
