import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface School {
  id: number;
  name: string;
  schoolNumber?: string | null;
}

interface Teacher {
  id: number;
  fullName: string;
  phone: string;
}

interface FirstPayment {
  id: number;
  amountUzs: number;
  paidForMonth: string;
  paidAt: string;
  paymentMethod?: string | null;
  notes?: string | null;
  createdAt: string;
  createdByName?: string | null;
  studentId: number;
  studentFullName: string;
  studentPhone: string;
  schoolId: number | null;
  schoolName?: string | null;
  schoolNumber?: string | null;
  teacherId: number | null;
  teacherName?: string | null;
  teacherPhone?: string | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Naqd pul',
  CARD: 'Karta orqali',
  TRANSFER: "O'tkazma",
};

const formatUzs = (n: number) => n.toLocaleString('uz-UZ', { maximumFractionDigits: 0 });

const ROLE_BASE_PATH: Record<string, string> = {
  SUPER_ADMIN: '/superadmin',
  MANAGER: '/manager',
  SALES_MANAGER: '/sales-manager',
};

export const FirstPaymentsPage = () => {
  const { user } = useAuth();
  const basePath = (user?.role && ROLE_BASE_PATH[user.role]) || '/superadmin';
  const [schoolFilter, setSchoolFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools'],
    queryFn: () => api.get('/schools').then((r) => r.data),
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ['users', 'TEACHER'],
    queryFn: () => api.get('/users?role=TEACHER').then((r) => r.data),
  });

  const params = new URLSearchParams();
  if (schoolFilter) params.set('schoolId', schoolFilter);
  if (teacherFilter) params.set('teacherId', teacherFilter);

  const { data: payments = [], isLoading } = useQuery<FirstPayment[]>({
    queryKey: ['first-payments', schoolFilter, teacherFilter],
    queryFn: () => api.get(`/first-payments?${params.toString()}`).then((r) => r.data),
  });

  const totalUzs = payments.reduce((sum, p) => sum + p.amountUzs, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Birinchi to'lovlar</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Har bir o'quvchining birinchi oylik to'lovi — yangi yaratilganlardan boshlab
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="input w-full sm:w-auto text-sm"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          <option value="">Barcha maktablar (umumiy)</option>
          {schools.map((sch) => (
            <option key={sch.id} value={sch.id}>
              № {sch.schoolNumber || sch.id} — {sch.name}
            </option>
          ))}
        </select>
        <select
          className="input w-full sm:w-auto text-sm"
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
        >
          <option value="">Barcha o'qituvchilar (umumiy)</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
        {(schoolFilter || teacherFilter) && (
          <button
            type="button"
            onClick={() => { setSchoolFilter(''); setTeacherFilter(''); }}
            className="text-xs text-blue-900 hover:underline"
          >
            Filtrlarni tozalash
          </button>
        )}
        <span className="text-xs text-slate-500 sm:ml-auto font-medium">
          Topildi: {payments.length} ta birinchi to'lov
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            Birinchi to'lovlar soni
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{payments.length}</p>
        </div>
        <div className="stat-card border-emerald-200 bg-emerald-50/30 col-span-2 sm:col-span-1">
          <span className="text-2xs font-semibold text-emerald-800 uppercase tracking-wider block">
            Jami summa
          </span>
          <p className="text-xl font-bold text-emerald-700 mt-1">{formatUzs(totalUzs)} UZS</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>O'quvchi</th>
                <th>Maktab</th>
                <th>O'qituvchi</th>
                <th>Summa</th>
                <th>Oy</th>
                <th>To'lov usuli</th>
                <th>Qabul qildi</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="font-semibold text-slate-900">
                    <Link
                      to={`${basePath}/students/${p.studentId}/payments`}
                      className="hover:text-blue-900 hover:underline"
                    >
                      {p.studentFullName}
                    </Link>
                    <span className="block font-mono text-[10px] text-slate-400">{p.studentPhone}</span>
                  </td>
                  <td>
                    {p.schoolId ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900">
                          № {p.schoolNumber || p.schoolId}
                        </span>
                        <span className="text-xs text-slate-700">{p.schoolName}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    {p.teacherName ? (
                      <div>
                        <span className="text-xs font-semibold text-blue-900">👨‍🏫 {p.teacherName}</span>
                        {p.teacherPhone && (
                          <span className="block font-mono text-[10px] text-slate-400">{p.teacherPhone}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="font-bold text-emerald-700">{formatUzs(p.amountUzs)} UZS</td>
                  <td className="text-xs text-slate-600">{p.paidForMonth}</td>
                  <td className="text-xs text-slate-600">
                    {p.paymentMethod ? PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod : '—'}
                  </td>
                  <td className="text-xs text-slate-700">{p.createdByName ?? '—'}</td>
                  <td className="text-slate-400 text-xs">{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</td>
                </tr>
              ))}
              {!isLoading && payments.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">Birinchi to'lovlar topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FirstPaymentsPage;
