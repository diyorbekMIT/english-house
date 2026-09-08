const CALL_COLORS: Record<string, string> = {
  WAITING: 'background:#FEF9C3;color:#854D0E',
  ACCEPTED: 'background:#DCFCE7;color:#166534',
  REJECTED: 'background:#FEE2E2;color:#991B1B',
};
const STUDY_COLORS: Record<string, string> = {
  STUDYING: 'background:#DCFCE7;color:#166534',
  STOPPED: 'background:#FEE2E2;color:#991B1B',
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

interface Props {
  value: string;
  type?: 'call' | 'study' | 'commission' | 'active';
}

const LABELS: Record<string, string> = {
  WAITING: 'Kutilmoqda',
  ACCEPTED: 'Qabul qilindi',
  REJECTED: 'Rad etildi',
  STUDYING: "O'qiyapti",
  STOPPED: "O'qimayapti",
  PENDING: 'Kutilmoqda',
  READY_TO_PAY: 'Tayyor',
  PAID: "To'landi",
};

const StatusBadge = ({ value, type = 'call' }: Props) => {
  const map =
    type === 'study'
      ? STUDY_COLORS
      : type === 'commission'
      ? COMMISSION_COLORS
      : type === 'active'
      ? ACTIVE_COLORS
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
