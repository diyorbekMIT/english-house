import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';
import type { Student, School } from './types';

export const StudentsDashboard = () => {
  const [search, setSearch] = useState('');
  const [callFilter, setCallFilter] = useState('');
  const [studyFilter, setStudyFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');

  const params = new URLSearchParams();
  if (callFilter) params.set('callStatus', callFilter);
  if (studyFilter) params.set('studyStatus', studyFilter);
  if (schoolFilter) params.set('schoolId', schoolFilter);

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['students', callFilter, studyFilter, schoolFilter],
    queryFn: () => api.get(`/students?${params.toString()}`).then((r) => r.data),
  });

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools'],
    queryFn: () => api.get('/schools').then((r) => r.data),
  });

  const filtered = students.filter((s) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(query) ||
      s.phone.toLowerCase().includes(query) ||
      (s.secondaryPhone && s.secondaryPhone.toLowerCase().includes(query)) ||
      (s.teacherName && s.teacherName.toLowerCase().includes(query)) ||
      (s.schoolName && s.schoolName.toLowerCase().includes(query)) ||
      (s.callNote && s.callNote.toLowerCase().includes(query))
    );
  });

  const schoolMap = new Map(schools.map((sch) => [sch.id, sch.name]));

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="page-title">O'quvchilar Tahlili</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Markazga kiritilgan barcha o'quvchilar, ularning maktab raqami, o'qituvchisi, qo'ng'iroq va o'qish holatlari
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          className="input w-full sm:w-64 text-sm"
          placeholder="Qidiruv: F.I.SH, tel, ustoz, maktab, izoh…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-full sm:w-auto text-sm"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          <option value="">Barcha maktablar</option>
          {schools.map((sch) => (
            <option key={sch.id} value={sch.id}>
              № {sch.schoolNumber || sch.id} — {sch.name}
            </option>
          ))}
        </select>
        <select
          className="input w-full sm:w-auto text-sm"
          value={callFilter}
          onChange={(e) => setCallFilter(e.target.value)}
        >
          <option value="">Barcha qo'ng'iroq holatlari</option>
          <option value="WAITING">Kutilmoqda (WAITING)</option>
          <option value="CALLED">Aloqaga chiqildi (CALLED)</option>
          <option value="REGISTERED">Kursga yozildi (REGISTERED)</option>
          <option value="FIRST_LESSON">Birinchi dars (FIRST_LESSON)</option>
          <option value="STARTED_STUDYING">Dars boshladi (STARTED_STUDYING)</option>
          <option value="MADE_PAYMENT">To'lov qildi (MADE_PAYMENT)</option>
          <option value="REJECTED">Rad etildi (REJECTED)</option>
        </select>
        <select
          className="input w-full sm:w-auto text-sm"
          value={studyFilter}
          onChange={(e) => setStudyFilter(e.target.value)}
        >
          <option value="">Barcha o'qish holatlari</option>
          <option value="ACTIVE">Faol (ACTIVE)</option>
          <option value="NOACTIVE">Faol emas (NOACTIVE)</option>
        </select>
        <span className="text-xs text-slate-500 sm:ml-auto font-medium">
          Topildi: {filtered.length} ta o'quvchi
        </span>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Asosiy telefon</th>
                <th>Qo'shimcha telefon</th>
                <th>Maktab (№ / Nomi)</th>
                <th>O'qituvchi (Ustoz)</th>
                <th>Qo'ng'iroq holati</th>
                <th>O'qish holati</th>
                <th>Ro'yxat sanasi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="font-bold text-slate-900">
                    <Link
                      to={`/superadmin/students/${s.id}/payments`}
                      className="hover:text-blue-900 hover:underline"
                      title="To'lovlar tarixini ko'rish"
                    >
                      {s.fullName}
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
                  <td className="font-mono text-xs text-slate-500">{s.secondaryPhone || '—'}</td>
                  <td>
                    {s.schoolId ? (
                      <Link
                        to={`/superadmin/schools/${s.schoolId}`}
                        className="inline-flex items-center gap-1.5 group hover:text-blue-900"
                      >
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 group-hover:bg-blue-100">
                          № {s.schoolNumber || s.schoolId}
                        </span>
                        <span className="text-xs text-slate-800 font-medium group-hover:underline">
                          {s.schoolName || schoolMap.get(s.schoolId) || `Maktab #${s.schoolId}`}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    {s.teacherName ? (
                      <Link
                        to={s.teacherId ? (s.schoolId ? `/superadmin/schools/${s.schoolId}/teachers/${s.teacherId}` : `/superadmin/teachers/${s.teacherId}/students`) : '#'}
                        className="inline-flex flex-col group"
                        title="O'qituvchining o'quvchilari ro'yxatiga o'tish"
                      >
                        <span className="text-xs font-semibold text-blue-900 group-hover:text-blue-700 group-hover:underline flex items-center gap-1">
                          <span>👨‍🏫</span>
                          <span>{s.teacherName}</span>
                        </span>
                        {s.teacherPhone && (
                          <span className="font-mono text-[10px] text-slate-400">{s.teacherPhone}</span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
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
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">O'quvchilar topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
