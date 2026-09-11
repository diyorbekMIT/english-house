const CALL_COLORS: Record<string, string> = {
  WAITING: 'background:#FEF9C3;color:#854D0E',
  CALLED: 'background:#DBEAFE;color:#1E40AF',
  REGISTERED: 'background:#E0E7FF;color:#3730A3',
  FIRST_LESSON: 'background:#CCFBF1;color:#0F766E',
  STARTED_STUDYING: 'background:#CFFAFE;color:#155E75',
  MADE_PAYMENT: 'background:#DCFCE7;color:#166534',
  REJECTED: 'background:#FEE2E2;color:#991B1B',
};
const STUDY_COLORS: Record<string, string> = {
  ACTIVE: 'background:#DCFCE7;color:#166534',
  NOACTIVE: 'background:#FEE2E2;color:#991B1B',
};
const COMMISSION_COLORS: Record<string, string> = {
  PENDING: 'background:#FEF9C3;color:#854D0E',
  READY_TO_PAY: 'background:#DBEAFE;color:#1e40af',
  PAID: 'background:#DCFCE7;color:#166534',
};
const ACTIVE_COLORS: Record<string, string> = {
  true: 'background:#DCFCE7;color:#166534',
  false: 'background:#F1F5F9;color:#475569',
};
const PAYOUT_COLORS: Record<string, string> = {
  PENDING: 'background:#FEF9C3;color:#854D0E',
  COMPLETED: 'background:#DCFCE7;color:#166534',
  CANCELLED: 'background:#FEE2E2;color:#991B1B',
};

interface Props {
  value: string;
  type?: 'call' | 'study' | 'commission' | 'active' | 'payout';
}

const LABELS: Record<string, string> = {
  WAITING: 'Kutilmoqda',
  CALLED: 'Aloqaga chiqildi',
  REGISTERED: 'Kursga yozildi',
  FIRST_LESSON: 'Birinchi dars',
  STARTED_STUDYING: 'Dars boshladi',
  MADE_PAYMENT: "To'lov qildi",
  REJECTED: 'Rad etildi',
  ACTIVE: 'Faol',
  NOACTIVE: 'Faol emas',
  PENDING: 'Kutilmoqda',
  READY_TO_PAY: 'Tayyor',
  PAID: "To'landi",
  COMPLETED: 'Bajarildi',
  CANCELLED: 'Bekor qilindi',
};

const StatusBadge = ({ value, type = 'call' }: Props) => {
  const map =
    type === 'study'
      ? STUDY_COLORS
      : type === 'commission'
      ? COMMISSION_COLORS
      : type === 'active'
      ? ACTIVE_COLORS
      : type === 'payout'
      ? PAYOUT_COLORS
      : CALL_COLORS;
  const styleStr = map[value] ?? 'background:#F1F5F9;color:#475569';
  const styleObj = Object.fromEntries(
    styleStr.split(';').filter(Boolean).map((s) => {
      const [k, v] = s.split(':');
      return [k!.trim(), v!.trim()];
    }),
  ) as React.CSSProperties;
  return (
    <span className="badge" style={styleObj}>
      {LABELS[value] ?? value}
    </span>
  );
};

export default StatusBadge;
