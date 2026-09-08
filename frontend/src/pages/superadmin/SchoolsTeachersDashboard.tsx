import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import StatusBadge from '../../components/StatusBadge';
import type { CeoSummary } from './types';

export const SchoolsTeachersDashboard = () => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schools' | 'teachers'>('schools');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [msg, setMsg] = useState('');

  const { data: summary, isLoading } = useQuery<CeoSummary>({
    queryKey: ['ceo-summary'],
    queryFn: () => api.get('/analytics/ceo-summary').then((r) => r.data),
  });

  const schools = summary?.schoolsSummary ?? [];
  const teachers = summary?.teachersSummary ?? [];
  const { confirm, showToast } = useFeedback();

  const addSchoolMutation = useMutation({
    mutationFn: (name: string) => api.post('/schools', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ceo-summary'] });
      qc.invalidateQueries({ queryKey: ['schools'] });
      setNewSchoolName('');
      setMsg("Maktab muvaffaqiyatli qo'shildi!");
      showToast({
        type: 'success',
        title: "Maktab qo'shildi",
        message: "Yangi maktab muvaffaqiyatli ro'yxatdan o'tkazildi!",
      });
      setTimeout(() => setMsg(''), 3000);
    },
    onError: () => {
      setMsg('Xatolik yuz berdi.');
      showToast({
        type: 'error',
        title: 'Xatolik',
        message: "Maktabni qo'shishda xatolik yuz berdi.",
      });
    },
  });

  const handleAddSchool = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newSchoolName.trim();
    if (!trimmed) return;

    const confirmed = await confirm({
      title: "Yangi maktab qo'shishni tasdiqlaysizmi?",
      message: "Yangi maktab tizimga kiritiladi va unga o'qituvchilar hamda direktorlar biriktirilishi mumkin bo'ladi.",
      details: [{ label: "Maktab nomi", value: trimmed }],
      confirmText: "Ha, maktabni qo'shish",
    });
    if (!confirmed) return;

    addSchoolMutation.mutate(trimmed);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="page-title">Maktablar va O'qituvchilar Tahlili</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Hamkor maktablar, o'qituvchilar reytingi, jalb qilingan o'quvchilar va tushum
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('schools')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'schools'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          🏫 Maktablar ({schools.length})
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'teachers'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          👨‍🏫 O'qituvchilar / Ustozlar ({teachers.length})
        </button>
      </div>

      {/* TAB 1: SCHOOLS */}
      {activeTab === 'schools' && (
        <div className="space-y-6">
          {/* Add School Card */}
          <div className="card">
            <h2 className="section-title mb-2">Yangi maktab qo'shish</h2>
            <p className="text-xs text-slate-500 mb-4">
              Faqat maktab nomini kiriting (masalan: 23-maktab yoki Al-Xorazmiy maktabi)
            </p>
            <form onSubmit={handleAddSchool} className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <input
                type="text"
                className="input flex-1"
                placeholder="Maktab nomi…"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary shrink-0" disabled={addSchoolMutation.isPending}>
                {addSchoolMutation.isPending ? "Qo'shilmoqda…" : "+ Maktabni qo'shish"}
              </button>
            </form>
            {msg && (
              <div className={`mt-3 ${msg.includes('Xatolik') ? 'notice-error' : 'notice-success'}`}>
                {msg}
              </div>
            )}
          </div>

          {/* Schools Table */}
          <div className="card">
            <h2 className="section-title mb-4">Barcha maktablar ko'rsatkichlari</h2>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Maktab (№ va Nomi)</th>
                    <th>Direktor</th>
                    <th className="text-center">O'qituvchilar</th>
                    <th className="text-center">Jami o'quvchilar</th>
                    <th className="text-center">O'qiyotganlar</th>
                    <th>Jami tushum (UZS)</th>
                    <th>Holati</th>
                    <th>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={8} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
                  )}
                  {schools.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="font-bold text-slate-900">
                        <Link
                          to={`/superadmin/schools/${s.id}`}
                          className="inline-flex items-center gap-1.5 group hover:text-blue-900"
                        >
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 group-hover:bg-blue-100">
                            № {s.schoolNumber || s.id}
                          </span>
                          <span className="group-hover:underline">{s.name}</span>
                        </Link>
                      </td>
                      <td>
                        {s.directorName ? (
                          <div>
                            <span className="font-medium text-slate-800">{s.directorName}</span>
                            <span className="block text-xs text-slate-400 font-mono">{s.directorPhone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Tayinlanmagan</span>
                        )}
                      </td>
                      <td className="text-center font-semibold text-slate-700">{s.teacherCount} ta</td>
                      <td className="text-center font-bold text-slate-900">{s.studentCount} ta</td>
                      <td className="text-center font-bold text-emerald-600">{s.studyingCount} ta</td>
                      <td className="font-bold text-teal-800">{s.revenueUzs.toLocaleString()} UZS</td>
                      <td><StatusBadge value={s.isActive ? 'true' : 'false'} type="active" /></td>
                      <td>
                        <Link
                          to={`/superadmin/schools/${s.id}`}
                          className="btn-primary text-xs py-1 px-2.5 whitespace-nowrap"
                        >
                          O'qituvchilar ({s.teacherCount}) →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && schools.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-slate-400">Maktablar kiritilmagan</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEACHERS */}
      {activeTab === 'teachers' && (
        <div className="card">
          <h2 className="section-title mb-4">O'qituvchilar (Ustozlar) faoliyati va reytingi</h2>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>O'qituvchi F.I.SH</th>
                  <th>Telefon</th>
                  <th>Maktabi</th>
                  <th className="text-center">Olib kelgan o'quvchilari</th>
                  <th className="text-center">O'qiyotganlari</th>
                  <th className="text-center">To'lov qilganlari</th>
                  <th>Jami komissiya</th>
                  <th>Kutilayotgan komissiya</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
                )}
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="font-bold text-slate-900">
                      <Link
                        to={t.schoolId ? `/superadmin/schools/${t.schoolId}/teachers/${t.id}` : `/superadmin/teachers/${t.id}/students`}
                        className="hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                      >
                        👨‍🏫 {t.fullName}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-blue-900 font-semibold">{t.phone}</td>
                    <td className="text-slate-700 font-medium">
                      {t.schoolId ? (
                        <Link to={`/superadmin/schools/${t.schoolId}`} className="hover:underline text-xs inline-flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-700">№ {t.schoolNumber || t.schoolId}</span>
                          <span>{t.schoolName}</span>
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-center font-bold text-slate-800">{t.totalStudents} ta</td>
                    <td className="text-center font-bold text-emerald-600">{t.studyingStudents} ta</td>
                    <td className="text-center font-bold text-blue-800">{t.paidStudents} ta</td>
                    <td className="font-bold text-slate-900">{t.totalCommissionUzs.toLocaleString()} UZS</td>
                    <td className="font-bold text-amber-600">{t.pendingCommissionUzs.toLocaleString()} UZS</td>
                    <td>
                      <Link
                        to={t.schoolId ? `/superadmin/schools/${t.schoolId}/teachers/${t.id}` : `/superadmin/teachers/${t.id}/students`}
                        className="btn-secondary text-xs py-1 px-2.5 whitespace-nowrap"
                      >
                        O'quvchilari ({t.totalStudents}) →
                      </Link>
                    </td>
                  </tr>
                ))}
                {!isLoading && teachers.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400">O'qituvchilar topilmadi</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
