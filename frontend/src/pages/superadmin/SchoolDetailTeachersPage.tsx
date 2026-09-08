import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';
import type { School, User, Student } from './types';

export const SchoolDetailTeachersPage = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const idNum = Number(schoolId);

  const { data: school, isLoading: schoolLoading } = useQuery<School>({
    queryKey: ['school', idNum],
    queryFn: () => api.get(`/schools/${idNum}`).then((r) => r.data),
  });

  const { data: teachers = [], isLoading: teachersLoading } = useQuery<User[]>({
    queryKey: ['school-teachers', idNum],
    queryFn: () => api.get(`/users?role=TEACHER&schoolId=${idNum}`).then((r) => r.data),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['school-students', idNum],
    queryFn: () => api.get(`/students?schoolId=${idNum}`).then((r) => r.data),
  });

  const studyingCount = students.filter((s) => s.studyStatus === 'STUDYING').length;

  if (schoolLoading) {
    return <div className="p-8 text-center text-slate-500">Maktab ma'lumotlari yuklanmoqda…</div>;
  }

  if (!school) {
    return (
      <div className="card p-8 text-center space-y-4">
        <p className="text-slate-600">Maktab topilmadi</p>
        <Link to="/superadmin/schools" className="btn-primary inline-block">
          ← Maktablar ro'yxatiga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link to="/superadmin/schools" className="text-blue-900 hover:underline">
          Maktablar
        </Link>
        <span>/</span>
        <span className="text-slate-800">
          № {school.schoolNumber || school.id} — {school.name}
        </span>
      </div>

      {/* Header Card */}
      <div className="card p-5 bg-gradient-to-r from-blue-50/50 via-slate-50 to-white border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#1E3A8A] text-white text-xs font-bold shadow-xs">
                № {school.schoolNumber || school.id}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{school.name}</h1>
              <StatusBadge value={school.isActive ? 'true' : 'false'} type="active" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Maktabga biriktirilgan o'qituvchilar va ular ro'yxatga olgan barcha o'quvchilar nazorati
            </p>
          </div>

          <Link to="/superadmin/schools" className="btn-secondary text-xs py-1.5 px-3 self-start sm:self-auto">
            ← Orqaga
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">Jami O'qituvchilar</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{teachers.length} ta</p>
            <span className="text-[11px] text-slate-400">Ushbu maktab ustozlari</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">Jami O'quvchilar</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{students.length} ta</p>
            <span className="text-[11px] text-slate-400">Maktab hisobiga kiritilgan</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Faol O'qiyotganlar</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{studyingCount} ta</p>
            <span className="text-[11px] text-emerald-600 font-medium">
              {students.length > 0 ? Math.round((studyingCount / students.length) * 100) : 0}% davomat
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">Maktab kodi</p>
            <p className="text-xl font-bold text-slate-800 mt-1 font-mono">
              {school.schoolNumber || `#${school.id}`}
            </p>
            <span className="text-[11px] text-slate-400">Rasmiy identifikator</span>
          </div>
        </div>
      </div>

      {/* Teachers in this School Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title">
              {school.name} o'qituvchilari ({teachers.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ustoz nomiga yoki "O'quvchilarni ko'rish" tugmasiga bosib, u ro'yxatga olgan o'quvchilarni ko'ring
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>O'qituvchi F.I.SH</th>
                <th>Telefon</th>
                <th>Fani / Yo'nalishi</th>
                <th className="text-center">Jalb qilgan o'quvchilari</th>
                <th className="text-center">O'qiyotganlari</th>
                <th>Ro'yxat sanasi</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              {teachersLoading && (
                <tr><td colSpan={7} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {teachers.map((t) => {
                const tStudents = students.filter((st) => st.teacherId === t.id);
                const tStudying = tStudents.filter((st) => st.studyStatus === 'STUDYING').length;

                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td>
                      <Link
                        to={`/superadmin/schools/${school.id}/teachers/${t.id}`}
                        className="font-bold text-blue-900 hover:underline inline-flex items-center gap-1.5"
                      >
                        👨‍🏫 {t.fullName}
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-slate-700 font-semibold">{t.phone}</td>
                    <td className="text-xs text-slate-600">{(t.meta as { subject?: string })?.subject || '—'}</td>
                    <td className="text-center font-bold text-slate-900">{tStudents.length} ta</td>
                    <td className="text-center font-bold text-emerald-600">{tStudying} ta</td>
                    <td className="text-slate-400 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Link
                        to={`/superadmin/schools/${school.id}/teachers/${t.id}`}
                        className="btn-primary text-xs py-1 px-3 whitespace-nowrap"
                      >
                        O'quvchilarni ko'rish ({tStudents.length}) →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!teachersLoading && teachers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Ushbu maktabga biriktirilgan o'qituvchilar hozircha mavjud emas
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
