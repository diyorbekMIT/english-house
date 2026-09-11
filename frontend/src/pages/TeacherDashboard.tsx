import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import {
  StudyStatusBreakdownChart,
  DailyStudentTrendChart,
  type DailyStudentItem,
} from '../components/Charts';
import CommissionCreditCard from '../components/CommissionCreditCard';
import PayoutHistoryList from '../components/PayoutHistoryList';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/errors';
import type { Payout } from './superadmin/types';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Student {
  id: number;
  fullName: string;
  phone: string;
  secondaryPhone?: string | null;
  studyStatus: string;
  callStatus: string;
  callNote?: string | null;
  createdAt: string;
  meta?: { grade?: string; course_interest?: string; parent_name?: string } | null;
}

interface Commission {
  id: number;
  amountUzs: number;
  type: string;
  status: string;
  createdAt: string;
}

interface TeacherSummaryResponse {
  summary: {
    school: {
      id: number;
      name: string;
      schoolNumber: string;
    } | null;
    subject: string;
    totalStudents: number;
    studyingStudents: number;
    stoppedStudents: number;
    waitingLeads: number;
    acceptedLeads: number;
    rejectedLeads: number;
    studyConversionPercent: number;
    totalCommissionUzs: number;
    paidCommissionUzs: number;
    pendingCommissionUzs: number;
    payoutsNetUzs: number;
    balanceUzs: number;
  };
  dailyTrends: DailyStudentItem[];
  students: Student[];
}

// ── 1. TEACHER OVERVIEW DASHBOARD WITH CHARTS ──────────────────────────────────
const TeacherOverviewDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'NOACTIVE' | 'WAITING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<TeacherSummaryResponse>({
    queryKey: ['teacher-summary'],
    queryFn: () => api.get('/analytics/teacher-summary').then((r) => r.data),
  });

  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ['payouts'],
    queryFn: () => api.get('/payouts').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="card p-12 text-center text-slate-400">
        <span className="animate-spin inline-block mr-2">⏳</span>
        O'quvchilaringiz ko'rsatkichlari yuklanmoqda…
      </div>
    );
  }

  const summary = data?.summary ?? {
    school: null,
    subject: '—',
    totalStudents: 0,
    studyingStudents: 0,
    stoppedStudents: 0,
    waitingLeads: 0,
    acceptedLeads: 0,
    rejectedLeads: 0,
    studyConversionPercent: 0,
    totalCommissionUzs: 0,
    paidCommissionUzs: 0,
    pendingCommissionUzs: 0,
    payoutsNetUzs: 0,
    balanceUzs: 0,
  };

  const dailyTrends = data?.dailyTrends ?? [];
  const allStudents = data?.students ?? [];

  // Filter students by tab & search
  const filteredStudents = allStudents.filter((s) => {
    if (filterStatus === 'ACTIVE' && s.studyStatus !== 'ACTIVE') return false;
    if (filterStatus === 'NOACTIVE' && s.studyStatus !== 'NOACTIVE') return false;
    if (filterStatus === 'WAITING' && s.callStatus !== 'WAITING') return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.secondaryPhone && s.secondaryPhone.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Teacher Header Banner */}
      <div className="card bg-gradient-to-r from-blue-900 to-teal-900 text-white p-6 border-0 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-xs mb-2">
              <span>👨‍🏫</span>
              <span>
                {summary.school ? `№ ${summary.school.schoolNumber} — ${summary.school.name}` : 'Maktab'}
              </span>
              <span>•</span>
              <span>{summary.subject}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              O'qituvchi Boshqaruv Paneli
            </h1>
            <p className="text-teal-100 text-xs sm:text-sm mt-1 max-w-2xl">
              Siz orqali o'quv markaziga tavsiya qilingan o'quvchilar, ularning darslarga qatnashishi (o'qish holati) va sizga hisoblangan bonuslar
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Qayta yuklash"
            >
              <span className={isFetching ? 'animate-spin inline-block' : ''}>🔄</span>
              Yangilash
            </button>
            <button
              onClick={() => navigate('/teacher/students/new')}
              className="btn bg-white text-blue-950 hover:bg-teal-50 text-xs font-bold shadow-sm"
            >
              + Yangi o'quvchi qo'shish
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Students */}
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            Jami o'quvchilarim
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalStudents}</p>
          <span className="text-2xs text-blue-700 font-medium">Kiritilgan lidlar</span>
        </div>

        {/* 2. Studying Students */}
        <div className="stat-card border-emerald-200 bg-emerald-50/30">
          <span className="text-2xs font-semibold text-emerald-800 uppercase tracking-wider block">
            O'qiyotganlar
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.studyingStudents}</p>
          <span className="text-2xs text-emerald-700 font-bold">
            {summary.studyConversionPercent}% markazda o'qimoqda
          </span>
        </div>

        {/* 3. Stopped Students */}
        <div className="stat-card border-rose-200 bg-rose-50/30">
          <span className="text-2xs font-semibold text-rose-800 uppercase tracking-wider block">
            To'xtatganlar
          </span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{summary.stoppedStudents}</p>
          <span className="text-2xs text-rose-600 font-medium">Darsga qatnamayotgan</span>
        </div>

        {/* 4. Accepted Leads */}
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            Qabul qilingan
          </span>
          <p className="text-2xl font-bold text-teal-700 mt-1">{summary.acceptedLeads}</p>
          <span className="text-2xs text-teal-600 font-medium">Call-markaz tasdiqlagan</span>
        </div>

        {/* 5. Waiting Leads */}
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            Kutilmoqda
          </span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.waitingLeads}</p>
          <span className="text-2xs text-amber-700 font-medium">Qo'ng'iroq jarayonida</span>
        </div>

        {/* 6. Commission */}
        <div className="stat-card border-teal-200 bg-teal-50/30">
          <span className="text-2xs font-semibold text-teal-800 uppercase tracking-wider block">
            Mening komissiyam
          </span>
          <p className="text-xl font-bold text-teal-900 mt-1">
            {(summary.totalCommissionUzs / 1000).toFixed(0)}k <span className="text-xs font-normal">UZS</span>
          </p>
          <span className="text-2xs text-teal-700 font-medium">
            To'langan: {(summary.paidCommissionUzs / 1000).toFixed(0)}k
          </span>
        </div>
      </div>

      {/* Visual Charts Row */}
     {/* Visual Row: Charts + Commission Credit Card */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2 grid grid-cols-1 gap-6">
    <StudyStatusBreakdownChart
      total={summary.totalStudents}
      studying={summary.studyingStudents}
      stopped={summary.stoppedStudents}
      waiting={summary.waitingLeads}
      accepted={summary.acceptedLeads}
      title="O'quvchilarimning markazda o'qish ko'rsatkichi"
      subtitle="O'quv markazida faol o'qiyotgan va to'xtatgan o'quvchilaringiz nisbati"
    />
    <DailyStudentTrendChart
      data={dailyTrends}
      title="Kunlik o'quvchilar kiritish dinamikangiz (14 kun)"
      subtitle="Har bir kun 0 dan boshlanadi — kunlik kiritilgan o'quvchilar va ularning darsga qatnashishi"
    />
  </div>

  <div className="flex flex-col gap-4">
    <CommissionCreditCard
      schoolName={summary.school ? `№ ${summary.school.schoolNumber} — ${summary.school.name}` : undefined}
      subject={summary.subject}
      holderName={user?.fullName ?? "O'qituvchi"}
      totalUzs={summary.balanceUzs}
      paidUzs={summary.paidCommissionUzs + summary.payoutsNetUzs}
      pendingUzs={summary.pendingCommissionUzs}
    />
    <div className="card p-4 text-center">
      <p className="text-xs text-slate-500">
        💡 Balans har safar sahifa yangilanganda yangilanadi.
      </p>
    </div>
  </div>
</div>

      {/* Payout history (initial bonus + CEO adjustments) */}
      <div className="card space-y-3">
        <h2 className="section-title">To'lovlar tarixi</h2>
        <PayoutHistoryList payouts={payouts} />
      </div>

      {/* Students Status Table */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="section-title">O'quvchilarim ro'yxati ({allStudents.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Har bir o'quvchingizning markazdagi joriy o'qish holatini kuzatib boring
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="O'quvchi ismi yoki telefon…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input text-xs py-1.5 px-3 w-56"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterStatus === 'ALL'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Barchasi ({allStudents.length})
          </button>
          <button
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterStatus === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            🟢 O'qiyotganlar ({summary.studyingStudents})
          </button>
          <button
            onClick={() => setFilterStatus('NOACTIVE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterStatus === 'NOACTIVE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
            }`}
          >
            🔴 To'xtatganlar ({summary.stoppedStudents})
          </button>
          <button
            onClick={() => setFilterStatus('WAITING')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterStatus === 'WAITING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            🟡 Kutilayotganlar ({summary.waitingLeads})
          </button>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Telefon</th>
                <th>Qo'shimcha tel</th>
                <th>Qo'ng'iroq holati</th>
                <th>O'quv markazida o'qishi</th>
                <th>Kiritilgan sana</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="font-semibold text-slate-900 text-xs">{s.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
                  <td className="font-mono text-xs text-slate-500">{s.secondaryPhone ?? '—'}</td>
                  <td>
                    <StatusBadge value={s.callStatus} type="call" />
                    {s.callNote && (
                      <span className="block mt-1 text-[11px] text-slate-500 italic max-w-xs truncate" title={s.callNote}>
                        Izoh: {s.callNote}
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge value={s.studyStatus} type="study" />
                  </td>
                  <td className="text-slate-400 text-xs whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Mos o'quvchilar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── 2. STUDENTS LIST PAGE (FULL TAB) ───────────────────────────────────────────
const TeacherStudentsPage = () => {
  const navigate = useNavigate();
  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: () => api.get('/students').then((r) => r.data),
  });

  const studying = students.filter((s) => s.studyStatus === 'ACTIVE').length;
  const stopped = students.filter((s) => s.studyStatus === 'NOACTIVE').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Mening o'quvchilarim</h1>
          <p className="text-sm text-slate-500 mt-0.5">Siz orqali markazga jalb qilingan o'quvchilar</p>
        </div>
        <button onClick={() => navigate('/teacher/students/new')} className="btn-primary shrink-0">
          + Yangi o'quvchi qo'shish
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase">Jami o'quvchilar</p>
          <p className="text-2xl font-bold text-slate-900">{students.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-emerald-800 uppercase">O'qiyotganlar</p>
          <p className="text-2xl font-bold text-emerald-600">{studying}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-rose-800 uppercase">O'qimayotganlar</p>
          <p className="text-2xl font-bold text-rose-600">{stopped}</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Telefon</th>
                <th>Qo'shimcha tel</th>
                <th>Qo'ng'iroq</th>
                <th>O'qish holati</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>}
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-slate-900">{s.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
                  <td className="font-mono text-xs text-slate-500">{s.secondaryPhone ?? '—'}</td>
                  <td>
                    <StatusBadge value={s.callStatus} type="call" />
                    {s.callNote && (
                      <span className="block mt-1 text-[11px] text-slate-500 italic max-w-xs truncate" title={s.callNote}>
                        Izoh: {s.callNote}
                      </span>
                    )}
                  </td>
                  <td><StatusBadge value={s.studyStatus} type="study" /></td>
                  <td className="text-slate-400 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!isLoading && students.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Hozircha o'quvchilar kiritilmagan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── 3. NEW STUDENT FORM PAGE ───────────────────────────────────────────────────
const NewStudentPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    secondaryPhone: '',
    grade: '',
    courseInterest: '',
    parentName: '',
  });
  const [msg, setMsg] = useState('');
  const { confirm, showToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (body: {
      fullName: string;
      phone: string;
      secondaryPhone?: string;
      meta?: { grade?: string; course_interest?: string; parent_name?: string };
    }) => api.post('/students', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['teacher-summary'] });
      showToast({
        type: 'success',
        title: "O'quvchi ro'yxatdan o'tkazildi",
        message: "Yangi o'quvchi muvaffaqiyatli saqlandi va markaz qabul navbatiga qo'shildi!",
      });
      navigate('/teacher/students');
    },
    onError: (err: unknown) => {
      const serverMsg = getErrorMessage(err, "Xatolik yuz berdi. Ma'lumotlarni qayta tekshiring.");
      setMsg(serverMsg);
      showToast({
        type: 'error',
        title: 'Xatolik yuz berdi',
        message: serverMsg,
      });
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const confirmed = await confirm({
      title: "O'quvchini ro'yxatdan o'tkazishni tasdiqlaysizmi?",
      message: "Kiritilgan ma'lumotlar ta'lim markazi ma'muriyatiga yuboriladi va qo'ng'iroqlar navbatiga qo'shiladi.",
      details: [
        { label: "O'quvchi F.I.SH", value: form.fullName },
        { label: "Telefon raqam", value: form.phone },
        { label: "Qo'shimcha telefon", value: form.secondaryPhone || "Ko'rsatilmagan" },
        { label: "Qiziqqan kursi / Sinf", value: `${form.grade || ''} ${form.courseInterest || ''}`.trim() || 'Umumiy kurs' },
        { label: "Ota-onasi", value: form.parentName || 'Kiritilmagan' },
      ],
      confirmText: "Ha, ro'yxatdan o'tkazish",
    });
    if (!confirmed) return;

    mutation.mutate({
      fullName: form.fullName,
      phone: form.phone,
      secondaryPhone: form.secondaryPhone || undefined,
      meta: {
        grade: form.grade || undefined,
        course_interest: form.courseInterest || undefined,
        parent_name: form.parentName || undefined,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Yangi o'quvchi ro'yxatdan o'tkazish</h1>
        <p className="text-sm text-slate-500 mt-0.5">Markazga tavsiya qilinayotgan o'quvchi ma'lumotlari</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">O'quvchi F.I.SH</label>
            <input
              type="text"
              className="input"
              placeholder="Familiya Ism Sharif"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Asosiy telefon raqam</label>
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
              <label className="label">Qo'shimcha telefon (ota-ona)</label>
              <input
                type="tel"
                className="input"
                placeholder="+998901112233"
                value={form.secondaryPhone}
                onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Sinfi / Yoshi</label>
              <input
                type="text"
                className="input"
                placeholder="9-sinf"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Qiziqqan kursi</label>
              <input
                type="text"
                className="input"
                placeholder="IELTS, General English"
                value={form.courseInterest}
                onChange={(e) => setForm({ ...form, courseInterest: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ota-onasi ismi</label>
              <input
                type="text"
                className="input"
                placeholder="Otasining ismi"
                value={form.parentName}
                onChange={(e) => setForm({ ...form, parentName: e.target.value })}
              />
            </div>
          </div>

          {msg && <div className="notice-error">{msg}</div>}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saqlanmoqda…' : "O'quvchini qo'shish"}
            </button>
            <button type="button" onClick={() => navigate('/teacher/students')} className="btn-secondary">
              Bekor qilish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── 4. COMMISSIONS PAGE ────────────────────────────────────────────────────────
const TeacherCommissionsPage = () => {
  const { user } = useAuth();
  const { data: commissions = [] } = useQuery<Commission[]>({
    queryKey: ['commissions'],
    queryFn: () => api.get('/commissions').then((r) => r.data),
  });
  const { data: payouts = [] } = useQuery<Payout[]>({
    queryKey: ['payouts'],
    queryFn: () => api.get('/payouts').then((r) => r.data),
  });

  const pending = commissions.filter((c) => c.status !== 'PAID').reduce((acc, c) => acc + c.amountUzs, 0);
  const paidCommission = commissions.filter((c) => c.status === 'PAID').reduce((acc, c) => acc + c.amountUzs, 0);
  const payoutsNet = payouts
    .filter((p) => p.status === 'COMPLETED')
    .reduce((acc, p) => acc + (p.type === 'DEBIT' ? -p.amountUzs : p.amountUzs), 0);
  const paid = paidCommission + payoutsNet;

  return (
    <div className="space-y-6 max-w-5xl">

      <div className="flex flex-col lg:flex-row items-center gap-6">
  <CommissionCreditCard
    holderName={user?.fullName ?? "O'qituvchi"}
    totalUzs={paid + pending}
    paidUzs={paid}
    pendingUzs={pending}
  />
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
    <div className="stat-card">
      <p className="text-xs font-semibold text-slate-500 uppercase">Kutilayotgan mukofot</p>
      <p className="text-2xl font-bold text-amber-600">{pending.toLocaleString()} UZS</p>
    </div>
    <div className="stat-card">
      <p className="text-xs font-semibold text-slate-500 uppercase">To'langan mukofot</p>
      <p className="text-2xl font-bold text-emerald-600">{paid.toLocaleString()} UZS</p>
    </div>
  </div>
</div>

      <div className="card space-y-3">
        <h2 className="section-title">To'lovlar tarixi</h2>
        <PayoutHistoryList payouts={payouts} />
      </div>
    </div>
  );
};

// ── MAIN TEACHER ROUTER ────────────────────────────────────────────────────────
const TeacherDashboard = () => (
  <Layout>
    <Routes>
      <Route index element={<TeacherOverviewDashboard />} />
      <Route path="students" element={<TeacherStudentsPage />} />
      <Route path="students/new" element={<NewStudentPage />} />
      <Route path="commissions" element={<TeacherCommissionsPage />} />
    </Routes>
  </Layout>
);

export default TeacherDashboard;
