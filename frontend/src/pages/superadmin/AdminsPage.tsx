import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import StatusBadge from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import type { User } from './types';
import UserActions from '../../components/UserActions';

export const AdminsPage = () => {
  const qc = useQueryClient();
  const { data: admins = [] } = useQuery<User[]>({
    queryKey: ['users', 'SALES_MANAGER'],
    queryFn: () => api.get('/users?role=SALES_MANAGER').then((r) => r.data),
  });

  const [form, setForm] = useState({ fullName: '', phone: '', password: '' });
  const [msg, setMsg] = useState('');
  const { confirm, showToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/users/sales-manager', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'SALES_MANAGER'] });
      setForm({ fullName: '', phone: '', password: '' });
      setMsg("Sotuv menejeri muvaffaqiyatli qo'shildi!");
      showToast({
        type: 'success',
        title: "Sotuv menejeri qo'shildi",
        message: "Yangi sotuv menejeri muvaffaqiyatli ro'yxatdan o'tkazildi!",
      });
      setTimeout(() => setMsg(''), 3000);
    },
    onError: (err: unknown) => {
      const errText = getErrorMessage(err, "Sotuv menejerini saqlashda xatolik yuz berdi.");
      setMsg(`Xatolik: ${errText}`);
      showToast({
        type: 'error',
        title: 'Xatolik yuz berdi',
        message: errText,
      });
    },
  });

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    const confirmed = await confirm({
      title: "Sotuv menejeri hisobini yaratishni tasdiqlaysizmi?",
      message: "Ushbu foydalanuvchiga o'quvchilar, qo'ng'iroqlar va to'lovlarni nazorat qilish vakolati beriladi.",
      details: [
        { label: "Sotuv menejeri F.I.SH", value: form.fullName },
        { label: "Telefon raqam", value: form.phone },
      ],
      confirmText: "Ha, sotuv menejerini qo'shish",
    });
    if (!confirmed) return;

    mutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Sotuv menejerlari boshqaruvi</h1>
        <p className="text-sm text-slate-500 mt-0.5">O'quvchilar va to'lovlarni nazorat qiluvchi sotuv menejerlari</p>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Yangi sotuv menejeri qo'shish</h2>
        <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">F.I.SH</label>
            <input
              type="text"
              className="input"
              placeholder="Sotuv menejeri ismi"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Telefon raqam</label>
            <input
              type="tel"
              className="input"
              placeholder="+998901234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Parol</label>
            <input
              type="password"
              className="input"
              placeholder="Kamida 6 ta belgi"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          {msg && <div className={`sm:col-span-3 ${msg.includes('Xatolik') ? 'notice-error' : 'notice-success'}`}>{msg}</div>}
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Qo'shilmoqda…" : "Sotuv menejerini qo'shish"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Sotuv menejerlari ro'yxati ({admins.length})</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Telefon (Login)</th>
                <th>Holati</th>
                <th>Yaratilgan sana</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold text-slate-900">{a.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{a.phone}</td>
                  <td><StatusBadge value={a.isActive ? 'true' : 'false'} type="active" /></td>
                  <td className="text-slate-500 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td><UserActions user={a} /></td>
                </tr>
              ))}
              {admins.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-400">Sotuv menejerlari mavjud emas</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
