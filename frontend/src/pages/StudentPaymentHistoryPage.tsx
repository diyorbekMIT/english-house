import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';

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
  createdAt: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Naqd pul',
  CARD: 'Karta orqali',
  TRANSFER: "O'tkazma",
};

const formatUzs = (n: number) => n.toLocaleString('uz-UZ', { maximumFractionDigits: 0 });

export const StudentPaymentHistoryPage = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: student, isLoading: studentLoading } = useQuery<StudentDetail>({
    queryKey: ['student', studentId],
    queryFn: () => api.get(`/students/${studentId}`).then((r) => r.data),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['student-payments', studentId],
    queryFn: () => api.get(`/students/${studentId}/monthly-payments`).then((r) => r.data),
  });

  const totalPaidUzs = payments.reduce((sum, p) => sum + p.amountUzs, 0);

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
          <p className="text-2xl font-bold text-slate-900 mt-1">{payments.length}</p>
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
              </tr>
            </thead>
            <tbody>
              {paymentsLoading && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className={p.isFirstPayment ? 'bg-emerald-50/50' : undefined}>
                  <td className="font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>{p.paidForMonth}</span>
                      {p.isFirstPayment && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                          ★ Birinchi to'lov
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="font-bold text-emerald-700">{formatUzs(p.amountUzs)} UZS</td>
                  <td className="text-xs text-slate-600">
                    {p.paymentMethod ? PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod : '—'}
                  </td>
                  <td className="text-xs text-slate-500 max-w-xs truncate" title={p.notes ?? undefined}>
                    {p.notes || '—'}
                  </td>
                  <td className="text-xs text-slate-700">{p.createdByName ?? '—'}</td>
                  <td className="text-slate-400 text-xs">{new Date(p.paidAt).toLocaleDateString('uz-UZ')}</td>
                </tr>
              ))}
              {!paymentsLoading && payments.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">To'lovlar tarixi bo'sh</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentPaymentHistoryPage;
