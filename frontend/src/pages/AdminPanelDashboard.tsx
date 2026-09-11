import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { api } from './../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';
import { getErrorMessage } from '../lib/errors';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import StudentPaymentHistoryPage from './StudentPaymentHistoryPage';

interface Student {
  id: number;
  fullName: string;
  phone: string;
  secondaryPhone?: string | null;
  callStatus: string;
  studyStatus: string;
  schoolId?: number | null;
  teacherId?: number | null;
  schoolName?: string | null;
  schoolNumber?: string | null;
  teacherName?: string | null;
  teacherPhone?: string | null;
  createdAt: string;
}

// ── Payment Modal — records a payment for a student who already has a first one ──
const PaymentModal = ({ student, onClose }: { student: Student; onClose: () => void }) => {
  const qc = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [amount, setAmount] = useState('');
  const [paidForMonth, setPaidForMonth] = useState(currentMonth);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const { confirm, showToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (body: { amountUzs: number; paidForMonth: string; paymentMethod?: string; notes?: string }) =>
      api.post(`/students/${student.id}/monthly-payments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      showToast({
        type: 'success',
        title: "To'lov qabul qilindi",
        message: `${student.fullName} uchun ${Number(amount).toLocaleString()} UZS to'lov muvaffaqiyatli saqlandi.`,
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
    const confirmed = await confirm({
      title: "Oylik to'lovni qabul qilishni tasdiqlaysizmi?",
      message: "To'lov saqlanadi va to'lovlar tarixiga qo'shiladi.",
      details: [
        { label: "O'quvchi F.I.SH", value: student.fullName },
        { label: "To'lov summasi", value: `${numAmount.toLocaleString()} UZS` },
        { label: "To'lov oyi", value: paidForMonth },
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
          <input type="number" className="input" placeholder="500000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
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
          <input type="text" className="input" placeholder="Izoh…" value={notes} onChange={(e) => setNotes(e.target.value)} />
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

// ── Shared students table — used by the "all", school, and teacher drill-down views ──
const StudentsTable = ({
  students,
  isLoading,
  onToggleStudyStatus,
  onPay,
}: {
  students: Student[];
  isLoading: boolean;
  onToggleStudyStatus: (s: Student) => void;
  onPay: (s: Student) => void;
}) => (
  <div className="card">
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>F.I.SH</th>
            <th>Telefon</th>
            <th>Maktab (№)</th>
            <th>O'qituvchi</th>
            <th>Qo'ng'iroq holati</th>
            <th>O'qish holati</th>
            <th>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={7} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
          )}
          {students.map((s) => (
            <tr key={s.id}>
              <td className="font-semibold text-slate-900">
                <Link to={`/admin/students/${s.id}/payments`} className="hover:text-blue-900 hover:underline" title="To'lovlar tarixini ko'rish">
                  {s.fullName}
                </Link>
              </td>
              <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
              <td>
                {s.schoolId ? (
                  <Link
                    to={`/admin/students/school/${s.schoolId}`}
                    className="inline-flex items-center gap-1.5 group hover:text-blue-900"
                    title="Ushbu maktabdagi o'quvchilarni ko'rish"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 group-hover:bg-blue-100">
                      № {s.schoolNumber || s.schoolId}
                    </span>
                    <span className="text-xs text-slate-700 group-hover:underline">{s.schoolName}</span>
                  </Link>
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )}
              </td>
              <td>
                {s.teacherName && s.teacherId ? (
                  <Link
                    to={`/admin/students/teacher/${s.teacherId}`}
                    className="inline-flex flex-col group"
                    title="Ushbu o'qituvchining o'quvchilarini ko'rish"
                  >
                    <span className="text-xs font-semibold text-blue-900 group-hover:text-blue-700 group-hover:underline">
                      👨‍🏫 {s.teacherName}
                    </span>
                    {s.teacherPhone && <span className="font-mono text-[10px] text-slate-400">{s.teacherPhone}</span>}
                  </Link>
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )}
              </td>
              <td><StatusBadge value={s.callStatus} type="call" /></td>
              <td>
                <button
                  onClick={() => onToggleStudyStatus(s)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  title="O'qish holatini o'zgartirish"
                >
                  <StatusBadge value={s.studyStatus} type="study" />
                </button>
              </td>
              <td>
                <button onClick={() => onPay(s)} className="btn-primary text-xs py-1 px-2.5">
                  + To'lov
                </button>
              </td>
            </tr>
          ))}
          {!isLoading && students.length === 0 && (
            <tr><td colSpan={7} className="text-center py-8 text-slate-400">O'quvchilar topilmadi</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// ── Shared logic: fetch + study-status toggle + payment modal, parameterized by filters ──
const useAdminStudents = (extraParams: Record<string, string>) => {
  const qc = useQueryClient();
  const { confirm, showToast } = useFeedback();
  const [studyFilter, setStudyFilter] = useState('');
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);

  const params = new URLSearchParams({ hasFirstPayment: 'true', ...extraParams });
  if (studyFilter) params.set('studyStatus', studyFilter);

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['admin-students', JSON.stringify(extraParams), studyFilter],
    queryFn: () => api.get(`/students?${params.toString()}`).then((r) => r.data),
  });

  const studyStatusMutation = useMutation({
    mutationFn: ({ id, studyStatus }: { id: number; studyStatus: string }) =>
      api.patch(`/students/${id}/study-status`, { studyStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-students'] }),
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "O'qish holatini yangilashda xatolik yuz berdi.") });
    },
  });

  const handleStudyStatusToggle = async (s: Student) => {
    const nextStatus = s.studyStatus === 'ACTIVE' ? 'NOACTIVE' : 'ACTIVE';
    const confirmed = await confirm({
      title: "O'qish holatini o'zgartirish",
      message:
        nextStatus === 'NOACTIVE'
          ? `Diqqat! "${s.fullName}" faol emas deb belgilansinmi? Kelgusi oylar uchun komissiya hisoblanmaydi.`
          : `"${s.fullName}" o'quvchisi yana faol deb belgilansinmi?`,
      details: [
        { label: "O'quvchi", value: s.fullName },
        { label: "Yangi holat", value: nextStatus === 'ACTIVE' ? 'Faol (ACTIVE)' : 'Faol emas (NOACTIVE)' },
      ],
      confirmText: "Ha, o'zgartirish",
      variant: nextStatus === 'NOACTIVE' ? 'warning' : 'primary',
    });
    if (!confirmed) return;
    studyStatusMutation.mutate(
      { id: s.id, studyStatus: nextStatus },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: "O'qish holati yangilandi",
            message: `"${s.fullName}" uchun o'qish holati "${nextStatus === 'ACTIVE' ? 'Faol' : 'Faol emas'}" ga o'zgartirildi.`,
          });
        },
      },
    );
  };

  return { students, isLoading, studyFilter, setStudyFilter, payingStudent, setPayingStudent, handleStudyStatusToggle };
};

const StudyFilterSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <select className="input w-full sm:w-auto text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">Barcha o'qish holatlari</option>
    <option value="ACTIVE">Faol (ACTIVE)</option>
    <option value="NOACTIVE">Faol emas (NOACTIVE)</option>
  </select>
);

// ── All students (index) ──────────────────────────────────────────────────────────
const AdminStudentsPage = () => {
  const { students, isLoading, studyFilter, setStudyFilter, payingStudent, setPayingStudent, handleStudyStatusToggle } =
    useAdminStudents({});
  const [search, setSearch] = useState('');

  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      (s.secondaryPhone && s.secondaryPhone.toLowerCase().includes(q)) ||
      (s.teacherName && s.teacherName.toLowerCase().includes(q)) ||
      (s.schoolName && s.schoolName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="page-title">O'quvchilarim</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sotuv menejeri birinchi to'lovni qabul qilgan o'quvchilar — o'qish holati va keyingi to'lovlar shu yerda boshqariladi
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          className="input w-full sm:w-64 text-sm"
          placeholder="Qidiruv: F.I.SH yoki telefon raqami…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <StudyFilterSelect value={studyFilter} onChange={setStudyFilter} />
        <span className="text-xs text-slate-500 sm:ml-auto font-medium">Topildi: {filtered.length} ta o'quvchi</span>
      </div>

      <StudentsTable students={filtered} isLoading={isLoading} onToggleStudyStatus={handleStudyStatusToggle} onPay={setPayingStudent} />

      {payingStudent && <PaymentModal student={payingStudent} onClose={() => setPayingStudent(null)} />}
    </div>
  );
};

// ── Drill-down: students of one school ──────────────────────────────────────────────
interface School { id: number; name: string; schoolNumber?: string | null; }

const AdminSchoolStudentsPage = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { students, isLoading, studyFilter, setStudyFilter, payingStudent, setPayingStudent, handleStudyStatusToggle } =
    useAdminStudents({ schoolId: schoolId ?? '' });

  const { data: school } = useQuery<School>({
    queryKey: ['school', schoolId],
    queryFn: () => api.get(`/schools/${schoolId}`).then((r) => r.data),
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-700 text-sm" title="Orqaga">
          ← Orqaga
        </button>
        <div>
          <h1 className="page-title">
            {school ? `№ ${school.schoolNumber || school.id} — ${school.name}` : 'Maktab'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Ushbu maktabdagi birinchi to'lovni amalga oshirgan o'quvchilar</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <StudyFilterSelect value={studyFilter} onChange={setStudyFilter} />
        <span className="text-xs text-slate-500 sm:ml-auto font-medium">Topildi: {students.length} ta o'quvchi</span>
      </div>

      <StudentsTable students={students} isLoading={isLoading} onToggleStudyStatus={handleStudyStatusToggle} onPay={setPayingStudent} />

      {payingStudent && <PaymentModal student={payingStudent} onClose={() => setPayingStudent(null)} />}
    </div>
  );
};

// ── Drill-down: students of one teacher ─────────────────────────────────────────────
interface TeacherInfo { id: number; fullName: string; phone: string; }

const AdminTeacherStudentsPage = () => {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { students, isLoading, studyFilter, setStudyFilter, payingStudent, setPayingStudent, handleStudyStatusToggle } =
    useAdminStudents({ teacherId: teacherId ?? '' });

  const { data: teacher } = useQuery<TeacherInfo>({
    queryKey: ['user', teacherId],
    queryFn: () => api.get(`/users/${teacherId}`).then((r) => r.data),
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-700 text-sm" title="Orqaga">
          ← Orqaga
        </button>
        <div>
          <h1 className="page-title">{teacher ? `👨‍🏫 ${teacher.fullName}` : "O'qituvchi"}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {teacher?.phone && <span className="font-mono">{teacher.phone} · </span>}
            Ushbu o'qituvchining birinchi to'lovni amalga oshirgan o'quvchilari
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <StudyFilterSelect value={studyFilter} onChange={setStudyFilter} />
        <span className="text-xs text-slate-500 sm:ml-auto font-medium">Topildi: {students.length} ta o'quvchi</span>
      </div>

      <StudentsTable students={students} isLoading={isLoading} onToggleStudyStatus={handleStudyStatusToggle} onPay={setPayingStudent} />

      {payingStudent && <PaymentModal student={payingStudent} onClose={() => setPayingStudent(null)} />}
    </div>
  );
};

const AdminPanelDashboard = () => (
  <Layout>
    <Routes>
      <Route index element={<AdminStudentsPage />} />
      <Route path="students" element={<AdminStudentsPage />} />
      <Route path="students/school/:schoolId" element={<AdminSchoolStudentsPage />} />
      <Route path="students/teacher/:teacherId" element={<AdminTeacherStudentsPage />} />
      <Route path="students/:studentId/payments" element={<StudentPaymentHistoryPage />} />
    </Routes>
  </Layout>
);

export default AdminPanelDashboard;
