import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';
import type { School, User, Student } from './types';

export const TeacherStudentsDetailPage = () => {
  const { schoolId, teacherId } = useParams<{ schoolId?: string; teacherId?: string }>();
  const tIdNum = Number(teacherId);

  const { data: teacher, isLoading: teacherLoading } = useQuery<User>({
    queryKey: ['teacher', tIdNum],
    queryFn: () => api.get(`/users/${tIdNum}`).then((r) => r.data),
    enabled: !isNaN(tIdNum),
  });

  const effectiveSchoolId = schoolId ? Number(schoolId) : (teacher?.schoolId ? Number(teacher.schoolId) : undefined);

  const { data: school } = useQuery<School>({
    queryKey: ['school', effectiveSchoolId],
    queryFn: () => api.get(`/schools/${effectiveSchoolId}`).then((r) => r.data),
    enabled: !!effectiveSchoolId,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ['teacher-students', tIdNum],
    queryFn: () => api.get(`/students?teacherId=${tIdNum}`).then((r) => r.data),
    enabled: !isNaN(tIdNum),
  });

  const studyingCount = students.filter((s) => s.studyStatus === 'STUDYING').length;
  const stoppedCount = students.filter((s) => s.studyStatus === 'STOPPED').length;

  if (teacherLoading) {
    return <div className="p-8 text-center text-slate-500">O'qituvchi ma'lumotlari yuklanmoqda…</div>;
  }

  if (!teacher) {
    return (
      <div className="card p-8 text-center space-y-4">
        <p className="text-slate-600 font-semibold">O'qituvchi topilmadi</p>
        <Link to="/superadmin/schools" className="btn-primary inline-block">
          ← Maktablar sahifasiga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl animate-fadeIn">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
        <Link to="/superadmin/schools" className="text-blue-900 hover:underline">
          Maktablar
        </Link>
        {effectiveSchoolId && (
          <>
            <span>/</span>
            <Link to={`/superadmin/schools/${effectiveSchoolId}`} className="text-blue-900 hover:underline">
              № {school?.schoolNumber || effectiveSchoolId} — {school?.name || 'Maktab'}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-800">
          Ustoz: {teacher.fullName}
        </span>
      </div>

      {/* Teacher Profile Card */}
      <div className="card p-5 bg-gradient-to-r from-blue-50/50 via-slate-50 to-white border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {teacher.fullName[0]?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{teacher.fullName}</h1>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                  O'qituvchi
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Telefon: <strong className="font-mono text-slate-900">{teacher.phone}</strong> | Maktab: <strong>№ {school?.schoolNumber || schoolId} ({school?.name})</strong>
                {(teacher.meta as { subject?: string })?.subject && (
                  <span> | Fani: <strong>{(teacher.meta as { subject?: string }).subject}</strong></span>
                )}
              </p>
            </div>
          </div>

          <Link to={`/superadmin/schools/${schoolId}`} className="btn-secondary text-xs py-1.5 px-3 self-start sm:self-auto">
            ← O'qituvchilar ro'yxatiga qaytish
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">Jami Jalb Qilinganlar</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{students.length} ta</p>
            <span className="text-[11px] text-slate-400">O'quvchilar soni</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Faol O'qiyotganlar</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{studyingCount} ta</p>
            <span className="text-[11px] text-emerald-600 font-medium">Darslarda qatnashmoqda</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-rose-700 uppercase">O'qimayotganlar</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{stoppedCount} ta</p>
            <span className="text-[11px] text-slate-400">Hali boshlamagan / to'xtatgan</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">Konversiya</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {students.length > 0 ? Math.round((studyingCount / students.length) * 100) : 0}%
            </p>
            <span className="text-[11px] text-slate-400">Faol o'quvchilar ulushi</span>
          </div>
        </div>
      </div>

      {/* Registered Students Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title">
              {teacher.fullName} ro'yxatdan o'tkazgan o'quvchilar ({students.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ushbu o'qituvchi tomonidan tavsiya etilgan barcha o'quvchilar va ularning statuslari
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Asosiy telefon</th>
                <th>Qo'shimcha telefon</th>
                <th>Maktab (№)</th>
                <th>Qo'ng'iroq holati</th>
                <th>O'qish holati</th>
                <th>Ro'yxat sanasi</th>
              </tr>
            </thead>
            <tbody>
              {studentsLoading && (
                <tr><td colSpan={7} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="font-bold text-slate-900">{s.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
                  <td className="font-mono text-xs text-slate-500">{s.secondaryPhone || '—'}</td>
                  <td>
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900">
                      № {s.schoolNumber || school?.schoolNumber || s.schoolId || '—'}
                    </span>
                  </td>
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
              {!studentsLoading && students.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Ushbu o'qituvchi tomonidan hozircha o'quvchilar ro'yxatdan o'tkazilmagan
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
