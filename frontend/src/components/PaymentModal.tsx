import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';
import { getErrorMessage } from '../lib/errors';
import { formatUzs } from '../lib/format';
import { sameMonthPaymentWarning } from '../lib/payments';
import { AmountInput } from './AmountInput';

interface PaymentModalProps {
  student: { id: number; fullName: string; phone: string };
  onClose: () => void;
  // Query-key prefixes to refresh after a payment is saved (the screens that list this student).
  invalidate: string[];
  // Wording differs by who is paying: the first-payment screens mention commissions.
  confirmMessage: string;
  successSuffix: string;
  notesPlaceholder?: string;
}

// Records a monthly payment for a student. Shared by the Sales Manager / Manager screens
// and the Admin panel; the server decides who may record the first payment and enforces
// the amount cap, so this only reports what the API says.
const PaymentModal = ({ student, onClose, invalidate, confirmMessage, successSuffix, notesPlaceholder }: PaymentModalProps) => {
  const qc = useQueryClient();
  const { confirm, showToast } = useFeedback();
  const [amount, setAmount] = useState('');
  const [paidForMonth, setPaidForMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: existingPayments = [] } = useQuery<{ amountUzs: number; paidForMonth: string; voidedAt?: string | null }[]>({
    queryKey: ['student-payments', String(student.id)],
    queryFn: () => api.get(`/students/${student.id}/monthly-payments`).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (body: { amountUzs: number; paidForMonth: string; paymentMethod?: string; notes?: string }) =>
      api.post(`/students/${student.id}/monthly-payments`, body),
    onSuccess: () => {
      ['student-payments', ...invalidate].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      showToast({
        type: 'success',
        title: "To'lov qabul qilindi",
        message: `${student.fullName} uchun ${formatUzs(Number(amount))} UZS to'lov muvaffaqiyatli saqlandi${successSuffix}`,
      });
      onClose();
    },
    onError: (err: unknown) => {
      const errText = getErrorMessage(err, "To'lovni saqlashda xatolik yuz berdi.");
      setError(errText);
      showToast({ type: 'error', title: 'Xatolik', message: errText });
    },
  });

  const handleSave = async () => {
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError("To'lov summasini to'g'ri kiriting");
      return;
    }

    const duplicateWarning = sameMonthPaymentWarning(existingPayments, paidForMonth);
    const confirmed = await confirm({
      title: "Oylik to'lovni qabul qilishni tasdiqlaysizmi?",
      message: duplicateWarning ?? confirmMessage,
      variant: duplicateWarning ? 'warning' : undefined,
      details: [
        { label: "O'quvchi F.I.SH", value: student.fullName },
        { label: 'Telefon', value: student.phone },
        { label: "To'lov summasi", value: `${formatUzs(numAmount)} UZS` },
        { label: "To'lov oyi", value: paidForMonth },
        {
          label: "To'lov usuli",
          value: paymentMethod === 'CASH' ? 'Naqd pul (CASH)' : paymentMethod === 'CARD' ? 'Karta orqali' : paymentMethod,
        },
      ],
      confirmText: "Ha, to'lovni qabul qilish",
    });
    if (!confirmed) return;

    mutation.mutate({ amountUzs: numAmount, paidForMonth, paymentMethod, notes: notes || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md space-y-4 shadow-xl">
        <div>
          <h2 className="section-title">Oylik to'lovni kiritish</h2>
          <p className="text-xs text-slate-500 mt-0.5">{student.fullName} ({student.phone})</p>
        </div>

        <div>
          <label className="label">To'lov summasi (UZS)</label>
          <AmountInput className="input" placeholder="500000" value={amount} onChange={setAmount} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Qaysi oy uchun</label>
            <input type="month" className="input" value={paidForMonth} onChange={(e) => setPaidForMonth(e.target.value)} required />
          </div>
          <div>
            <label className="label">To'lov usuli</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">Naqd pul (CASH)</option>
              <option value="CARD">Plastik karta (CARD)</option>
              <option value="TRANSFER">O'tkazma (TRANSFER)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            className="input"
            placeholder={notesPlaceholder ?? 'Izoh…'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <div className="notice-error">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saqlanmoqda…' : "To'lovni saqlash"}
          </button>
          <button onClick={onClose} className="btn-secondary">Bekor qilish</button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
