import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
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

// ── Types ──────────────────────────────────────────────────────────────────────
interface User {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  role: string;
  isActive: boolean;
  meta?: { subject?: string } | null;
}

interface Student {
  id: number;
  fullName: string;
  phone: string;
  secondaryPhone?: string | null;
  teacherId: number | null;
  teacherName?: string | null;
  studyStatus: string;
  callStatus: string;
  callNote?: string | null;
  createdAt: string;
}

interface Commission {
  id: number;
  amountUzs: number;
  type: string;
  status: string;
  createdAt: string;
}

interface TeacherPerformance {
  id: number;
  fullName: string;
  phone: string;
  subject: string;
  totalStudents: number;
  studyingStudents: number;
  stoppedStudents: number;
  conversionPercent: number;
  students: Student[];
}

interface DirectorSummaryResponse {
  summary: {
    school: {
      id: number;
      name: string;
      schoolNumber: string;
    } | null;
    totalTeachers: number;
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
  };
  dailyTrends: DailyStudentItem[];
  teachersPerformance: TeacherPerformance[];
  students: Student[];
}

// ── 1. DIRECTOR OVERVIEW DASHBOARD WITH CHARTS & TEACHER DRILL-DOWN ───────────
const DirectorOverviewDashboard = () => {
  const navigate = useNavigate();
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [teacherFilterStatus, setTeacherFilterStatus] = useState<'ALL' | 'STUDYING' | 'STOPPED'>('ALL');
  const [searchTeacherTerm, setSearchTeacherTerm] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<DirectorSummaryResponse>({
    queryKey: ['director-summary'],
    queryFn: () => api.get('/analytics/director-summary').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="card p-12 text-center text-slate-400">
        <span className="animate-spin inline-block mr-2">⏳</span>
        Maktab ko'rsatkichlari yuklanmoqda…
      </div>
    );
  }

  const summary = data?.summary ?? {
    school: null,
    totalTeachers: 0,
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
  };

  const dailyTrends = data?.dailyTrends ?? [];
  const teachers = data?.teachersPerformance ?? [];

  // Filter teachers by search term
  const filteredTeachers = teachers.filter((t) => {
    if (!searchTeacherTerm) return true;
    const q = searchTeacherTerm.toLowerCase();
    return (
      t.fullName.toLowerCase().includes(q) ||
      t.phone.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    );
  });

  // Selected teacher for drill-down
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const selectedTeacherStudents = (selectedTeacher?.students ?? []).filter((s) => {
    if (teacherFilterStatus === 'STUDYING') return s.studyStatus === 'STUDYING';
    if (teacherFilterStatus === 'STOPPED') return s.studyStatus === 'STOPPED';
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* School Header Banner */}
      <div className="card bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 border-0 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-xs mb-2">
              <span>🏫</span>
              <span>
                {summary.school
                  ? `№ ${summary.school.schoolNumber} — ${summary.school.name}`
                  : 'Maktab'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Direktor Boshqaruv Paneli
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl">
              Maktabingiz o'qituvchilari va ular orqali jalb qilingan barcha o'quvchilarning o'quv markazidagi o'qish holati va ko'rsatkichlari
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
              onClick={() => navigate('/director/teachers')}
              className="btn bg-white text-blue-900 hover:bg-blue-50 text-xs font-bold shadow-sm"
            >
              + O'qituvchi qo'shish
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Teachers Count */}
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            O'qituvchilar
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalTeachers}</p>
          <span className="text-2xs text-blue-700 font-medium">Faol ustozlar</span>
        </div>

        {/* 2. Total Students */}
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            Jami o'quvchilar
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalStudents}</p>
          <span className="text-2xs text-slate-500 font-medium">Ro'yxatga olingan</span>
        </div>

        {/* 3. Studying Students */}
        <div className="stat-card border-emerald-200 bg-emerald-50/30">
          <span className="text-2xs font-semibold text-emerald-800 uppercase tracking-wider block">
            O'qiyotganlar
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.studyingStudents}</p>
          <span className="text-2xs text-emerald-600 font-bold">
            {summary.studyConversionPercent}% darsga qatnashmoqda
          </span>
        </div>

        {/* 4. Stopped Students */}
        <div className="stat-card border-rose-200 bg-rose-50/30">
          <span className="text-2xs font-semibold text-rose-800 uppercase tracking-wider block">
            To'xtatganlar
          </span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{summary.stoppedStudents}</p>
          <span className="text-2xs text-rose-600 font-medium">O'qish to'xtatilgan</span>
        </div>

        {/* 5. Waiting Leads */}
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
            Lid holatida
          </span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.waitingLeads}</p>
          <span className="text-2xs text-amber-700 font-medium">Qo'ng'iroq kutilmoqda</span>
        </div>

        {/* 6. Commission */}
        <div className="stat-card border-indigo-200 bg-indigo-50/30">
          <span className="text-2xs font-semibold text-indigo-800 uppercase tracking-wider block">
            Hisoblangan komissiya
          </span>
          <p className="text-xl font-bold text-indigo-900 mt-1">
            {(summary.totalCommissionUzs / 1000).toFixed(0)}k <span className="text-xs font-normal">UZS</span>
          </p>
          <span className="text-2xs text-indigo-600 font-medium">
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
      title="Maktab o'quvchilarining markazdagi o'qish balansi"
      subtitle="O'qituvchilar orqali jalb qilingan o'quvchilarning faol o'qish ko'rsatkichi"
    />
    <DailyStudentTrendChart
      data={dailyTrends}
      title="Maktab bo'yicha kunlik yangi o'quvchilar (14 kun)"
      subtitle="Har bir kun 0 dan boshlanadi — kunlik kiritilgan o'quvchilar va ularning darsga qatnashishi"
    />
  </div>

  <div className="flex flex-col gap-4">
    <CommissionCreditCard
      schoolName={summary.school ? `№ ${summary.school.schoolNumber} — ${summary.school.name}` : undefined}
      subject="Maktab balansi"
      holderName="Direktor"
      totalUzs={summary.totalCommissionUzs}
      paidUzs={summary.paidCommissionUzs}
      pendingUzs={summary.pendingCommissionUzs}
    />
    <div className="card p-4 text-center">
      <p className="text-xs text-slate-500">
        🏫 Maktab bo'yicha barcha ustozlarga hisoblangan jami komissiya.
      </p>
    </div>
  </div>
</div>

      {/* Teachers Performance Table with Interactive Drill-down */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="section-title">
              O'qituvchilar ko'rsatkichlari ({teachers.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              O'qituvchi ustiga bosing va unga tegishli o'quvchilarning o'qish holatini batafsil ko'ring
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ustoz ismi yoki fan bo'yicha qidiruv…"
              value={searchTeacherTerm}
              onChange={(e) => setSearchTeacherTerm(e.target.value)}
              className="input text-xs py-1.5 px-3 w-64"
            />
          </div>
        </div>

        {/* Selected Teacher Drill-down Panel */}
        {selectedTeacher && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-sm">
                  👨‍🏫
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedTeacher.fullName}</span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-white text-blue-900 border border-blue-200">
                      {selectedTeacher.subject}
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-slate-500">{selectedTeacher.phone}</span>
                </div>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTeacherFilterStatus('ALL')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    teacherFilterStatus === 'ALL'
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-white text-slate-700 hover:bg-blue-100'
                  }`}
                >
                  Barchasi ({selectedTeacher.totalStudents})
                </button>
                <button
                  onClick={() => setTeacherFilterStatus('STUDYING')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    teacherFilterStatus === 'STUDYING'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  🟢 O'qiyotganlar ({selectedTeacher.studyingStudents})
                </button>
                <button
                  onClick={() => setTeacherFilterStatus('STOPPED')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    teacherFilterStatus === 'STOPPED'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  🔴 To'xtatganlar ({selectedTeacher.stoppedStudents})
                </button>
                <button
                  onClick={() => setSelectedTeacherId(null)}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 bg-white rounded-lg border border-slate-200 ml-2"
                  title="Yopish"
                >
                  ✕ Yopish
                </button>
              </div>
            </div>

            {/* Teacher's Students Table */}
            <div className="table-wrapper bg-white rounded-lg border border-blue-100 shadow-2xs">
              <table className="table">
                <thead>
                  <tr>
                    <th>O'quvchi F.I.SH</th>
                    <th>Telefon</th>
                    <th>Qo'shimcha tel</th>
                    <th>Qo'ng'iroq</th>
                    <th>O'quv markazida o'qishi</th>
                    <th>Qo'shilgan sana</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTeacherStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
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
                  {selectedTeacherStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                        Ushbu holat bo'yicha o'quvchilar topilmadi
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Teachers Main Table */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>O'qituvchi (Ustoz)</th>
                <th>Telefon (Login)</th>
                <th>Fani</th>
                <th className="text-center">Jami o'quvchilar</th>
                <th className="text-center">O'qiyotganlar (🟢)</th>
                <th className="text-center">To'xtatganlar (🔴)</th>
                <th>O'qish foizi</th>
                <th className="text-right">Amal</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/director/teachers/${t.id}/students`)}
                  className="cursor-pointer hover:bg-blue-50/70 transition-colors group"
                  title="Ushbu o'qituvchining o'quvchilari ro'yxatiga o'tish"
                >
                  <td>
                    <Link
                      to={`/director/teachers/${t.id}/students`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2"
                    >
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-xs group-hover:bg-[#1E3A8A] group-hover:text-white transition-colors">
                        {t.fullName.charAt(0)}
                      </span>
                      <span className="font-bold text-slate-900 group-hover:text-blue-900 group-hover:underline text-xs">
                        {t.fullName}
                      </span>
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{t.phone}</td>
                  <td className="text-slate-600 text-xs">{t.subject}</td>
                  <td className="text-center font-bold text-slate-800 text-xs">{t.totalStudents}</td>
                  <td className="text-center font-bold text-emerald-600 text-xs">{t.studyingStudents}</td>
                  <td className="text-center font-bold text-rose-600 text-xs">{t.stoppedStudents}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${t.conversionPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{t.conversionPercent}%</span>
                    </div>
                  </td>
                  <td className="text-right">
                    <Link
                      to={`/director/teachers/${t.id}/students`}
                      onClick={(e) => e.stopPropagation()}
                      className="btn-primary text-xs py-1.5 px-3 font-bold whitespace-nowrap shadow-xs hover:shadow-sm inline-flex items-center gap-1"
                    >
                      <span>O'quvchilar ({t.totalStudents})</span>
                      <span>→</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredTeachers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    O'qituvchilar topilmadi
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

// ── 2. TEACHERS MANAGEMENT PAGE ────────────────────────────────────────────────
const TeachersPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: teachers = [] } = useQuery<User[]>({
    queryKey: ['teachers'],
    queryFn: () => api.get('/users?role=TEACHER').then((r) => r.data),
  });
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: () => api.get('/students').then((r) => r.data),
  });

  const [form, setForm] = useState({ fullName: '', phone: '', password: '', subject: '' });
  const [msg, setMsg] = useState('');
  const { confirm, showToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (body: { fullName: string; phone: string; password: string; meta?: { subject: string } }) =>
      api.post('/users/teacher', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      qc.invalidateQueries({ queryKey: ['director-summary'] });
      setForm({ fullName: '', phone: '', password: '', subject: '' });
      setMsg("O'qituvchi muvaffaqiyatli qo'shildi!");
      showToast({
        type: 'success',
        title: "O'qituvchi qo'shildi",
        message: "Yangi o'qituvchi muvaffaqiyatli ro'yxatdan o'tkazildi!",
      });
      setTimeout(() => setMsg(''), 3000);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errText = axiosErr.response?.data?.error || 'Telefon raqam takrorlanmasligi kerak.';
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
    const confirmed = await confirm({
      title: "O'qituvchi qo'shishni tasdiqlaysizmi?",
      message: "Yangi o'qituvchi maktabingizga biriktiriladi va o'quvchilarni taklif qilish imkoniyatiga ega bo'ladi.",
      details: [
        { label: "O'qituvchi F.I.SH", value: form.fullName },
        { label: "Telefon raqam", value: form.phone },
        { label: "Dars beradigan fan", value: form.subject || 'Belgilanmagan' },
      ],
      confirmText: "Ha, o'qituvchini qo'shish",
    });
    if (!confirmed) return;

    mutation.mutate({
      fullName: form.fullName,
      phone: form.phone,
      password: form.password,
      meta: form.subject ? { subject: form.subject } : undefined,
    });
  };

  const getStats = (teacherId: number) => {
    const list = students.filter((s) => s.teacherId === teacherId);
    return {
      total: list.length,
      studying: list.filter((s) => s.studyStatus === 'STUDYING').length,
    };
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">O'qituvchilar boshqaruvi</h1>
        <p className="text-sm text-slate-500 mt-0.5">Maktabingiz o'qituvchilari va ularning ko'rsatkichlari</p>
      </div>

      {/* Teacher Non-Deletion Policy Notice */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-3 shadow-2xs">
        <span className="text-xl">🔒</span>
        <div className="space-y-1">
          <p className="font-bold text-sm">O'qituvchilar daxlsizligi qoidasi:</p>
          <p className="text-slate-700 leading-relaxed">
            Maktab o'qituvchilari yaratilgandan so'ng, ularni o'chirib bo'lmaydi. Bu maktab o'quvchilari tarixi, erishilgan natijalar va hisoblangan oylik komissiyalarning shaffof saqlanishini ta'minlaydi. O'qituvchining o'quvchilarini ko'rish uchun uning ustiga bosing.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Yangi o'qituvchi qo'shish</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">O'qituvchi F.I.SH</label>
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
            <label className="label">Telefon raqam (Login uchun)</label>
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
          <div>
            <label className="label">Fani / Yo'nalishi</label>
            <input
              type="text"
              className="input"
              placeholder="Ingliz tili, Matematika…"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          {msg && (
            <div className={`sm:col-span-2 ${msg.includes('Xatolik') ? 'notice-error' : 'notice-success'}`}>
              {msg}
            </div>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Qo'shilmoqda…" : "O'qituvchini saqlash"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">O'qituvchilar ro'yxati ({teachers.length})</h2>
          <span className="text-xs text-slate-500">O'qituvchi ustiga bosing va uning o'quvchilarini ko'ring</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Telefon (Login)</th>
                <th>Fani</th>
                <th className="text-center">Jami o'quvchilar</th>
                <th className="text-center">O'qiyotganlar</th>
                <th>Holati</th>
                <th className="text-right">Amal</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const st = getStats(t.id);
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/director/teachers/${t.id}/students`)}
                    className="cursor-pointer hover:bg-blue-50/60 transition-colors group"
                    title="Ushbu o'qituvchining o'quvchilari ro'yxatiga o'tish"
                  >
                    <td>
                      <Link
                        to={`/director/teachers/${t.id}/students`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-slate-900 group-hover:text-blue-900 group-hover:underline flex items-center gap-1.5"
                      >
                        <span>👨‍🏫 {t.fullName}</span>
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-blue-900 font-bold">{t.phone}</td>
                    <td className="text-slate-600 text-xs">{t.meta?.subject ?? '—'}</td>
                    <td className="text-center font-bold text-slate-800">{st.total}</td>
                    <td className="text-center font-bold text-emerald-600">{st.studying}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge value={t.isActive ? 'true' : 'false'} type="active" />
                        <span className="text-[10px] text-slate-400 font-medium" title="O'chirib bo'lmaydi">🔒 Saqlangan</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/director/teachers/${t.id}/students`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-primary text-xs py-1 px-3 whitespace-nowrap font-bold inline-flex items-center gap-1"
                      >
                        <span>O'quvchilar ({st.total})</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-slate-400">O'qituvchilar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── 2B. DEDICATED TEACHER STUDENTS PAGE (DIRECTOR) ───────────────────────────
const DirectorTeacherStudentsPage = () => {
  const { teacherId } = useParams<{ teacherId: string }>();
  const tId = Number(teacherId);
  const navigate = useNavigate();
  const [filterStudy, setFilterStudy] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: teacher, isLoading: teacherLoading } = useQuery<User>({
    queryKey: ['teacher', tId],
    queryFn: () => api.get(`/users/${tId}`).then((r) => r.data),
    enabled: !isNaN(tId),
  });

  const { data: allStudents = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: () => api.get('/students').then((r) => r.data),
  });

  const teacherStudents = allStudents.filter((s) => s.teacherId === tId);

  const studyingCount = teacherStudents.filter((s) => s.studyStatus === 'STUDYING').length;
  const stoppedCount = teacherStudents.filter((s) => s.studyStatus === 'STOPPED').length;
  const waitingCount = teacherStudents.filter((s) => s.studyStatus === 'WAITING').length;
  const conversionPercent = teacherStudents.length > 0
    ? Math.round((studyingCount / teacherStudents.length) * 100)
    : 0;

  const filteredStudents = teacherStudents.filter((s) => {
    if (filterStudy === 'STUDYING' && s.studyStatus !== 'STUDYING') return false;
    if (filterStudy === 'STOPPED' && s.studyStatus !== 'STOPPED') return false;
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

  if (teacherLoading) {
    return (
      <div className="card p-12 text-center text-slate-500">
        <span className="animate-spin inline-block text-2xl mb-2">🔄</span>
        <p>O'qituvchi ma'lumotlari yuklanmoqda…</p>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="card p-8 text-center space-y-4">
        <p className="text-slate-600 font-semibold">O'qituvchi topilmadi yoki unga ruxsat yo'q</p>
        <button onClick={() => navigate('/director')} className="btn-primary">
          ← Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl animate-fadeIn">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link to="/director" className="text-blue-900 hover:underline">
          Direktor Paneli
        </Link>
        <span>/</span>
        <Link to="/director/teachers" className="text-blue-900 hover:underline">
          O'qituvchilar
        </Link>
        <span>/</span>
        <span className="text-slate-800">{teacher.fullName} o'quvchilari</span>
      </div>

      {/* Teacher Profile Banner */}
      <div className="card bg-gradient-to-r from-[#1E3A8A] via-blue-900 to-indigo-950 text-white p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center font-bold text-2xl backdrop-blur-xs border border-white/20">
              👨‍🏫
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{teacher.fullName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {teacher.meta?.subject || "O'qituvchi"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-blue-100">
                  🔒 Himoyalangan (o'chirilmaydi)
                </span>
              </div>
              <p className="text-blue-200 text-xs sm:text-sm font-mono mt-1">
                Telefon (Login): {teacher.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
            >
              ← Ortga qaytish
            </button>
            <Link
              to="/director/teachers"
              className="px-4 py-2 rounded-xl bg-white text-[#1E3A8A] hover:bg-blue-50 text-xs font-bold transition-colors shadow-xs"
            >
              Barcha ustozlar
            </Link>
          </div>
        </div>
      </div>

      {/* Teacher KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card">
          <span className="text-2xs font-semibold text-slate-500 uppercase">Jami jalb qilgan</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{teacherStudents.length} ta</p>
          <span className="text-2xs text-slate-400">O'quvchilar soni</span>
        </div>
        <div className="stat-card border-emerald-200 bg-emerald-50/40">
          <span className="text-2xs font-semibold text-emerald-800 uppercase">🟢 O'qiyotganlar</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{studyingCount} ta</p>
          <span className="text-2xs text-emerald-600 font-bold">{conversionPercent}% darsga qatnashmoqda</span>
        </div>
        <div className="stat-card border-rose-200 bg-rose-50/40">
          <span className="text-2xs font-semibold text-rose-800 uppercase">🔴 To'xtatganlar</span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{stoppedCount} ta</p>
          <span className="text-2xs text-rose-600">Darsni to'xtatgan</span>
        </div>
        <div className="stat-card border-amber-200 bg-amber-50/40">
          <span className="text-2xs font-semibold text-amber-800 uppercase">🟡 Kutilayotganlar</span>
          <p className="text-2xl font-bold text-amber-700 mt-1">{waitingCount} ta</p>
          <span className="text-2xs text-amber-600">Jarayonda</span>
        </div>
      </div>

      {/* Teacher Students Table */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="section-title">
              {teacher.fullName} ro'yxatga olgan o'quvchilar ro'yxati ({teacherStudents.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ushbu o'qituvchi tomonidan yo'naltirilgan o'quvchilar va ularning markazdagi holati
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="O'quvchi ismi yoki telefon…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input text-xs py-1.5 px-3 w-56 sm:w-64"
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStudy('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterStudy === 'ALL'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Barchasi ({teacherStudents.length})
          </button>
          <button
            onClick={() => setFilterStudy('STUDYING')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterStudy === 'STUDYING'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            🟢 O'qiyotganlar ({studyingCount})
          </button>
          <button
            onClick={() => setFilterStudy('STOPPED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterStudy === 'STOPPED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            🔴 To'xtatganlar ({stoppedCount})
          </button>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>O'quvchi F.I.SH</th>
                <th>Asosiy telefon</th>
                <th>Qo'shimcha telefon</th>
                <th>Qo'ng'iroq holati</th>
                <th>O'quv markazida o'qishi</th>
                <th>Ro'yxat sanasi</th>
              </tr>
            </thead>
            <tbody>
              {studentsLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    O'quvchilar yuklanmoqda…
                  </td>
                </tr>
              )}
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="font-bold text-slate-900 text-xs sm:text-sm">{s.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
                  <td className="font-mono text-xs text-slate-500">{s.secondaryPhone || '—'}</td>
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
              {!studentsLoading && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    {teacherStudents.length === 0
                      ? "Ushbu o'qituvchi tomonidan hozircha o'quvchilar ro'yxatdan o'tkazilmagan"
                      : "Tanlangan filtr bo'yicha o'quvchilar topilmadi"}
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

// ── 3. STUDENTS PAGE ───────────────────────────────────────────────────────────
const DirectorStudentsPage = () => {
  const [filterStudy, setFilterStudy] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: () => api.get('/students').then((r) => r.data),
  });

  const studying = students.filter((s) => s.studyStatus === 'STUDYING').length;
  const stopped = students.filter((s) => s.studyStatus === 'STOPPED').length;

  const filtered = students.filter((s) => {
    if (filterStudy === 'STUDYING' && s.studyStatus !== 'STUDYING') return false;
    if (filterStudy === 'STOPPED' && s.studyStatus !== 'STOPPED') return false;
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
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">O'quvchilar ro'yxati</h1>
          <p className="text-sm text-slate-500 mt-0.5">Maktabingiz bo'yicha jalb qilingan barcha o'quvchilar</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="O'quvchi ismi yoki telefon…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input text-xs py-1.5 px-3 w-60"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setFilterStudy('ALL')}
          className={`stat-card text-left transition-all ${filterStudy === 'ALL' ? 'ring-2 ring-blue-600' : ''}`}
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">Jami o'quvchilar</p>
          <p className="text-2xl font-bold text-slate-900">{students.length}</p>
        </button>
        <button
          onClick={() => setFilterStudy('STUDYING')}
          className={`stat-card text-left transition-all ${filterStudy === 'STUDYING' ? 'ring-2 ring-emerald-600 bg-emerald-50/20' : ''}`}
        >
          <p className="text-xs font-semibold text-emerald-800 uppercase">🟢 O'qiyotganlar</p>
          <p className="text-2xl font-bold text-emerald-600">{studying}</p>
        </button>
        <button
          onClick={() => setFilterStudy('STOPPED')}
          className={`stat-card text-left transition-all ${filterStudy === 'STOPPED' ? 'ring-2 ring-rose-600 bg-rose-50/20' : ''}`}
        >
          <p className="text-xs font-semibold text-rose-800 uppercase">🔴 To'xtatganlar</p>
          <p className="text-2xl font-bold text-rose-600">{stopped}</p>
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Telefon</th>
                <th>Qo'shimcha tel</th>
                <th>Qo'ng'iroq holati</th>
                <th>O'qish holati</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-slate-900">{s.fullName}</td>
                  <td className="font-mono text-xs text-slate-600">{s.phone}</td>
                  <td className="font-mono text-xs text-slate-400">{s.secondaryPhone ?? '—'}</td>
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
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">O'quvchilar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── 4. COMMISSIONS PAGE ────────────────────────────────────────────────────────
const DirectorCommissionsPage = () => {
  const { data: commissions = [] } = useQuery<Commission[]>({
    queryKey: ['commissions'],
    queryFn: () => api.get('/commissions').then((r) => r.data),
  });

  const total = commissions.reduce((acc, c) => acc + c.amountUzs, 0);
  const paid = commissions.filter((c) => c.status === 'PAID').reduce((acc, c) => acc + c.amountUzs, 0);
  const pending = commissions.filter((c) => c.status !== 'PAID').reduce((acc, c) => acc + c.amountUzs, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Komissiyalarim</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sizga hisoblangan mukofot pullari</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-6">
  <CommissionCreditCard
    schoolName="Maktab komissiya balansi"
    holderName="Direktor"
    totalUzs={total}
    paidUzs={paid}
    pendingUzs={pending}
  />
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 w-full">
    <div className="stat-card">
      <p className="text-xs font-semibold text-slate-500 uppercase">Jami hisoblangan</p>
      <p className="text-2xl font-bold text-slate-900">{total.toLocaleString()} UZS</p>
    </div>
    <div className="stat-card">
      <p className="text-xs font-semibold text-slate-500 uppercase">To'langan</p>
      <p className="text-2xl font-bold text-emerald-600">{paid.toLocaleString()} UZS</p>
    </div>
    <div className="stat-card">
      <p className="text-xs font-semibold text-slate-500 uppercase">Kutilayotgan</p>
      <p className="text-2xl font-bold text-amber-600">{pending.toLocaleString()} UZS</p>
    </div>
  </div>
</div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Turi</th>
                <th>Miqdori</th>
                <th>Holati</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td><span className="font-mono text-xs text-blue-900 bg-blue-50 px-2 py-0.5 rounded font-semibold">{c.type}</span></td>
                  <td className="font-bold text-slate-900">{c.amountUzs.toLocaleString()} UZS</td>
                  <td><StatusBadge value={c.status} type="commission" /></td>
                  <td className="text-slate-400 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Komissiyalar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── MAIN DIRECTOR ROUTER ───────────────────────────────────────────────────────
const DirectorDashboard = () => (
  <Layout>
    <Routes>
      <Route index element={<DirectorOverviewDashboard />} />
      <Route path="teachers" element={<TeachersPage />} />
      <Route path="teachers/:teacherId/students" element={<DirectorTeacherStudentsPage />} />
      <Route path="teachers/:teacherId" element={<DirectorTeacherStudentsPage />} />
      <Route path="students" element={<DirectorStudentsPage />} />
      <Route path="commissions" element={<DirectorCommissionsPage />} />
    </Routes>
  </Layout>
);

export default DirectorDashboard;
