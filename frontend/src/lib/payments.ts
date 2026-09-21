import { formatUzs } from './format';

interface PaymentLike {
  amountUzs: number;
  paidForMonth: string;
  voidedAt?: string | null;
}

// Several payments in one month are allowed (each earns the CEO-set ongoing bonus), so
// this is only a heads-up before saving — it catches an accidental double entry.
export const sameMonthPaymentWarning = (payments: PaymentLike[], month: string): string | null => {
  const same = payments.filter((p) => !p.voidedAt && p.paidForMonth === month);
  if (same.length === 0) return null;
  const total = same.reduce((sum, p) => sum + p.amountUzs, 0);
  return `Diqqat: bu o'quvchi uchun ${month} oyida allaqachon ${same.length} ta to'lov kiritilgan (jami ${formatUzs(total)} UZS). Har bir to'lov alohida bonus hisoblaydi. Xato bo'lsa, CEO to'lovni bekor qila oladi.`;
};
