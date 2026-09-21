import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import StatusBadge from '../components/StatusBadge';
import CommentModal from '../components/CommentModal';
import { formatUzs } from '../lib/format';
import { getErrorMessage } from '../lib/errors';

interface StudentDetail {
  id: number;
  fullName: string;
  phone: string;
  secondaryPhone?: string | null;
  schoolId?: number | null;
  callStatus: string;
  studyStatus: string;
  meta?: { subject?: string } | null;
}

interface Payment {
  id: number;
  studentId: number;
  amountUzs: number;
  paidForMonth: string;
  paidAt: string;
  paymentMethod?: string | null;
  notes?: string | null;
  createdByUserId: number;
  createdByName?: string | null;
  isFirstPayment?: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Naqd pul',
  CARD: 'Karta orqali',
  TRANSFER: "O'tkazma",
};

export const StudentPaymentHistoryPage = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { showToast } = useFeedback();
  const [voiding, setVoiding] = useState<Payment | null>(null);

  const { data: student, isLoading: studentLoading } = useQuery<StudentDetail>({
    queryKey: ['student', studentId],
    queryFn: () => api.get(`/students/${studentId}`).then((r) => r.data),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['student-payments', studentId],
    queryFn: () => api.get(`/students/${studentId}/monthly-payments`).then((r) => r.data),
  });

  const activePayments = payments.filter((p) => !p.voidedAt);
  const totalPaidUzs = activePayments.reduce((sum, p) => sum + p.amountUzs, 0);

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.patch(`/students/${studentId}/monthly-payments/${id}/void`, { reason }),
    onSuccess: () => {
      ['student-payments', 'student', 'students', 'admin-students', 'commissions', 'payout-balances', 'first-payments'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      setVoiding(null);
      showToast({
        type: 'success',
        title: "To'lov bekor qilindi",
        message: "To'lovdan hisoblangan komissiyalar ham bekor qilindi.",
      });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "To'lovni bekor qilishda xatolik yuz berdi.") });
    },
  });

  const isCeo = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-slate-700 text-sm"
          title="Orqaga"
        >
          ← Orqaga
        </button>
        <div>
          <h1 className="page-title">To'lovlar tarixi</h1>
          <p className="text-sm text-slate-500 mt-0.5">O'quvchining barcha oylik to'lovlari</p>
        </div>
      </div>

      {studentLoading ? (
        <div className="card p-8 text-center text-slate-400">Yuklanmoqda…</div>
      ) : student ? (
        <div className="card space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{student.fullName}</h2>
              <p className="font-mono text-xs text-blue-900 font-bold mt-0.5">
                {student.phone}
                {student.secondaryPhone && <span className="text-slate-400"> · {student.secondaryPhone}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={student.callStatus} type="call" />
              <StatusBadge value={student.studyStatus} type="study" />
            </div>
          </div>
          {student.schoolId && user?.role === 'SUPER_ADMIN' && (
            <Link
              to={`/superadmin/schools/${student.schoolId}`}
              className="text-xs text-blue-900 hover:underline inline-block"
            >
              Maktab sahifasiga o'tish →
            </Link>
          )}
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-400">O'quvchi topilmadi</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            Jami to'lovlar soni
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activePayments.length}</p>
        </div>
        <div className="stat-card border-emerald-200 bg-emerald-50/30 col-span-2 sm:col-span-1">
          <span className="text-2xs font-semibold text-emerald-800 uppercase tracking-wider block">
            Jami to'langan summa
          </span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{formatUzs(totalPaidUzs)} UZS</p>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">To'lovlar ro'yxati</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Oy</th>
                <th>Summa</th>
                <th>To'lov usuli</th>
                <th>Izoh</th>
                <th>Kim qabul qildi</th>
                <th>Sana</th>
                {isCeo && <th>Amal</th>}
              </tr>
            </thead>
            <tbody>
              {paymentsLoading && (
                <tr><td colSpan={isCeo ? 7 : 6} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className={p.voidedAt ? 'bg-slate-50 text-slate-400' : p.isFirstPayment ? 'bg-emerald-50/50' : undefined}
                >
                  <td className="font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className={p.voidedAt ? 'line-through' : undefined}>{p.paidForMonth}</span>
                      {p.voidedAt && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                          Bekor qilingan
                        </span>
                      )}
                      {p.isFirstPayment && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                          ★ Birinchi to'lov
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`font-bold ${p.voidedAt ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                    {formatUzs(p.amountUzs)} UZS
                  </td>
                  <td className="text-xs text-slate-600">
                    {p.paymentMethod ? PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod : '—'}
                  </td>
                  <td className="text-xs text-slate-500 max-w-xs" title={p.notes ?? undefined}>
                    {p.voidedAt ? (
                      <span className="text-rose-700">Sabab: {p.voidReason ?? '—'}</span>
                    ) : (
                      <span className="truncate block">{p.notes || '—'}</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-700">{p.createdByName ?? '—'}</td>
                  <td className="text-slate-400 text-xs">{new Date(p.paidAt).toLocaleDateString('uz-UZ')}</td>
                  {isCeo && (
                    <td>
                      {!p.voidedAt && (
                        <button onClick={() => setVoiding(p)} className="btn-danger text-xs px-2 py-1">
                          Bekor qilish
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!paymentsLoading && payments.length === 0 && (
                <tr><td colSpan={isCeo ? 7 : 6} className="text-center py-8 text-slate-400">To'lovlar tarixi bo'sh</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {voiding && (
        <CommentModal
          title="To'lovni bekor qilasizmi?"
          message="To'lov tarixda saqlanadi, lekin daromad va bonuslarga hisoblanmaydi. Undan hisoblangan o'qituvchi va direktor komissiyalari ham bekor qilinadi."
          rows={[
            { label: "O'quvchi", value: student?.fullName ?? '—' },
            { label: 'Oy', value: voiding.paidForMonth },
            { label: 'Summa', value: `${formatUzs(voiding.amountUzs)} UZS` },
            ...(voiding.isFirstPayment
              ? [{ label: 'Diqqat', value: "Birinchi to'lov — o'quvchi FAOL EMAS holatiga qaytadi" }]
              : []),
          ]}
          commentLabel="Bekor qilish sababi (majburiy)"
          placeholder="Masalan: ikki marta kiritilgan"
          required
          confirmText="Ha, bekor qilish"
          danger
          isPending={voidMutation.isPending}
          onClose={() => setVoiding(null)}
          onSubmit={(reason) => voidMutation.mutate({ id: voiding.id, reason })}
        />
      )}
    </div>
  );
};

export default StudentPaymentHistoryPage;
