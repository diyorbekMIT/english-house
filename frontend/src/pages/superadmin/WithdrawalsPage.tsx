import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import StatusBadge from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { formatUzs } from '../../lib/format';
import type { WithdrawRequest } from './types';

type Action = 'verify' | 'give' | 'reject';

const ACTION_COPY: Record<
  Action,
  { title: string; message: string; confirmText: string; commentLabel: string; placeholder: string; required: boolean; danger?: boolean }
> = {
  verify: {
    title: "So'rovni tasdiqlaysizmi?",
    message: "Tasdiqlangach, foydalanuvchiga ofisga tashrif buyurib pulini olishi kerakligi ko'rsatiladi va summa balansdan ayiriladi.",
    confirmText: 'Ha, tasdiqlash',
    commentLabel: 'Izoh (ixtiyoriy)',
    placeholder: "Masalan: ertaga soat 10:00 da ofisga keling",
    required: false,
  },
  give: {
    title: "Pul berilganini tasdiqlaysizmi?",
    message: "Bu amalni faqat pulni jismonan qo'lga topshirgandan so'ng bosing. Qaytarib bo'lmaydi.",
    confirmText: 'Ha, berildi',
    commentLabel: 'Izoh (ixtiyoriy)',
    placeholder: 'Masalan: naqd pul qo‘lga topshirildi',
    required: false,
  },
  reject: {
    title: "So'rovni rad etasizmi?",
    message: "Summa qayta yechib olish uchun ochiladi. Foydalanuvchi rad etish sababini ko'radi.",
    confirmText: 'Ha, rad etish',
    commentLabel: 'Rad etish sababi (majburiy)',
    placeholder: 'Masalan: hujjatlar to‘liq emas',
    required: true,
    danger: true,
  },
};

const ActionModal = ({
  action,
  request,
  isPending,
  onSubmit,
  onClose,
}: {
  action: Action;
  request: WithdrawRequest;
  isPending: boolean;
  onSubmit: (comment: string) => void;
  onClose: () => void;
}) => {
  const copy = ACTION_COPY[action];
  const [comment, setComment] = useState('');
  const trimmed = comment.trim();
  const canSubmit = !isPending && (!copy.required || trimmed.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="section-title">{copy.title}</h2>
          <p className="text-xs text-slate-500 mt-1">{copy.message}</p>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Foydalanuvchi</span>
            <span className="font-semibold text-slate-900 text-right">
              {request.userFullName ?? `#${request.userId}`} ({request.userRole === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"})
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Miqdori</span>
            <span className="font-bold text-slate-900">{formatUzs(request.amountUzs)} UZS</span>
          </div>
        </div>

        <div>
          <label className="label">{copy.commentLabel}</label>
          <textarea
            className="input min-h-[80px]"
            rows={3}
            maxLength={500}
            placeholder={copy.placeholder}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
          <p className="text-2xs text-slate-400 mt-1 text-right">{comment.length}/500</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onSubmit(trimmed)}
            disabled={!canSubmit}
            className={`flex-1 ${copy.danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {isPending ? 'Yuborilmoqda…' : copy.confirmText}
          </button>
          <button onClick={onClose} className="btn-secondary" disabled={isPending}>
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
};

const CommentLine = ({ label, text }: { label: string; text?: string | null }) =>
  text ? (
    <p className="text-xs text-slate-600">
      <span className="font-semibold text-slate-500">{label}:</span> {text}
    </p>
  ) : null;

export const WithdrawalsPage = () => {
  const qc = useQueryClient();
  const { showToast } = useFeedback();
  const [active, setActive] = useState<{ action: Action; request: WithdrawRequest } | null>(null);

  const { data: requests = [], isLoading } = useQuery<WithdrawRequest[]>({
    queryKey: ['withdraw-requests', 'all'],
    queryFn: () => api.get('/withdrawals').then((r) => r.data),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: number; action: Action; comment: string }) =>
      api.patch(`/withdrawals/${id}/${action}`, { comment: comment || undefined }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['withdraw-requests'] });
      qc.invalidateQueries({ queryKey: ['payout-balances'] });
      setActive(null);
      const toast = {
        verify: { title: "So'rov tasdiqlandi", message: "Foydalanuvchi ofisga tashrif buyurishi haqida xabar ko'radi." },
        give: { title: 'Berildi deb belgilandi', message: "Foydalanuvchiga tabrik xabari ko'rsatiladi." },
        reject: { title: "So'rov rad etildi", message: "Foydalanuvchi rad etish sababini ko'radi." },
      }[vars.action];
      showToast({ type: vars.action === 'reject' ? 'info' : 'success', ...toast });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "Amalni bajarishda xatolik yuz berdi.") });
    },
  });

  const pending = requests.filter((r) => r.status === 'PENDING');
  const verified = requests.filter((r) => r.status === 'VERIFIED');
  const history = requests.filter((r) => r.status === 'GIVEN' || r.status === 'REJECTED');

  const roleLabel = (r: WithdrawRequest) => (r.userRole === 'DIRECTOR' ? 'Direktor' : "O'qituvchi");

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Yechib olish so'rovlari</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Direktor va o'qituvchilarning yechib olish so'rovlarini ko'rib chiqish, tasdiqlash yoki rad etish
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="section-title">Yangi so'rovlar ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-center py-4 text-slate-400 text-sm">Yangi so'rovlar yo'q</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Rol</th>
                  <th>Miqdori</th>
                  <th>Sana</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.userFullName ?? `#${r.userId}`}</td>
                    <td className="text-xs text-slate-500">{roleLabel(r)}</td>
                    <td className="font-bold text-slate-900">{formatUzs(r.amountUzs)} UZS</td>
                    <td className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString('uz-UZ')}</td>
                    <td className="flex gap-2">
                      <button onClick={() => setActive({ action: 'verify', request: r })} className="btn-primary text-xs px-2 py-1">
                        Tasdiqlash
                      </button>
                      <button onClick={() => setActive({ action: 'reject', request: r })} className="btn-secondary text-xs px-2 py-1">
                        Rad etish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="section-title">Tasdiqlangan — pul berilishi kutilmoqda ({verified.length})</h2>
        {verified.length === 0 ? (
          <p className="text-center py-4 text-slate-400 text-sm">Kutilayotgan to'lovlar yo'q</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Rol</th>
                  <th>Miqdori</th>
                  <th>Tasdiqlangan sana</th>
                  <th>Izoh</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {verified.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.userFullName ?? `#${r.userId}`}</td>
                    <td className="text-xs text-slate-500">{roleLabel(r)}</td>
                    <td className="font-bold text-slate-900">{formatUzs(r.amountUzs)} UZS</td>
                    <td className="text-xs text-slate-500">{r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString('uz-UZ') : '—'}</td>
                    <td className="text-xs text-slate-600 max-w-[220px]">{r.verifyComment ?? '—'}</td>
                    <td>
                      <button onClick={() => setActive({ action: 'give', request: r })} className="btn-primary text-xs px-2 py-1">
                        💵 Berildi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="section-title">Tarix ({history.length})</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Foydalanuvchi</th>
                <th>Rol</th>
                <th>Miqdori</th>
                <th>Holati</th>
                <th>Sana</th>
                <th>Izohlar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>}
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.userFullName ?? `#${r.userId}`}</td>
                  <td className="text-xs text-slate-500">{roleLabel(r)}</td>
                  <td className={`font-bold ${r.status === 'REJECTED' ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                    {formatUzs(r.amountUzs)} UZS
                  </td>
                  <td><StatusBadge value={r.status} type="withdraw" /></td>
                  <td className="text-xs text-slate-500">
                    {new Date((r.status === 'REJECTED' ? r.rejectedAt : r.givenAt) ?? r.createdAt).toLocaleDateString('uz-UZ')}
                  </td>
                  <td className="space-y-0.5 max-w-[260px]">
                    <CommentLine label="Tasdiqlash" text={r.verifyComment} />
                    <CommentLine label="Berish" text={r.giveComment} />
                    <CommentLine label="Rad etish" text={r.rejectComment} />
                    {!r.verifyComment && !r.giveComment && !r.rejectComment && <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
              {!isLoading && history.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400">Tarix mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <ActionModal
          action={active.action}
          request={active.request}
          isPending={actionMutation.isPending}
          onClose={() => setActive(null)}
          onSubmit={(comment) => actionMutation.mutate({ id: active.request.id, action: active.action, comment })}
        />
      )}
    </div>
  );
};

export default WithdrawalsPage;
