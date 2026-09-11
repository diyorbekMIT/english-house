import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import StatusBadge from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import type { School, User } from './types';

export const DirectorsPage = () => {
  const qc = useQueryClient();
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools'],
    queryFn: () => api.get('/schools').then((r) => r.data),
  });
  const { data: directors = [] } = useQuery<User[]>({
    queryKey: ['users', 'DIRECTOR'],
    queryFn: () => api.get('/users?role=DIRECTOR').then((r) => r.data),
  });

  const [form, setForm] = useState({
    schoolId: '',
    fullName: '',
    phone: '',
    password: '',
    email: '',
  });
  const [msg, setMsg] = useState('');
  const { confirm, showToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (body: { schoolId: number; fullName: string; phone: string; password: string; email?: string }) =>
      api.post('/users/director', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'DIRECTOR'] });
      setForm({ schoolId: '', fullName: '', phone: '', password: '', email: '' });
      setMsg("Direktor muvaffaqiyatli tayinlandi!");
      showToast({
        type: 'success',
        title: 'Direktor tayinlandi',
        message: 'Yangi direktor muvaffaqiyatli tayinlandi va tizimga kirish huquqi berildi.',
      });
      setTimeout(() => setMsg(''), 3000);
    },
    onError: (err: unknown) => {
      const errText = getErrorMessage(err, "Direktorni saqlashda xatolik yuz berdi.");
      setMsg(`Xatolik: ${errText}`);
      showToast({
        type: 'error',
        title: 'Xatolik yuz berdi',
        message: errText,
      });
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const selectedSchool = schools.find((s) => s.id === Number(form.schoolId));

    const confirmed = await confirm({
      title: "Direktor tayinlashni tasdiqlaysizmi?",
      message: "Ushbu maktab uchun yangi direktor hisobi yaratiladi va barcha vakolatlar taqdim etiladi.",
      details: [
        { label: "Direktor F.I.SH", value: form.fullName },
        { label: "Telefon raqam", value: form.phone },
        {
          label: "Biriktirilayotgan maktab",
          value: selectedSchool ? `${selectedSchool.schoolNumber} — ${selectedSchool.name}` : `Maktab ID: ${form.schoolId}`,
        },
      ],
      confirmText: "Ha, direktorni tayinlash",
    });
    if (!confirmed) return;

    mutation.mutate({
      schoolId: Number(form.schoolId),
      fullName: form.fullName,
      phone: form.phone,
      password: form.password,
      email: form.email || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Direktorlar boshqaruvi</h1>
        <p className="text-sm text-slate-500 mt-0.5">Maktablarga direktorlarni biriktirish va ularning hisoblarini yaratish</p>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Yangi direktor tayinlash</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Maktabni tanlang</label>
            <select
              className="input"
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
              required
            >
              <option value="">-- Maktabni tanlang --</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Direktor F.I.SH</label>
            <input
              type="text"
              className="input"
              placeholder="Familiya Ism Sharif"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Telefon raqam (Kirish uchun)</label>
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
          <div className="sm:col-span-2">
            <label className="label">Email (Ixtiyoriy)</label>
            <input
              type="email"
              className="input"
              placeholder="director@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          {msg && (
            <div className={`sm:col-span-2 ${msg.includes('Xatolik') ? 'notice-error' : 'notice-success'}`}>
              {msg}
            </div>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Tayinlanmoqda…' : 'Direktorni saqlash'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Direktorlar ro'yxati ({directors.length})</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Telefon (Login)</th>
                <th>Maktab ID</th>
                <th>Email</th>
                <th>Holati</th>
              </tr>
            </thead>
            <tbody>
              {directors.map((d) => (
                <tr key={d.id}>
                  <td className="font-semibold text-slate-900">{d.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{d.phone}</td>
                  <td>{d.schoolId ?? '—'}</td>
                  <td className="text-slate-500 text-xs">{d.email ?? '—'}</td>
                  <td><StatusBadge value={d.isActive ? 'true' : 'false'} type="active" /></td>
                </tr>
              ))}
              {directors.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">Direktorlar hali qo'shilmagan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
