import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFeedback } from '../../contexts/FeedbackContext';
import StatusBadge from '../../components/StatusBadge';
import { getErrorMessage } from '../../lib/errors';
import { formatUzs } from '../../lib/format';
import type { WithdrawRequest } from './types';

export const WithdrawalsPage = () => {
  const qc = useQueryClient();
  const { confirm, showToast } = useFeedback();

  const { data: requests = [], isLoading } = useQuery<WithdrawRequest[]>({
    queryKey: ['withdraw-requests', 'all'],
    queryFn: () => api.get('/withdrawals').then((r) => r.data),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/withdrawals/${id}/verify`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdraw-requests'] });
      showToast({ type: 'success', title: "So'rov tasdiqlandi", message: "Foydalanuvchi ofisga tashrif buyurishi haqida xabar ko'radi." });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "Tasdiqlashda xatolik yuz berdi.") });
    },
  });

  const giveMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/withdrawals/${id}/give`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdraw-requests'] });
      showToast({ type: 'success', title: 'Berildi deb belgilandi', message: "Foydalanuvchiga tabrik xabari ko'rsatiladi." });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "Belgilashda xatolik yuz berdi.") });
    },
  });

  const handleVerify = async (r: WithdrawRequest) => {
    const confirmed = await confirm({
      title: "So'rovni tasdiqlaysizmi?",
      message: "Tasdiqlangach, foydalanuvchiga ofisga tashrif buyurib pulini olishi kerakligi ko'rsatiladi.",
      details: [
        { label: 'Foydalanuvchi', value: `${r.userFullName ?? '#' + r.userId} (${r.userRole === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"})` },
        { label: 'Miqdori', value: `${formatUzs(r.amountUzs)} UZS` },
      ],
      confirmText: 'Ha, tasdiqlash',
    });
    if (!confirmed) return;
    verifyMutation.mutate(r.id);
  };

  const handleGive = async (r: WithdrawRequest) => {
    const confirmed = await confirm({
      title: "Pul berilganini tasdiqlaysizmi?",
      message: "Bu amalni faqat pulni jismonan qo'lga topshirgandan so'ng bosing. Qaytarib bo'lmaydi.",
      variant: 'warning',
      details: [
        { label: 'Foydalanuvchi', value: `${r.userFullName ?? '#' + r.userId} (${r.userRole === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"})` },
        { label: 'Miqdori', value: `${formatUzs(r.amountUzs)} UZS` },
      ],
      confirmText: 'Ha, berildi',
    });
    if (!confirmed) return;
    giveMutation.mutate(r.id);
  };

  const pending = requests.filter((r) => r.status === 'PENDING');
  const verified = requests.filter((r) => r.status === 'VERIFIED');
  const history = requests.filter((r) => r.status === 'GIVEN');

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Yechib olish so'rovlari</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Direktor va o'qituvchilarning yechib olish so'rovlarini ko'rib chiqish va tasdiqlash
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
                    <td className="text-xs text-slate-500">{r.userRole === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"}</td>
                    <td className="font-bold text-slate-900">{formatUzs(r.amountUzs)} UZS</td>
                    <td className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString('uz-UZ')}</td>
                    <td>
                      <button onClick={() => handleVerify(r)} className="btn-primary text-xs px-2 py-1" disabled={verifyMutation.isPending}>
                        Tasdiqlash
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
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {verified.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.userFullName ?? `#${r.userId}`}</td>
                    <td className="text-xs text-slate-500">{r.userRole === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"}</td>
                    <td className="font-bold text-slate-900">{formatUzs(r.amountUzs)} UZS</td>
                    <td className="text-xs text-slate-500">{r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString('uz-UZ') : '—'}</td>
                    <td>
                      <button onClick={() => handleGive(r)} className="btn-primary text-xs px-2 py-1" disabled={giveMutation.isPending}>
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
                <th>Berilgan sana</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="text-center py-6 text-slate-400">Yuklanmoqda…</td></tr>}
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.userFullName ?? `#${r.userId}`}</td>
                  <td className="text-xs text-slate-500">{r.userRole === 'DIRECTOR' ? 'Direktor' : "O'qituvchi"}</td>
                  <td className="font-bold text-emerald-700">{formatUzs(r.amountUzs)} UZS</td>
                  <td><StatusBadge value={r.status} type="withdraw" /></td>
                  <td className="text-xs text-slate-500">{r.givenAt ? new Date(r.givenAt).toLocaleDateString('uz-UZ') : '—'}</td>
                </tr>
              ))}
              {!isLoading && history.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">Tarix mavjud emas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalsPage;
