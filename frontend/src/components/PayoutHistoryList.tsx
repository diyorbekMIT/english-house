import StatusBadge from './StatusBadge';
import type { Payout } from '../pages/superadmin/types';

const TYPE_LABELS: Record<Payout['type'], string> = {
  INITIAL_BONUS: "Boshlang'ich bonus",
  CREDIT: "Qo'shildi",
  DEBIT: 'Ayrildi',
};

const formatUzs = (n: number) => n.toLocaleString('uz-UZ', { maximumFractionDigits: 0 });

interface Props {
  payouts: Payout[];
  emptyMessage?: string;
}

const PayoutHistoryList = ({ payouts, emptyMessage = "To'lovlar tarixi hali bo'sh" }: Props) => {
  if (payouts.length === 0) {
    return <p className="text-center py-6 text-slate-400 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Turi</th>
            <th>Miqdori</th>
            <th>Holati</th>
            <th>Izoh</th>
            <th>Sana</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td>{TYPE_LABELS[p.type]}</td>
              <td className={`font-semibold ${p.type === 'DEBIT' ? 'text-rose-600' : 'text-emerald-700'}`}>
                {p.type === 'DEBIT' ? '-' : '+'}
                {formatUzs(p.amountUzs)} UZS
              </td>
              <td><StatusBadge value={p.status} type="payout" /></td>
              <td className="text-slate-500 text-xs">{p.comments ?? '—'}</td>
              <td className="text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PayoutHistoryList;
