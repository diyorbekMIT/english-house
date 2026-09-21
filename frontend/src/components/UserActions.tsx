import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';
import { getErrorMessage } from '../lib/errors';

export interface ManagedUser {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  isActive: boolean;
}

type Panel = 'edit' | 'password' | null;

// CEO-only account actions for a row in a user table: fix name/phone/email, reset a
// forgotten password, deactivate or reactivate. The server enforces all of it (and
// logs it); this is just the front end for those endpoints.
const UserActions = ({ user }: { user: ManagedUser }) => {
  const qc = useQueryClient();
  const { confirm, showToast } = useFeedback();
  const [panel, setPanel] = useState<Panel>(null);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const refresh = () => qc.invalidateQueries();
  const fail = (err: unknown) => setError(getErrorMessage(err, 'Xatolik yuz berdi.'));

  const editMutation = useMutation({
    mutationFn: () =>
      api.patch(`/users/${user.id}`, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() ? email.trim() : null,
      }),
    onSuccess: () => { refresh(); setPanel(null); showToast({ type: 'success', title: "Ma'lumotlar yangilandi" }); },
    onError: fail,
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.patch(`/users/${user.id}/password`, { newPassword }),
    onSuccess: () => {
      setPanel(null);
      setNewPassword('');
      showToast({ type: 'success', title: 'Parol yangilandi', message: `${user.fullName} yangi parol bilan kira oladi.` });
    },
    onError: fail,
  });

  const statusMutation = useMutation({
    mutationFn: () => (user.isActive ? api.delete(`/users/${user.id}`) : api.patch(`/users/${user.id}/reactivate`)),
    onSuccess: () => {
      refresh();
      showToast({ type: 'success', title: user.isActive ? 'Nofaol qilindi' : 'Faollashtirildi' });
    },
    onError: (err: unknown) =>
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "Holatni o'zgartirib bo'lmadi.") }),
  });

  const handleToggleActive = async () => {
    const ok = await confirm({
      title: user.isActive ? 'Foydalanuvchini nofaol qilasizmi?' : 'Foydalanuvchini qayta faollashtirasizmi?',
      message: user.isActive
        ? "U darhol tizimdan chiqariladi va kira olmaydi. Ma'lumotlari va komissiyalari saqlanadi."
        : 'U yana tizimga kira oladi.',
      variant: user.isActive ? 'warning' : undefined,
      details: [{ label: 'Foydalanuvchi', value: `${user.fullName} (${user.phone})` }],
      confirmText: user.isActive ? 'Ha, nofaol qilish' : 'Ha, faollashtirish',
    });
    if (ok) statusMutation.mutate();
  };

  const open = (p: Panel) => {
    setError('');
    setFullName(user.fullName);
    setPhone(user.phone);
    setEmail(user.email ?? '');
    setNewPassword('');
    setPanel(p);
  };

  const submitEdit = (e: FormEvent) => { e.preventDefault(); setError(''); editMutation.mutate(); };
  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError("Parol kamida 8 belgidan iborat bo'lishi kerak."); return; }
    passwordMutation.mutate();
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => open('edit')} className="btn-secondary text-xs px-2 py-1">Tahrirlash</button>
        <button onClick={() => open('password')} className="btn-secondary text-xs px-2 py-1">Parol</button>
        <button
          onClick={handleToggleActive}
          disabled={statusMutation.isPending}
          className={`${user.isActive ? 'btn-danger' : 'btn-primary'} text-xs px-2 py-1`}
        >
          {user.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
        </button>
      </div>

      {panel && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/40 p-4" onClick={() => setPanel(null)}>
          <form
            onSubmit={panel === 'edit' ? submitEdit : submitPassword}
            className="card w-full max-w-sm space-y-4 shadow-xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="section-title">{panel === 'edit' ? "Ma'lumotlarni tahrirlash" : 'Parolni tiklash'}</h2>
            <p className="text-xs text-slate-500 -mt-2">{user.fullName} ({user.phone})</p>

            {panel === 'edit' ? (
              <>
                <div>
                  <label className="label">F.I.SH</label>
                  <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Telefon (login)</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={4} />
                </div>
                <div>
                  <label className="label">Email (ixtiyoriy)</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </>
            ) : (
              <div>
                <label className="label">Yangi parol (kamida 8 belgi)</label>
                <input
                  className="input"
                  type="text"
                  autoComplete="off"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
                <p className="text-2xs text-slate-500 mt-1">Yangi parolni foydalanuvchiga o'zingiz yetkazing. U keyin o'zi o'zgartirishi mumkin.</p>
              </div>
            )}

            {error && <div className="notice-error">{error}</div>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={editMutation.isPending || passwordMutation.isPending}>
                Saqlash
              </button>
              <button type="button" onClick={() => setPanel(null)} className="btn-secondary">Bekor qilish</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default UserActions;
