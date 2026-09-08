import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import type { CommissionRules } from './types';

export const CommissionRulesPage = () => {
  const qc = useQueryClient();
  const { data: rules } = useQuery<CommissionRules>({
    queryKey: ['commission-rules'],
    queryFn: () => api.get('/commission-rules').then((r) => r.data),
  });

  const [form, setForm] = useState({
    teacherSignupBonusUzs: '',
    directorSignupBonusUzs: '',
    teacherMonthlyPercent: '',
    directorMonthlyPercent: '',
  });
  const [saved, setSaved] = useState(false);
  const { confirm, showToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (data: Record<string, number>) => api.put('/commission-rules', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules'] });
      setSaved(true);
      showToast({
        type: 'success',
        title: 'Qoidalar yangilandi',
        message: 'Komissiya qoidalari muvaffaqiyatli saqlandi va barcha keyingi hisob-kitoblarga qo‘llanadi.',
      });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => {
      showToast({
        type: 'error',
        title: 'Xatolik',
        message: 'Komissiya qoidalarini yangilashda xatolik yuz berdi.',
      });
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const teacherBonus = Number(form.teacherSignupBonusUzs || rules?.teacherSignupBonusUzs || 0);
    const directorBonus = Number(form.directorSignupBonusUzs || rules?.directorSignupBonusUzs || 0);
    const teacherPct = Number(form.teacherMonthlyPercent || rules?.teacherMonthlyPercent || 0);
    const directorPct = Number(form.directorMonthlyPercent || rules?.directorMonthlyPercent || 0);

    const confirmed = await confirm({
      title: "Komissiya qoidalarini yangilashni tasdiqlaysizmi?",
      message: "Diqqat: Ushbu stavkalar o'qituvchilar va direktorlarning kelgusi barcha to'lovlariga ta'sir qiladi.",
      variant: "warning",
      details: [
        { label: "O'qituvchi ro'yxat bonusi", value: `${teacherBonus.toLocaleString()} UZS` },
        { label: "Direktor ro'yxat bonusi", value: `${directorBonus.toLocaleString()} UZS` },
        { label: "O'qituvchi oylik ulushi", value: `${teacherPct / 100}% (${teacherPct} b.p.)` },
        { label: "Direktor oylik ulushi", value: `${directorPct / 100}% (${directorPct} b.p.)` },
      ],
      confirmText: "Ha, stavkalarni saqlash",
    });
    if (!confirmed) return;

    mutation.mutate({
      teacherSignupBonusUzs: teacherBonus,
      directorSignupBonusUzs: directorBonus,
      teacherMonthlyPercent: teacherPct,
      directorMonthlyPercent: directorPct,
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="page-title">Komissiya qoidalari</h1>
        <p className="text-sm text-slate-500 mt-0.5">O'qituvchi va direktorlar uchun belgilangan mukofot miqdorlari</p>
      </div>

      {rules && (
        <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">O'qituvchi ro'yxat bonusi</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{rules.teacherSignupBonusUzs.toLocaleString()} UZS</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Direktor ro'yxat bonusi</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{rules.directorSignupBonusUzs.toLocaleString()} UZS</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">O'qituvchi oylik foizi</p>
            <p className="text-lg font-bold text-blue-900 mt-0.5">{(rules.teacherMonthlyPercent / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Direktor oylik foizi</p>
            <p className="text-lg font-bold text-teal-800 mt-0.5">{(rules.directorMonthlyPercent / 100).toFixed(2)}%</p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title mb-4">Qoidalarni yangilash</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">O'qituvchi ro'yxat bonusi (UZS)</label>
            <input
              type="number"
              className="input"
              placeholder={String(rules?.teacherSignupBonusUzs ?? 50000)}
              value={form.teacherSignupBonusUzs}
              onChange={(e) => setForm((p) => ({ ...p, teacherSignupBonusUzs: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Direktor ro'yxat bonusi (UZS)</label>
            <input
              type="number"
              className="input"
              placeholder={String(rules?.directorSignupBonusUzs ?? 100000)}
              value={form.directorSignupBonusUzs}
              onChange={(e) => setForm((p) => ({ ...p, directorSignupBonusUzs: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">O'qituvchi oylik foizi (1000 = 10%)</label>
            <input
              type="number"
              className="input"
              placeholder={String(rules?.teacherMonthlyPercent ?? 1000)}
              value={form.teacherMonthlyPercent}
              onChange={(e) => setForm((p) => ({ ...p, teacherMonthlyPercent: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Direktor oylik foizi (500 = 5%)</label>
            <input
              type="number"
              className="input"
              placeholder={String(rules?.directorMonthlyPercent ?? 500)}
              value={form.directorMonthlyPercent}
              onChange={(e) => setForm((p) => ({ ...p, directorMonthlyPercent: e.target.value }))}
            />
          </div>
          {saved && <div className="notice-success">Qoidalar saqlandi!</div>}
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saqlanmoqda…' : 'Qoidalarni saqlash'}
          </button>
        </form>
      </div>
    </div>
  );
};
