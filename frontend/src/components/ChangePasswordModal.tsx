import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';
import { getErrorMessage } from '../lib/errors';

// Lets any signed-in user change their own password (needs the current one).
const ChangePasswordModal = ({ onClose }: { onClose: () => void }) => {
  const { showToast } = useFeedback();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.patch('/users/me/password', { currentPassword, newPassword }),
    onSuccess: () => {
      showToast({ type: 'success', title: "Parol o'zgartirildi", message: 'Keyingi kirishda yangi paroldan foydalaning.' });
      onClose();
    },
    onError: (err: unknown) => setError(getErrorMessage(err, "Parolni o'zgartirishda xatolik yuz berdi.")),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError("Yangi parol kamida 8 belgidan iborat bo'lishi kerak."); return; }
    if (newPassword !== repeat) { setError('Yangi parollar bir xil emas.'); return; }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="section-title">Parolni o'zgartirish</h2>
          <p className="text-xs text-slate-500 mt-1">Kamida 8 belgi. Boshqa joyda ishlatmagan parolni tanlang.</p>
        </div>
        <div>
          <label className="label" htmlFor="cp-current">Joriy parol</label>
          <input id="cp-current" type="password" className="input" autoComplete="current-password"
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="cp-new">Yangi parol</label>
          <input id="cp-new" type="password" className="input" autoComplete="new-password" minLength={8}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="cp-repeat">Yangi parolni takrorlang</label>
          <input id="cp-repeat" type="password" className="input" autoComplete="new-password" minLength={8}
            value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
        </div>
        {error && <div className="notice-error">{error}</div>}
        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={mutation.isPending}>
            Bekor qilish
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordModal;
