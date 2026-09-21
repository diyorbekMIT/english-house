import { useState } from 'react';

interface CommentModalProps {
  title: string;
  message: string;
  rows: { label: string; value: string }[];
  commentLabel: string;
  placeholder: string;
  required: boolean;
  confirmText: string;
  danger?: boolean;
  isPending: boolean;
  onSubmit: (comment: string) => void;
  onClose: () => void;
}

// Confirmation dialog with a comment box — used wherever the CEO changes a status and
// has to (or may) leave a note explaining why.
const CommentModal = ({
  title,
  message,
  rows,
  commentLabel,
  placeholder,
  required,
  confirmText,
  danger,
  isPending,
  onSubmit,
  onClose,
}: CommentModalProps) => {
  const [comment, setComment] = useState('');
  const trimmed = comment.trim();
  const canSubmit = !isPending && (!required || trimmed.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="text-xs text-slate-500 mt-1">{message}</p>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3">
              <span className="text-slate-500">{r.label}</span>
              <span className="font-semibold text-slate-900 text-right">{r.value}</span>
            </div>
          ))}
        </div>

        <div>
          <label className="label">{commentLabel}</label>
          <textarea
            className="input min-h-[80px]"
            rows={3}
            maxLength={500}
            placeholder={placeholder}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
          <p className="text-2xs text-slate-400 mt-1 text-right">{comment.length}/500</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onSubmit(trimmed)}
            disabled={!canSubmit}
            className={`flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {isPending ? 'Yuborilmoqda…' : confirmText}
          </button>
          <button onClick={onClose} className="btn-secondary" disabled={isPending}>
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentModal;
