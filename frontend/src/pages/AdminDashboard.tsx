import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Routes, Route, Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';

interface Student {
  id: number;
  fullName: string;
  phone: string;
  secondaryPhone?: string | null;
  callStatus: string;
  studyStatus: string;
  callNote?: string | null;
  schoolId?: number | null;
  teacherId?: number | null;
  schoolName?: string | null;
  schoolNumber?: string | null;
  teacherName?: string | null;
  teacherPhone?: string | null;
  createdAt: string;
}

interface Commission {
  id: number;
  userId: number;
  studentId: number;
  amountUzs: number;
  type: string;
  status: string;
  paidAt?: string | null;
  createdAt: string;
}

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  description: string;
  actorUserId: number;
  createdAt: string;
}

// ── Payment Modal ────────────────────────────────────────────────────────────────
const PaymentModal = ({ student, onClose }: { student: Student; onClose: () => void }) => {
  const qc = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [amount, setAmount] = useState('');
  const [paidForMonth, setPaidForMonth] = useState(currentMonth);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const { confirm, showToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (body: {
      amountUzs: number;
      paidForMonth: string;
      paymentMethod?: string;
      notes?: string;
    }) => api.post(`/students/${student.id}/monthly-payments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['commissions'] });
      qc.invalidateQueries({ queryKey: ['teacher-students'] });
      showToast({
        type: 'success',
        title: "To'lov qabul qilindi",
        message: `${student.fullName} uchun ${Number(amount).toLocaleString()} UZS to'lov muvaffaqiyatli saqlandi va komissiyalar hisoblandi!`,
      });
      onClose();
    },
    onError: () => {
      setError('To‘lovni saqlashda xatolik yuz berdi');
      showToast({
        type: 'error',
        title: 'Xatolik',
        message: 'To‘lovni saqlashda xatolik yuz berdi.',
      });
    },
  });

  const handleSave = async () => {
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('To‘lov summasini to‘g‘ri kiriting');
      return;
    }

    const confirmed = await confirm({
      title: "Oylik to'lovni qabul qilishni tasdiqlaysizmi?",
      message: "To'lov kiritilgach, ushbu o'quvchini jalb qilgan o'qituvchi va direktor hisobiga avtomatik komissiya yoziladi.",
      details: [
        { label: "O'quvchi F.I.SH", value: student.fullName },
        { label: "Telefon", value: student.phone },
        { label: "To'lov summasi", value: `${numAmount.toLocaleString()} UZS` },
        { label: "To'lov oyi", value: paidForMonth },
        { label: "To'lov usuli", value: paymentMethod === 'CASH' ? 'Naqd pul (CASH)' : paymentMethod === 'CARD' ? 'Karta orqali' : paymentMethod },
      ],
      confirmText: "Ha, to'lovni qabul qilish",
    });
    if (!confirmed) return;

    mutation.mutate({
      amountUzs: numAmount,
      paidForMonth,
      paymentMethod,
      notes: notes || undefined,
    });
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
          <input
            type="number"
            className="input"
            placeholder="500000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Qaysi oy uchun</label>
            <input
              type="month"
              className="input"
              value={paidForMonth}
              onChange={(e) => setPaidForMonth(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">To'lov usuli</label>
            <select
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">Naqd pul (CASH)</option>
              <option value="CARD">Plastik karta (CARD)</option>
              <option value="TRANSFER">O'tkazma (TRANSFER)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            className="input"
            placeholder="Birinchi oylik to'lov…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <div className="notice-error">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            className="btn-primary flex-1"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saqlanmoqda…' : "To'lovni saqlash"}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Call Status & Reason Modal ───────────────────────────────────────────────────
const CallStatusModal = ({
  student,
  onClose,
}: {
  student: Student;
  onClose: () => void;
}) => {
  const qc = useQueryClient();
  const [callStatus, setCallStatus] = useState(student.callStatus || 'WAITING');
  const [callNote, setCallNote] = useState(student.callNote || '');
  const [updateStudyStatus, setUpdateStudyStatus] = useState(false);
  const [targetStudyStatus, setTargetStudyStatus] = useState(student.studyStatus || 'STOPPED');
  const [error, setError] = useState('');
  const { showToast } = useFeedback();

  const callMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/students/${student.id}/call-status`, {
        callStatus,
        callNote: callNote.trim() || undefined,
      });
      if (updateStudyStatus && targetStudyStatus !== student.studyStatus) {
        await api.patch(`/students/${student.id}/study-status`, {
          studyStatus: targetStudyStatus,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['teacher-students'] });
      showToast({
        type: 'success',
        title: 'Holat yangilandi',
        message: `"${student.fullName}" qo'ng'iroq natijasi va sababi saqlandi.`,
      });
      onClose();
    },
    onError: () => {
      setError("Qo'ng'iroq holatini saqlashda xatolik yuz berdi");
      showToast({
        type: 'error',
        title: 'Xatolik',
        message: "Qo'ng'iroq holatini yangilashda xatolik yuz berdi.",
      });
    },
  });

  const handleSave = () => {
    setError('');
    callMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Qo'ng'iroq natijasi va sababi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {student.fullName} ({student.phone})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && <div className="notice-error text-xs">{error}</div>}

        <div>
          <label className="label text-xs font-semibold text-slate-700">Qo'ng'iroq natijasi (Holati)</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {[
              { val: 'WAITING', label: 'Kutilmoqda', color: 'border-amber-300 bg-amber-50 text-amber-900' },
              { val: 'ACCEPTED', label: 'Qabul qilindi', color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
              { val: 'REJECTED', label: 'Rad etildi', color: 'border-rose-300 bg-rose-50 text-rose-900' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => {
                  setCallStatus(opt.val);
                  if (opt.val === 'ACCEPTED') {
                    setUpdateStudyStatus(true);
                    setTargetStudyStatus('STUDYING');
                  } else if (opt.val === 'REJECTED') {
                    setUpdateStudyStatus(true);
                    setTargetStudyStatus('STOPPED');
                  }
                }}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                  callStatus === opt.val
                    ? `${opt.color} ring-2 ring-blue-500 font-bold shadow-xs`
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label text-xs font-semibold text-slate-700">
            {callStatus === 'REJECTED'
              ? 'Rad etish sababi:'
              : callStatus === 'WAITING'
              ? 'Kutish sababi / Qachon qo‘ng‘iroq qilish kerak:'
              : 'Qo‘shimcha izoh / Kelishuv:'}
          </label>
          <textarea
            className="input text-xs w-full h-24 mt-1 py-2"
            placeholder={
              callStatus === 'REJECTED'
                ? "Rad etish sababi (masalan: Narx qimmatlik qildi, boshqa markazni tanladi, uzoq masofa...)"
                : callStatus === 'WAITING'
                ? "Kutish sababi (masalan: Ertaga soat 14:00 da qayta qo'ng'iroq qilishni so'radi, ota-onasi bilan gaplashadi...)"
                : "Qo'shimcha izoh yoki dars vaqti bo'yicha kelishuv..."
            }
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
          />
        </div>

        {/* Study status option */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={updateStudyStatus}
              onChange={(e) => setUpdateStudyStatus(e.target.checked)}
              className="rounded text-blue-900 focus:ring-blue-500 cursor-pointer"
            />
            <span>O'qish holatini ham birga yangilash</span>
          </label>
          {updateStudyStatus && (
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="modalStudyStatus"
                  value="STUDYING"
                  checked={targetStudyStatus === 'STUDYING'}
                  onChange={() => setTargetStudyStatus('STUDYING')}
                />
                <span>O'qiyapti (STUDYING)</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="modalStudyStatus"
                  value="STOPPED"
                  checked={targetStudyStatus === 'STOPPED'}
                  onChange={() => setTargetStudyStatus('STOPPED')}
                />
                <span>O'qimayapti (STOPPED)</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-1.5 px-3"
            disabled={callMutation.isPending}
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={callMutation.isPending}
            className={`text-xs py-1.5 px-4 rounded-lg font-semibold text-white shadow-xs transition-colors cursor-pointer ${
              callStatus === 'REJECTED'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#1E3A8A] hover:bg-blue-900'
            }`}
          >
            {callMutation.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Students Page ────────────────────────────────────────────────────────────────
const StudentsPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const basePath = user?.role === 'MANAGER' ? '/manager' : '/admin';
  const [callFilter, setCallFilter] = useState('');
  const [studyFilter, setStudyFilter] = useState('');
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [callStatusStudent, setCallStatusStudent] = useState<Student | null>(null);

  const params = new URLSearchParams();
  if (callFilter) params.set('callStatus', callFilter);
  if (studyFilter) params.set('studyStatus', studyFilter);

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['students', callFilter, studyFilter],
    queryFn: () => api.get(`/students?${params.toString()}`).then((r) => r.data),
  });
  const { confirm, showToast } = useFeedback();

  const callStatusMutation = useMutation({
    mutationFn: ({ id, callStatus }: { id: number; callStatus: string }) =>
      api.patch(`/students/${id}/call-status`, { callStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });

  const studyStatusMutation = useMutation({
    mutationFn: ({ id, studyStatus }: { id: number; studyStatus: string }) =>
      api.patch(`/students/${id}/study-status`, { studyStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });

  const handleCallStatusChange = async (s: Student, newStatus: string) => {
    if (s.callStatus === newStatus) return;
    const statusLabels: Record<string, string> = {
      WAITING: 'Kutilmoqda (WAITING)',
      ACCEPTED: 'Qabul qilindi (ACCEPTED)',
      REJECTED: 'Rad etildi (REJECTED)',
    };
    const confirmed = await confirm({
      title: "Qo'ng'iroq holatini o'zgartirish",
      message: `"${s.fullName}" uchun qo'ng'iroq natijasini "${statusLabels[newStatus] || newStatus}" ga o'zgartirishni tasdiqlaysizmi?`,
      details: [
        { label: "O'quvchi", value: s.fullName },
        { label: "Joriy holat", value: statusLabels[s.callStatus] || s.callStatus },
        { label: "Yangi holat", value: statusLabels[newStatus] || newStatus },
      ],
      confirmText: "Ha, o'zgartirish",
      variant: newStatus === 'REJECTED' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    callStatusMutation.mutate(
      { id: s.id, callStatus: newStatus },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: 'Holat yangilandi',
            message: `"${s.fullName}" qo'ng'iroq holati muvaffaqiyatli yangilandi.`,
          });
        },
        onError: () => {
          showToast({
            type: 'error',
            title: 'Xatolik',
            message: "Qo'ng'iroq holatini yangilashda xatolik yuz berdi.",
          });
        },
      }
    );
  };

  const handleStudyStatusToggle = async (s: Student) => {
    const nextStatus = s.studyStatus === 'STUDYING' ? 'STOPPED' : 'STUDYING';
    const confirmed = await confirm({
      title: "O'qish holatini o'zgartirish",
      message:
        nextStatus === 'STOPPED'
          ? `Diqqat! "${s.fullName}" o'qishni to'xtatgan deb belgilansinmi? Kelgusi oylar uchun komissiya hisoblanmaydi.`
          : `"${s.fullName}" o'quvchisi yana faol o'qimoqda deb belgilansinmi?`,
      details: [
        { label: "O'quvchi", value: s.fullName },
        { label: "Yangi holat", value: nextStatus === 'STUDYING' ? "O'qiyapti (Faol)" : "O'qish to'xtatildi (STOPPED)" },
      ],
      confirmText: "Ha, o'zgartirish",
      variant: nextStatus === 'STOPPED' ? 'warning' : 'primary',
    });
    if (!confirmed) return;

    studyStatusMutation.mutate(
      { id: s.id, studyStatus: nextStatus },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: "O'qish holati yangilandi",
            message: `"${s.fullName}" uchun o'qish holati "${nextStatus === 'STUDYING' ? 'O‘qiyapti' : 'To‘xtatildi'}" ga o'zgartirildi.`,
          });
        },
        onError: () => {
          showToast({
            type: 'error',
            title: 'Xatolik',
            message: "O'qish holatini o'zgartirishda xatolik yuz berdi.",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {payingStudent && (
        <PaymentModal student={payingStudent} onClose={() => setPayingStudent(null)} />
      )}
      {callStatusStudent && (
        <CallStatusModal student={callStatusStudent} onClose={() => setCallStatusStudent(null)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">O'quvchilar nazorati</h1>
          <p className="text-sm text-slate-500 mt-0.5">Qo'ng'iroqlar, o'qish holati va to'lovlar monitoringi</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input w-full sm:w-auto text-sm"
          value={callFilter}
          onChange={(e) => setCallFilter(e.target.value)}
        >
          <option value="">Barcha qo'ng'iroq holatlari</option>
          <option value="WAITING">Kutilmoqda (WAITING)</option>
          <option value="ACCEPTED">Qabul qilindi (ACCEPTED)</option>
          <option value="REJECTED">Rad etildi (REJECTED)</option>
        </select>
        <select
          className="input w-full sm:w-auto text-sm"
          value={studyFilter}
          onChange={(e) => setStudyFilter(e.target.value)}
        >
          <option value="">Barcha o'qish holatlari</option>
          <option value="STUDYING">O'qiyapti (STUDYING)</option>
          <option value="STOPPED">O'qimayapti (STOPPED)</option>
        </select>
      </div>

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
                <th>Sana</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-slate-900">{s.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
                  <td>
                    {s.schoolId ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900">
                          № {s.schoolNumber || s.schoolId}
                        </span>
                        <span className="text-xs text-slate-700">{s.schoolName}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    {s.teacherName ? (
                      <div>
                        {s.teacherId ? (
                          <Link
                            to={`${basePath}/teachers/${s.teacherId}/students`}
                            className="font-bold text-blue-900 hover:text-blue-700 hover:underline inline-flex items-center gap-1 group"
                            title="O'qituvchining barcha o'quvchilarini ko'rish"
                          >
                            <span>👨‍🏫 {s.teacherName}</span>
                            <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-slate-800">👨‍🏫 {s.teacherName}</span>
                        )}
                        {s.teacherPhone && (
                          <span className="block font-mono text-[10px] text-slate-400">{s.teacherPhone}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setCallStatusStudent(s)}
                      className="text-left group cursor-pointer hover:opacity-90"
                      title="Qo'ng'iroq holati va sababini o'zgartirish uchun bosing"
                    >
                      <div className="flex items-center gap-1.5">
                        <StatusBadge value={s.callStatus} type="call" />
                        <span className="text-[10px] text-blue-600 group-hover:underline">✏️</span>
                      </div>
                      {s.callNote && (
                        <span className="block mt-1 text-[11px] text-slate-500 italic max-w-[180px] truncate" title={s.callNote}>
                          Izoh: {s.callNote}
                        </span>
                      )}
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => handleStudyStatusToggle(s)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      title="O'qish holatini o'zgartirish"
                    >
                      <StatusBadge value={s.studyStatus} type="study" />
                    </button>
                  </td>
                  <td className="text-slate-400 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => setPayingStudent(s)}
                      className="btn-primary text-xs py-1 px-2.5"
                    >
                      + To'lov
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && students.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">O'quvchilar topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Commissions Page ───────────────────────────────────────────────────────────
const AdminCommissionsPage = () => {
  const qc = useQueryClient();
  const { data: commissions = [], isLoading } = useQuery<Commission[]>({
    queryKey: ['commissions'],
    queryFn: () => api.get('/commissions').then((r) => r.data),
  });
  const { confirm, showToast } = useFeedback();

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/commissions/${id}/mark-paid`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });

  const handleMarkPaid = async (c: Commission) => {
    const confirmed = await confirm({
      title: "Komissiyani to'langan deb tasdiqlash",
      message: "Diqqat: Ushbu komissiya to'langan deb belgilangach, qaytarib bo'lmaydi.",
      details: [
        { label: "Komissiya ID", value: `#${c.id}` },
        { label: "Foydalanuvchi ID", value: c.userId },
        { label: "To'lov summasi", value: `${c.amountUzs.toLocaleString()} UZS` },
        { label: "Komissiya turi", value: c.type },
      ],
      confirmText: "Ha, to'langan deb belgilash",
    });
    if (!confirmed) return;

    markPaidMutation.mutate(c.id, {
      onSuccess: () => {
        showToast({
          type: 'success',
          title: "Komissiya to'landi",
          message: `#${c.id} raqamli komissiya muvaffaqiyatli to'langan deb belgilandi!`,
        });
      },
      onError: () => {
        showToast({
          type: 'error',
          title: 'Xatolik',
          message: 'Komissiyani tasdiqlashda xatolik yuz berdi.',
        });
      },
    });
  };

  const total = commissions.reduce((acc, c) => acc + c.amountUzs, 0);
  const pending = commissions.filter((c) => c.status !== 'PAID').reduce((acc, c) => acc + c.amountUzs, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Komissiyalar monitoringi</h1>
        <p className="text-sm text-slate-500 mt-0.5">O'qituvchi va direktorlar komissiyalari hisobi</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase">Jami hisoblangan</p>
          <p className="text-2xl font-bold text-slate-900">{total.toLocaleString()} UZS</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase">Kutilayotgan (To'lanmagan)</p>
          <p className="text-2xl font-bold text-amber-600">{pending.toLocaleString()} UZS</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Foydalanuvchi ID</th>
                <th>Turi</th>
                <th>Summasi</th>
                <th>Holati</th>
                <th>Sana</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>}
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs text-slate-500">#{c.id}</td>
                  <td className="font-mono text-xs font-bold text-slate-800">{c.userId}</td>
                  <td><span className="font-mono text-xs text-blue-900 bg-blue-50 px-2 py-0.5 rounded font-semibold">{c.type}</span></td>
                  <td className="font-bold text-slate-900">{c.amountUzs.toLocaleString()} UZS</td>
                  <td><StatusBadge value={c.status} type="commission" /></td>
                  <td className="text-slate-400 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    {c.status !== 'PAID' ? (
                      <button
                        onClick={() => handleMarkPaid(c)}
                        disabled={markPaidMutation.isPending}
                        className="btn-secondary text-xs py-1 px-2.5"
                      >
                        To'landi deb belgilash
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-semibold">✓ To'langan</span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && commissions.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Komissiyalar mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Teacher Students Detail Page for Admin / Manager ─────────────────────────
const AdminTeacherStudentsPage = () => {
  const { teacherId } = useParams<{ teacherId: string }>();
  const { user } = useAuth();
  const basePath = user?.role === 'MANAGER' ? '/manager' : '/admin';
  const tIdNum = Number(teacherId);
  const qc = useQueryClient();

  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [callStatusStudent, setCallStatusStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [callFilter, setCallFilter] = useState('');
  const [studyFilter, setStudyFilter] = useState('');

  const { data: teacher, isLoading: teacherLoading } = useQuery<{
    id: number;
    fullName: string;
    phone: string;
    email?: string | null;
    isActive: boolean;
    schoolId?: number | null;
    role?: string;
  }>({
    queryKey: ['teacher', tIdNum],
    queryFn: () => api.get(`/users/${tIdNum}`).then((r) => r.data),
    enabled: !isNaN(tIdNum),
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ['teacher-students', tIdNum],
    queryFn: () => api.get(`/students?teacherId=${tIdNum}`).then((r) => r.data),
    enabled: !isNaN(tIdNum),
  });
  const { confirm, showToast } = useFeedback();

  const callStatusMutation = useMutation({
    mutationFn: ({ id, callStatus }: { id: number; callStatus: string }) =>
      api.patch(`/students/${id}/call-status`, { callStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-students', tIdNum] });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const studyStatusMutation = useMutation({
    mutationFn: ({ id, studyStatus }: { id: number; studyStatus: string }) =>
      api.patch(`/students/${id}/study-status`, { studyStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-students', tIdNum] });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const handleTeacherStudentCallStatus = async (s: Student, newStatus: string) => {
    if (s.callStatus === newStatus) return;
    const statusLabels: Record<string, string> = {
      WAITING: 'Kutilmoqda (WAITING)',
      ACCEPTED: 'Qabul qilindi (ACCEPTED)',
      REJECTED: 'Rad etildi (REJECTED)',
    };
    const confirmed = await confirm({
      title: "Qo'ng'iroq holatini o'zgartirish",
      message: `"${s.fullName}" uchun qo'ng'iroq natijasini "${statusLabels[newStatus] || newStatus}" ga o'zgartirishni tasdiqlaysizmi?`,
      details: [
        { label: "O'quvchi", value: s.fullName },
        { label: "Yangi holat", value: statusLabels[newStatus] || newStatus },
      ],
      confirmText: "Ha, o'zgartirish",
      variant: newStatus === 'REJECTED' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    callStatusMutation.mutate(
      { id: s.id, callStatus: newStatus },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: 'Holat yangilandi',
            message: `"${s.fullName}" qo'ng'iroq holati muvaffaqiyatli o'zgartirildi.`,
          });
        },
        onError: () => {
          showToast({
            type: 'error',
            title: 'Xatolik',
            message: "Qo'ng'iroq holatini yangilashda xatolik yuz berdi.",
          });
        },
      }
    );
  };

  const handleTeacherStudentStudyStatus = async (s: Student) => {
    const nextStatus = s.studyStatus === 'STUDYING' ? 'STOPPED' : 'STUDYING';
    const confirmed = await confirm({
      title: "O'qish holatini o'zgartirish",
      message:
        nextStatus === 'STOPPED'
          ? `"${s.fullName}" o'qishni to'xtatgan deb belgilansinmi?`
          : `"${s.fullName}" yana faol o'qimoqda deb belgilansinmi?`,
      details: [
        { label: "O'quvchi", value: s.fullName },
        { label: "Yangi holat", value: nextStatus === 'STUDYING' ? "O'qiyapti (Faol)" : "O'qish to'xtatildi (STOPPED)" },
      ],
      confirmText: "Ha, o'zgartirish",
      variant: nextStatus === 'STOPPED' ? 'warning' : 'primary',
    });
    if (!confirmed) return;

    studyStatusMutation.mutate(
      { id: s.id, studyStatus: nextStatus },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: "O'qish holati yangilandi",
            message: `"${s.fullName}" uchun o'qish holati "${nextStatus === 'STUDYING' ? 'O‘qiyapti' : 'To‘xtatildi'}" ga o'zgartirildi.`,
          });
        },
        onError: () => {
          showToast({
            type: 'error',
            title: 'Xatolik',
            message: "O'qish holatini o'zgartirishda xatolik yuz berdi.",
          });
        },
      }
    );
  };

  const filteredStudents = students.filter((s) => {
    if (callFilter && s.callStatus !== callFilter) return false;
    if (studyFilter && s.studyStatus !== studyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.fullName.toLowerCase().includes(q) || s.phone.includes(q);
    }
    return true;
  });

  const studyingCount = students.filter((s) => s.studyStatus === 'STUDYING').length;
  const stoppedCount = students.filter((s) => s.studyStatus === 'STOPPED').length;
  const waitingCount = students.filter((s) => s.callStatus === 'WAITING').length;

  if (teacherLoading) {
    return <div className="p-8 text-center text-slate-500">O'qituvchi ma'lumotlari yuklanmoqda…</div>;
  }

  if (!teacher) {
    return (
      <div className="card p-8 text-center space-y-4">
        <p className="text-slate-600 font-semibold">O'qituvchi topilmadi</p>
        <Link to={`${basePath}/students`} className="btn-primary inline-block">
          ← O'quvchilar ro'yxatiga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl animate-fadeIn">
      {payingStudent && (
        <PaymentModal
          student={payingStudent}
          onClose={() => {
            setPayingStudent(null);
            qc.invalidateQueries({ queryKey: ['teacher-students', tIdNum] });
          }}
        />
      )}
      {callStatusStudent && (
        <CallStatusModal
          student={callStatusStudent}
          onClose={() => {
            setCallStatusStudent(null);
            qc.invalidateQueries({ queryKey: ['teacher-students', tIdNum] });
          }}
        />
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
        <Link to={`${basePath}/students`} className="text-blue-900 hover:underline">
          O'quvchilar ro'yxati
        </Link>
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
                <StatusBadge value={teacher.isActive ? 'true' : 'false'} type="active" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                <span className="font-mono text-blue-900 font-semibold">{teacher.phone}</span>
                {teacher.email && <span>• {teacher.email}</span>}
                {teacher.schoolId && <span>• Maktab ID: #{teacher.schoolId}</span>}
              </div>
            </div>
          </div>

          <Link to={`${basePath}/students`} className="btn-secondary text-xs py-1.5 px-3 self-start sm:self-auto">
            ← Barcha o'quvchilarga qaytish
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">Jami O'quvchilar</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{students.length} ta</p>
            <span className="text-[11px] text-slate-400">Ustoz jalb qilgan</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Faol O'qiyotganlar</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{studyingCount} ta</p>
            <span className="text-[11px] text-emerald-600 font-medium">
              {students.length > 0 ? Math.round((studyingCount / students.length) * 100) : 0}% davomat
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-rose-700 uppercase">O'qishni to'xtatganlar</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{stoppedCount} ta</p>
            <span className="text-[11px] text-slate-400">Ketganlar</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-amber-700 uppercase">Kutilayotganlar</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{waitingCount} ta</p>
            <span className="text-[11px] text-slate-400">Qo'ng'iroq kutilmoqda</span>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="section-title">
              {teacher.fullName} o'quvchilari ({filteredStudents.length} / {students.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Qo'ng'iroq holati, o'qish jarayoni va to'lov kiritish
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              className="input text-xs py-1.5 px-3 w-44"
              placeholder="Qidiruv (ism, tel)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input text-xs py-1.5 px-2 w-auto"
              value={studyFilter}
              onChange={(e) => setStudyFilter(e.target.value)}
            >
              <option value="">O'qish holati: Barchasi</option>
              <option value="STUDYING">O'qiyapti</option>
              <option value="STOPPED">To'xtatgan</option>
            </select>
            <select
              className="input text-xs py-1.5 px-2 w-auto"
              value={callFilter}
              onChange={(e) => setCallFilter(e.target.value)}
            >
              <option value="">Qo'ng'iroq: Barchasi</option>
              <option value="WAITING">Kutilmoqda</option>
              <option value="ACCEPTED">Qabul qilindi</option>
              <option value="REJECTED">Rad etildi</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>F.I.SH</th>
                <th>Telefon</th>
                <th>Qo'ng'iroq holati</th>
                <th>O'qish holati</th>
                <th>Ro'yxat sanasi</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {studentsLoading && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>
              )}
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="font-semibold text-slate-900">{s.fullName}</td>
                  <td className="font-mono text-xs text-blue-900 font-bold">{s.phone}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setCallStatusStudent(s)}
                      className="text-left group cursor-pointer hover:opacity-90"
                      title="Qo'ng'iroq holati va sababini o'zgartirish uchun bosing"
                    >
                      <div className="flex items-center gap-1.5">
                        <StatusBadge value={s.callStatus} type="call" />
                        <span className="text-[10px] text-blue-600 group-hover:underline">✏️</span>
                      </div>
                      {s.callNote && (
                        <span className="block mt-1 text-[11px] text-slate-500 italic max-w-[180px] truncate" title={s.callNote}>
                          Izoh: {s.callNote}
                        </span>
                      )}
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => handleTeacherStudentStudyStatus(s)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      title="O'qish holatini o'zgartirish"
                    >
                      <StatusBadge value={s.studyStatus} type="study" />
                    </button>
                  </td>
                  <td className="text-slate-400 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => setPayingStudent(s)}
                      className="btn-primary text-xs py-1 px-2.5"
                    >
                      + To'lov
                    </button>
                  </td>
                </tr>
              ))}
              {!studentsLoading && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    O'quvchilar topilmadi
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

const AdminDashboard = () => (
  <Layout>
    <Routes>
      <Route index element={<StudentsPage />} />
      <Route path="students" element={<StudentsPage />} />
      <Route path="teachers/:teacherId/students" element={<AdminTeacherStudentsPage />} />
      <Route path="teachers/:teacherId" element={<AdminTeacherStudentsPage />} />
      <Route path="commissions" element={<AdminCommissionsPage />} />
    </Routes>
  </Layout>
);

export default AdminDashboard;
