import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import StatusBadge from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import type { Payout, PayoutBalanceRow } from './types';

const formatUzs = (n: number) => n.toLocaleString('uz-UZ', { maximumFractionDigits: 0 });

const TYPE_LABELS: Record<Payout['type'], string> = {
  INITIAL_BONUS: "Boshlang'ich bonus",
  CREDIT: "Qo'shildi",
  DEBIT: 'Ayrildi',
};

export const PayoutsPage = () => {
  const qc = useQueryClient();
  const { confirm, showToast } = useFeedback();
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'DIRECTOR' | 'TEACHER'>('ALL');

  const { data: balances = [], isLoading: balancesLoading } = useQuery<PayoutBalanceRow[]>({
    queryKey: ['payout-balances'],
    queryFn: () => api.get('/payouts/balances').then((r) => r.data),
  });

  const { data: allPayouts = [] } = useQuery<Payout[]>({
    queryKey: ['payouts', 'all'],
    queryFn: () => api.get('/payouts').then((r) => r.data),
  });

  const balanceByUserId = new Map(balances.map((b) => [b.userId, b]));
  const filteredBalances = balances.filter((b) => roleFilter === 'ALL' || b.role === roleFilter);
  const pendingPayouts = allPayouts.filter((p) => p.status === 'PENDING');

  const [form, setForm] = useState({ receiverId: '', amountUzs: '', type: 'CREDIT' as 'CREDIT' | 'DEBIT', comments: '' });

  const createMutation = useMutation({
    mutationFn: (body: { receiverId: number; amountUzs: number; type: 'CREDIT' | 'DEBIT'; comments?: string }) =>
      api.post('/payouts', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payouts'] });
      qc.invalidateQueries({ queryKey: ['payout-balances'] });
      setForm({ receiverId: '', amountUzs: '', type: 'CREDIT', comments: '' });
      showToast({ type: 'success', title: "To'lov yaratildi", message: "Tasdiqlangach balansga qo'shiladi." });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "To'lov yaratishda xatolik yuz berdi.") });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/payouts/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payouts'] });
      qc.invalidateQueries({ queryKey: ['payout-balances'] });
      showToast({ type: 'success', title: "To'lov tasdiqlandi", message: 'Balansga qo\'shildi.' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/payouts/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payouts'] });
      showToast({ type: 'info', title: "To'lov bekor qilindi" });
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const receiver = balances.find((b) => b.userId === Number(form.receiverId));
    const amount = Number(form.amountUzs);

    const confirmed = await confirm({
      title: form.type === 'CREDIT' ? "Balansga pul qo'shishni tasdiqlaysizmi?" : "Balansdan pul ayirishni tasdiqlaysizmi?",
      message: "Bu amal PENDING holatida yaratiladi va faqat alohida tasdiqlashdan so'ng balansga ta'sir qiladi.",
      details: [
        { label: 'Qabul qiluvchi', value: receiver ? `${receiver.fullName} (${receiver.role})` : form.receiverId },
        { label: 'Miqdori', value: `${formatUzs(amount)} UZS` },
        { label: 'Turi', value: form.type === 'CREDIT' ? "Qo'shish" : 'Ayirish' },
      ],
      variant: form.type === 'DEBIT' ? 'warning' : 'primary',
      confirmText: "Ha, yaratish",
    });
    if (!confirmed) return;

    createMutation.mutate({
      receiverId: Number(form.receiverId),
      amountUzs: amount,
      type: form.type,
      comments: form.comments || undefined,
    });
  };

  const handleComplete = async (payout: Payout) => {
    const receiver = balanceByUserId.get(payout.receiverId);
    const confirmed = await confirm({
      title: "To'lovni tasdiqlaysizmi?",
      message: "Tasdiqlangach bu miqdor qabul qiluvchining balansiga qo'shiladi/ayiriladi va qaytarib bo'lmaydi.",
      details: [
        { label: 'Qabul qiluvchi', value: receiver?.fullName ?? `#${payout.receiverId}` },
        { label: 'Miqdori', value: `${formatUzs(payout.amountUzs)} UZS` },
        { label: 'Turi', value: TYPE_LABELS[payout.type] },
      ],
      confirmText: 'Ha, tasdiqlash',
    });
    if (!confirmed) return;
    completeMutation.mutate(payout.id);
  };

  const handleCancel = async (payout: Payout) => {
    const confirmed = await confirm({
      title: "To'lovni bekor qilasizmi?",
      message: 'Bekor qilingan to\'lov balansga ta\'sir qilmaydi.',
      variant: 'danger',
      confirmText: 'Ha, bekor qilish',
    });
    if (!confirmed) return;
    cancelMutation.mutate(payout.id);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">To'lovlar va balanslar</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Direktor va o'qituvchilarning balansini kuzatish, qo'lda pul qo'shish yoki ayirish
        </p>
      </div>

      {/* Balances table */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">Balanslar</h2>
          <div className="flex gap-1.5">
            {(['ALL', 'DIRECTOR', 'TEACHER'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                  roleFilter === r ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {r === 'ALL' ? 'Barchasi' : r === 'DIRECTOR' ? 'Direktorlar' : "O'qituvchilar"}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Rol</th>
                <th>Telefon</th>
                <th>Balans</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map((b) => (
                <tr key={b.userId}>
                  <td className="font-semibold text-slate-900">{b.fullName}</td>
                  <td className="text-xs text-slate-500">{b.role === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"}</td>
                  <td className="font-mono text-xs">{b.phone}</td>
                  <td className="font-bold text-slate-900">{formatUzs(b.balanceUzs)} UZS</td>
                </tr>
              ))}
              {!balancesLoading && filteredBalances.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-400">Hech kim topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / subtract form */}
      <div className="card">
        <h2 className="section-title mb-4">Qo'lda to'lov yaratish</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Qabul qiluvchi</label>
            <select
              className="input"
              value={form.receiverId}
              onChange={(e) => setForm({ ...form, receiverId: e.target.value })}
              required
            >
              <option value="">-- Tanlang --</option>
              {balances.map((b) => (
                <option key={b.userId} value={b.userId}>
                  {b.fullName} — {b.role === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Turi</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'CREDIT' | 'DEBIT' })}
            >
              <option value="CREDIT">Qo'shish (+)</option>
              <option value="DEBIT">Ayirish (-)</option>
            </select>
          </div>
          <div>
            <label className="label">Miqdori (UZS)</label>
            <input
              type="number"
              className="input"
              min={1}
              value={form.amountUzs}
              onChange={(e) => setForm({ ...form, amountUzs: e.target.value })}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Izoh</label>
            <input
              type="text"
              className="input"
              placeholder="Masalan: bonus, jarima, tuzatish sababi..."
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Yaratilmoqda…' : "To'lov yaratish"}
            </button>
          </div>
        </form>
      </div>

      {/* Pending approvals */}
      <div className="card space-y-3">
        <h2 className="section-title">Tasdiqlanishi kerak ({pendingPayouts.length})</h2>
        {pendingPayouts.length === 0 ? (
          <p className="text-center py-4 text-slate-400 text-sm">Kutilayotgan to'lovlar yo'q</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Qabul qiluvchi</th>
                  <th>Turi</th>
                  <th>Miqdori</th>
                  <th>Izoh</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayouts.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{balanceByUserId.get(p.receiverId)?.fullName ?? `#${p.receiverId}`}</td>
                    <td>{TYPE_LABELS[p.type]}</td>
                    <td className="font-bold">{formatUzs(p.amountUzs)} UZS</td>
                    <td className="text-slate-500 text-xs">{p.comments ?? '—'}</td>
                    <td className="flex gap-2">
                      <button onClick={() => handleComplete(p)} className="btn-primary text-xs px-2 py-1">
                        Tasdiqlash
                      </button>
                      <button onClick={() => handleCancel(p)} className="btn-secondary text-xs px-2 py-1">
                        Bekor qilish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full history */}
      <div className="card space-y-3">
        <h2 className="section-title">To'lovlar tarixi</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Qabul qiluvchi</th>
                <th>Turi</th>
                <th>Miqdori</th>
                <th>Holati</th>
                <th>Izoh</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {allPayouts.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">{balanceByUserId.get(p.receiverId)?.fullName ?? `#${p.receiverId}`}</td>
                  <td>{TYPE_LABELS[p.type]}</td>
                  <td className={`font-semibold ${p.type === 'DEBIT' ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {p.type === 'DEBIT' ? '-' : '+'}
                    {formatUzs(p.amountUzs)} UZS
                  </td>
                  <td><StatusBadge value={p.status} type="payout" /></td>
                  <td className="text-slate-500 text-xs">{p.comments ?? '—'}</td>
                  <td className="text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</td>
                </tr>
              ))}
              {allPayouts.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400">To'lovlar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
