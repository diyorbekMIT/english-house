import type { EarnedCommission } from '../pages/superadmin/types';
import { formatUzs } from '../lib/format';

const TYPE_LABELS: Record<EarnedCommission['type'], string> = {
  SIGNUP_BONUS: "Birinchi to'lov",
  MONTHLY_COMMISSION: "Oylik to'lov",
};

interface Props {
  commissions: EarnedCommission[];
  emptyMessage?: string;
}

// Which student's payment earned each reward, for which month, and how much. What the
// student paid is not shown (course prices are CEO-only). There is no per-row "pending /
// paid" badge on purpose: withdrawals are taken from the pending total, not from single
// rows, so a row's own status would keep saying "pending" after the money was collected.
// Rows of a payment the CEO voided stay listed, struck through.
const CommissionHistoryList = ({ commissions, emptyMessage = "Hali o'quvchilar to'lovidan mukofot yo'q" }: Props) => {
  if (commissions.length === 0) {
    return <p className="text-center py-6 text-slate-400 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>O'quvchi</th>
            <th>To'lov</th>
            <th>To'lov oyi</th>
            <th>Mukofot</th>
            <th>Sana</th>
          </tr>
        </thead>
        <tbody>
          {commissions.map((c) => {
            const cancelled = c.status === 'CANCELLED';
            return (
              <tr key={c.id} className={cancelled ? 'opacity-60' : undefined}>
                <td className="font-semibold text-slate-900">{c.studentName ?? '—'}</td>
                <td>{TYPE_LABELS[c.type] ?? c.type}</td>
                <td className="text-slate-500 text-xs">{c.paidForMonth ?? '—'}</td>
                <td className={`font-semibold ${cancelled ? 'text-slate-400' : 'text-emerald-700'}`}>
                  <span className={cancelled ? 'line-through' : undefined}>+{formatUzs(c.amountUzs)} UZS</span>
                  {cancelled && <span className="block text-[11px] font-medium text-rose-600">To'lov bekor qilingan</span>}
                </td>
                <td className="text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString('uz-UZ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CommissionHistoryList;
