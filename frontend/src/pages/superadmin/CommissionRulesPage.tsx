import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import type { CommissionRules } from './types';
import { formatUzs } from '../../lib/format';
import { AmountInput } from '../../components/AmountInput';

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
    teacherFirstPaymentPercent: '',
    directorFirstPaymentPercent: '',
    specialPriceUzs: '',
    withdrawLimitTeacherUzs: '',
    withdrawLimitDirectorUzs: '',
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
    const teacherFirstPct = Number(form.teacherFirstPaymentPercent || rules?.teacherFirstPaymentPercent || 0);
    const directorFirstPct = Number(form.directorFirstPaymentPercent || rules?.directorFirstPaymentPercent || 0);
    const specialPrice = Number(form.specialPriceUzs || rules?.specialPriceUzs || 0);
    const withdrawLimitTeacher = Number(form.withdrawLimitTeacherUzs || rules?.withdrawLimitTeacherUzs || 0);
    const withdrawLimitDirector = Number(form.withdrawLimitDirectorUzs || rules?.withdrawLimitDirectorUzs || 0);

    const confirmed = await confirm({
      title: "Komissiya qoidalarini yangilashni tasdiqlaysizmi?",
      message: "Diqqat: Ushbu stavkalar o'qituvchilar va direktorlarning kelgusi barcha to'lovlariga ta'sir qiladi.",
      variant: "warning",
      details: [
        { label: "O'qituvchi ro'yxat bonusi", value: `${formatUzs(teacherBonus)} UZS` },
        { label: "Direktor ro'yxat bonusi", value: `${formatUzs(directorBonus)} UZS` },
        { label: "Maxsus narx (bonus hisoblash uchun)", value: specialPrice > 0 ? `${formatUzs(specialPrice)} UZS` : "O'rnatilmagan — to'langan haqiqiy summa ishlatiladi" },
        { label: "O'qituvchi birinchi to'lov foizi", value: `${teacherFirstPct / 100}% (${teacherFirstPct} b.p.)` },
        { label: "Direktor birinchi to'lov foizi", value: `${directorFirstPct / 100}% (${directorFirstPct} b.p.)` },
        { label: "O'qituvchi oylik ulushi", value: `${teacherPct / 100}% (${teacherPct} b.p.)` },
        { label: "Direktor oylik ulushi", value: `${directorPct / 100}% (${directorPct} b.p.)` },
        { label: "O'qituvchi yechib olish limiti", value: withdrawLimitTeacher > 0 ? `${formatUzs(withdrawLimitTeacher)} UZS` : "O'chirilgan" },
        { label: "Direktor yechib olish limiti", value: withdrawLimitDirector > 0 ? `${formatUzs(withdrawLimitDirector)} UZS` : "O'chirilgan" },
      ],
      confirmText: "Ha, stavkalarni saqlash",
    });
    if (!confirmed) return;

    mutation.mutate({
      teacherSignupBonusUzs: teacherBonus,
      directorSignupBonusUzs: directorBonus,
      teacherMonthlyPercent: teacherPct,
      directorMonthlyPercent: directorPct,
      teacherFirstPaymentPercent: teacherFirstPct,
      directorFirstPaymentPercent: directorFirstPct,
      specialPriceUzs: specialPrice,
      withdrawLimitTeacherUzs: withdrawLimitTeacher,
      withdrawLimitDirectorUzs: withdrawLimitDirector,
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
            <p className="text-lg font-bold text-slate-900 mt-0.5">{formatUzs(rules.teacherSignupBonusUzs)} UZS</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Direktor ro'yxat bonusi</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{formatUzs(rules.directorSignupBonusUzs)} UZS</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Maxsus narx (bonus hisoblash uchun)</p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">
              {rules.specialPriceUzs > 0 ? `${formatUzs(rules.specialPriceUzs)} UZS` : "O'rnatilmagan"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">O'qituvchi birinchi to'lov foizi</p>
            <p className="text-lg font-bold text-amber-700 mt-0.5">{(rules.teacherFirstPaymentPercent / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Direktor birinchi to'lov foizi</p>
            <p className="text-lg font-bold text-amber-700 mt-0.5">{(rules.directorFirstPaymentPercent / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">O'qituvchi oylik foizi</p>
            <p className="text-lg font-bold text-blue-900 mt-0.5">{(rules.teacherMonthlyPercent / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Direktor oylik foizi</p>
            <p className="text-lg font-bold text-teal-800 mt-0.5">{(rules.directorMonthlyPercent / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">O'qituvchi yechib olish limiti</p>
            <p className="text-lg font-bold text-purple-700 mt-0.5">
              {rules.withdrawLimitTeacherUzs > 0 ? `${formatUzs(rules.withdrawLimitTeacherUzs)} UZS` : "O'chirilgan"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Direktor yechib olish limiti</p>
            <p className="text-lg font-bold text-purple-700 mt-0.5">
              {rules.withdrawLimitDirectorUzs > 0 ? `${formatUzs(rules.withdrawLimitDirectorUzs)} UZS` : "O'chirilgan"}
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title mb-4">Qoidalarni yangilash</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">O'qituvchi ro'yxat bonusi (UZS)</label>
            <AmountInput
              className="input"
              placeholder={String(rules?.teacherSignupBonusUzs ?? 50000)}
              value={form.teacherSignupBonusUzs}
              onChange={(raw) => setForm((p) => ({ ...p, teacherSignupBonusUzs: raw }))}
            />
          </div>
          <div>
            <label className="label">Direktor ro'yxat bonusi (UZS)</label>
            <AmountInput
              className="input"
              placeholder={String(rules?.directorSignupBonusUzs ?? 100000)}
              value={form.directorSignupBonusUzs}
              onChange={(raw) => setForm((p) => ({ ...p, directorSignupBonusUzs: raw }))}
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="label">Maxsus narx — bonus hisoblash uchun (UZS)</label>
            <AmountInput
              className="input"
              placeholder={String(rules?.specialPriceUzs || 1000000)}
              value={form.specialPriceUzs}
              onChange={(raw) => setForm((p) => ({ ...p, specialPriceUzs: raw }))}
            />
            <p className="text-2xs text-slate-500 mt-1">
              Direktor va o'qituvchi bonuslari (birinchi to'lov ham, keyingi oyliklar ham) shu narxdan hisoblanadi —
              o'quvchi to'lagan haqiqiy summadan emas. Agar 0 qoldirilsa, haqiqiy to'lov summasi ishlatiladi.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Birinchi to'lov bonusi (kattaroq stavka)</p>
            <p className="text-2xs text-slate-500 mb-3">
              Faqat o'quvchining birinchi to'lovida beriladi.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">O'qituvchi birinchi to'lov foizi (1000 = 10%)</label>
                <input
                  type="number"
                  className="input"
                  placeholder={String(rules?.teacherFirstPaymentPercent ?? 2000)}
                  value={form.teacherFirstPaymentPercent}
                  onChange={(e) => setForm((p) => ({ ...p, teacherFirstPaymentPercent: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Direktor birinchi to'lov foizi (1000 = 10%)</label>
                <input
                  type="number"
                  className="input"
                  placeholder={String(rules?.directorFirstPaymentPercent ?? 1000)}
                  value={form.directorFirstPaymentPercent}
                  onChange={(e) => setForm((p) => ({ ...p, directorFirstPaymentPercent: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Oylik bonus (kichikroq stavka, FAOL bo'lganda)</p>
            <div className="space-y-4">
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
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-purple-700 uppercase mb-2">Yechib olish limiti</p>
            <p className="text-2xs text-slate-500 mb-3">
              Kutilayotgan mukofot shu limitga (yoki karrasiga) yetganda, o'qituvchi/direktor o'zi yechib olish so'rovini yuborishi mumkin bo'ladi.
              0 qoldirilsa, ushbu rol uchun yechib olish o'chirilgan bo'ladi.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">O'qituvchi yechib olish limiti (UZS)</label>
                <AmountInput
                  className="input"
                  placeholder={String(rules?.withdrawLimitTeacherUzs || 300000)}
                  value={form.withdrawLimitTeacherUzs}
                  onChange={(raw) => setForm((p) => ({ ...p, withdrawLimitTeacherUzs: raw }))}
                />
              </div>
              <div>
                <label className="label">Direktor yechib olish limiti (UZS)</label>
                <AmountInput
                  className="input"
                  placeholder={String(rules?.withdrawLimitDirectorUzs || 500000)}
                  value={form.withdrawLimitDirectorUzs}
                  onChange={(raw) => setForm((p) => ({ ...p, withdrawLimitDirectorUzs: raw }))}
                />
              </div>
            </div>
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
