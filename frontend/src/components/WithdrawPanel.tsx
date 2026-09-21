import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { useFeedback } from '../contexts/FeedbackContext';
import { getErrorMessage } from '../lib/errors';
import { formatUzs } from '../lib/format';
import StatusBadge from './StatusBadge';
import type { WithdrawEligibility, WithdrawRequest } from '../pages/superadmin/types';

const SEEN_KEY = 'withdraw_seen_given_ids';

const readSeenIds = (): Set<number> => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const markSeenId = (id: number) => {
  try {
    const seen = readSeenIds();
    seen.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* best-effort only */
  }
};

const fireConfetti = () => {
  const end = Date.now() + 1800;
  const colors = ['#22c55e', '#f59e0b', '#3b82f6'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 130, spread: 100, origin: { y: 0.4 }, colors });
};

const WithdrawPanel = () => {
  const qc = useQueryClient();
  const { confirm, showToast } = useFeedback();
  const [celebrateId, setCelebrateId] = useState<number | null>(null);
  const celebratedRef = useRef(false);

  const { data: eligibility } = useQuery<WithdrawEligibility>({
    queryKey: ['withdraw-eligibility'],
    queryFn: () => api.get('/withdrawals/eligibility').then((r) => r.data),
  });

  const { data: requests = [] } = useQuery<WithdrawRequest[]>({
    queryKey: ['withdraw-requests', 'mine'],
    queryFn: () => api.get('/withdrawals').then((r) => r.data),
  });

  useEffect(() => {
    if (celebratedRef.current) return;
    const seen = readSeenIds();
    const newlyGiven = requests.find((r) => r.status === 'GIVEN' && !seen.has(r.id));
    if (newlyGiven) {
      celebratedRef.current = true;
      setCelebrateId(newlyGiven.id);
      fireConfetti();
      markSeenId(newlyGiven.id);
    }
  }, [requests]);

  const requestMutation = useMutation({
    mutationFn: () => api.post('/withdrawals', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdraw-eligibility'] });
      qc.invalidateQueries({ queryKey: ['withdraw-requests'] });
      showToast({ type: 'success', title: "So'rov yuborildi", message: "Yechib olish so'rovingiz CEOga yuborildi." });
    },
    onError: (err: unknown) => {
      showToast({ type: 'error', title: 'Xatolik', message: getErrorMessage(err, "So'rovni yuborishda xatolik yuz berdi.") });
    },
  });

  const handleWithdraw = async () => {
    if (!eligibility || eligibility.withdrawableUzs <= 0) return;
    const confirmed = await confirm({
      title: "Yechib olishni so'rashni tasdiqlaysizmi?",
      message: "So'rovingiz CEOga yuboriladi. Tasdiqlangandan so'ng ofisga tashrif buyurib, pulingizni olishingiz mumkin.",
      details: [{ label: 'Miqdori', value: `${formatUzs(eligibility.withdrawableUzs)} UZS` }],
      confirmText: "Ha, so'rov yuborish",
    });
    if (!confirmed) return;
    requestMutation.mutate();
  };

  const openRequests = requests.filter((r) => r.status === 'PENDING' || r.status === 'VERIFIED');
  const history = requests.filter((r) => r.status === 'GIVEN' || r.status === 'REJECTED');

  return (
    <div className="card space-y-4">
      <h2 className="section-title">Yechib olish</h2>

      {eligibility && eligibility.withdrawableUzs > 0 ? (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 space-y-3">
          <p className="text-sm text-emerald-800">
            Siz <strong>{formatUzs(eligibility.withdrawableUzs)} UZS</strong> yechib olishga huquqlisiz.
          </p>
          <button onClick={handleWithdraw} className="btn-primary w-full" disabled={requestMutation.isPending}>
            {requestMutation.isPending ? 'Yuborilmoqda…' : '💰 Yechib olish'}
          </button>
        </div>
      ) : eligibility && eligibility.limitUzs > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Yechib olish uchun yana <strong className="text-slate-900">{formatUzs(eligibility.neededUzs)} UZS</strong> kerak
            {' '}(limit: {formatUzs(eligibility.limitUzs)} UZS).
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">CEO hali yechib olish limitini o'rnatmagan.</p>
        </div>
      )}

      {openRequests.length > 0 && (
        <div className="space-y-2">
          {openRequests.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg p-3 border ${r.status === 'VERIFIED' ? 'border-blue-300 bg-blue-50' : 'border-amber-200 bg-amber-50'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{formatUzs(r.amountUzs)} UZS</span>
                <StatusBadge value={r.status} type="withdraw" />
              </div>
              {r.status === 'VERIFIED' && (
                <>
                  <p className="text-xs text-blue-800 mt-1.5">
                    ✅ So'rovingiz tasdiqlandi! Ofisimizga tashrif buyurib, pulingizni olib ketishingiz mumkin.
                  </p>
                  {r.verifyComment && (
                    <p className="text-xs text-blue-900 mt-1 rounded bg-white/70 border border-blue-200 px-2 py-1">
                      💬 CEO izohi: {r.verifyComment}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <p className="text-2xs font-semibold text-slate-500 uppercase">Yechib olish tarixi</p>
          {history.map((r) => (
            <div key={r.id} className="py-1.5 border-b border-slate-50 last:border-0">
              <div className="flex items-center justify-between text-sm">
                <span className={r.status === 'REJECTED' ? 'text-slate-400 line-through' : 'text-slate-700'}>
                  {formatUzs(r.amountUzs)} UZS
                </span>
                <span className="text-2xs text-slate-400">
                  {new Date((r.status === 'REJECTED' ? r.rejectedAt : r.givenAt) ?? r.createdAt).toLocaleDateString()}
                </span>
                <StatusBadge value={r.status} type="withdraw" />
              </div>
              {r.status === 'REJECTED' && r.rejectComment && (
                <p className="text-xs text-rose-700 mt-1 rounded bg-rose-50 border border-rose-100 px-2 py-1">
                  ❌ Rad etish sababi: {r.rejectComment}
                </p>
              )}
              {r.status === 'GIVEN' && (r.verifyComment || r.giveComment) && (
                <p className="text-xs text-slate-500 mt-1">
                  💬 {[r.verifyComment, r.giveComment].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {celebrateId !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCelebrateId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl">🎉</div>
            <h3 className="text-xl font-black text-slate-900">Tabriklaymiz!</h3>
            <p className="text-sm text-slate-600">Pulingiz muvaffaqiyatli berildi. Rahmat!</p>
            <button className="btn-primary w-full" onClick={() => setCelebrateId(null)}>
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WithdrawPanel;
