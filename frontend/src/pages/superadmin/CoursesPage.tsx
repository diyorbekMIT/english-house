import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import { getErrorMessage } from '../../lib/errors';
import StatusBadge from '../../components/StatusBadge';
import { formatUzs } from '../../lib/format';
import { AmountInput } from '../../components/AmountInput';

interface Course {
  id: number;
  name: string;
  priceUzs: number;
  isActive: boolean;
  createdAt: string;
}

export const CoursesPage = () => {
  const qc = useQueryClient();
  const { confirm, showToast } = useFeedback();
  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['courses', 'ceo'],
    queryFn: () => api.get('/courses').then((r) => r.data),
  });

  const [form, setForm] = useState({ name: '', priceUzs: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const createMutation = useMutation({
    mutationFn: (body: { name: string; priceUzs: number }) => api.post('/courses', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      setForm({ name: '', priceUzs: '' });
      showToast({ type: 'success', title: "Kurs qo'shildi", message: "Yangi kurs muvaffaqiyatli saqlandi." });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "Kursni saqlashda xatolik yuz berdi.") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; priceUzs?: number; isActive?: boolean }) =>
      api.patch(`/courses/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      setEditingId(null);
      showToast({ type: 'success', title: 'Kurs yangilandi', message: "Kurs muvaffaqiyatli o'zgartirildi." });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "Kursni yangilashda xatolik yuz berdi.") });
    },
  });

  const handleAddCourse = async (e: FormEvent) => {
    e.preventDefault();
    const price = Number(form.priceUzs);
    if (!form.name.trim() || !price || price < 0) return;
    const confirmed = await confirm({
      title: "Yangi kurs qo'shishni tasdiqlaysizmi?",
      details: [
        { label: 'Kurs nomi', value: form.name },
        { label: 'Narxi', value: `${formatUzs(price)} UZS` },
      ],
      confirmText: "Ha, kurs qo'shish",
    });
    if (!confirmed) return;
    createMutation.mutate({ name: form.name.trim(), priceUzs: price });
  };

  const startEdit = (c: Course) => {
    setEditingId(c.id);
    setEditPrice(String(c.priceUzs));
  };

  const handleSavePrice = async (c: Course) => {
    const newPrice = Number(editPrice);
    if (!newPrice || newPrice < 0) return;
    if (newPrice === c.priceUzs) { setEditingId(null); return; }
    const confirmed = await confirm({
      title: "Kurs narxini o'zgartirishni tasdiqlaysizmi?",
      message: "Bu narx faqat bosh administrator (CEO) tomonidan o'zgartirilishi mumkin.",
      details: [
        { label: 'Kurs', value: c.name },
        { label: 'Narxi', value: `${formatUzs(c.priceUzs)} → ${formatUzs(newPrice)} UZS` },
      ],
      confirmText: "Ha, o'zgartirish",
      variant: 'warning',
    });
    if (!confirmed) return;
    updateMutation.mutate({ id: c.id, priceUzs: newPrice });
  };

  const handleToggleActive = async (c: Course) => {
    const confirmed = await confirm({
      title: c.isActive ? "Kursni nofaol qilishni tasdiqlaysizmi?" : "Kursni faollashtirishni tasdiqlaysizmi?",
      message: c.isActive
        ? "Nofaol kurs o'qituvchilarga yangi o'quvchi qo'shishda ko'rsatilmaydi."
        : "Bu kurs endi o'qituvchilarga yangi o'quvchi qo'shishda ko'rsatiladi.",
      details: [{ label: 'Kurs', value: c.name }],
      confirmText: 'Ha, tasdiqlash',
    });
    if (!confirmed) return;
    updateMutation.mutate({ id: c.id, isActive: !c.isActive });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Kurslar boshqaruvi</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Kurslar va ularning narxlari — narxlar faqat CEO uchun ko'rinadi va faqat CEO o'zgartira oladi
        </p>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Yangi kurs qo'shish</h2>
        <form onSubmit={handleAddCourse} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Kurs nomi</label>
            <input
              type="text"
              className="input"
              placeholder="IELTS, General English…"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Narxi (UZS)</label>
            <AmountInput
              className="input"
              placeholder="1500000"
              value={form.priceUzs}
              onChange={(raw) => setForm({ ...form, priceUzs: raw })}
              required
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saqlanmoqda…' : "Kursni saqlash"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Kurslar ro'yxati ({courses.length})</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Kurs nomi</th>
                <th>Narxi</th>
                <th>Holati</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {courses.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold text-slate-900">{c.name}</td>
                  {editingId === c.id ? (
                    <>
                      <td>
                        <AmountInput
                          className="input w-32 py-1"
                          value={editPrice}
                          onChange={setEditPrice}
                          autoFocus
                        />
                      </td>
                      <td colSpan={2} className="flex items-center gap-2">
                        <button
                          onClick={() => handleSavePrice(c)}
                          className="btn-primary text-xs py-1 px-2"
                          disabled={updateMutation.isPending}
                        >
                          Saqlash
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-2">
                          Bekor
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="font-bold text-slate-900">
                        <button onClick={() => startEdit(c)} className="hover:underline cursor-pointer" title="Narxni o'zgartirish">
                          {formatUzs(c.priceUzs)} UZS ✏️
                        </button>
                      </td>
                      <td><StatusBadge value={c.isActive ? 'true' : 'false'} type="active" /></td>
                      <td>
                        <button onClick={() => handleToggleActive(c)} className="btn-secondary text-xs py-1 px-2.5">
                          {c.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {!isLoading && courses.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Kurslar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CoursesPage;
