import { useEffect, useState } from 'react';

interface CommissionCreditCardProps {
  schoolName?: string;   // e.g. "№ 21 — Ixtisoslashgan maktab"
  subject?: string;      // e.g. "English"
  holderName: string;    // имя учителя
  totalUzs: number;
  paidUzs: number;
  pendingUzs: number;
  currency?: string;
}

// Анимированный счётчик суммы
const useAnimatedNumber = (target: number, duration = 900) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
};

const formatUzs = (n: number) =>
  n.toLocaleString('uz-UZ', { maximumFractionDigits: 0 });

const CommissionCreditCard = ({
  schoolName,
  subject,
  holderName,
  totalUzs,
  paidUzs,
  pendingUzs,
  currency = 'UZS',
}: CommissionCreditCardProps) => {
  const animatedTotal = useAnimatedNumber(totalUzs);
  const shortId = holderName.slice(0, 2).toUpperCase().padEnd(2, '•');

  return (
    <div className="relative group [perspective:1000px]">
      {/* Shine animation styles */}
      <style>{`
        @keyframes card-sheen {
          0% { transform: translateX(-120%) skewX(-15deg); }
          100% { transform: translateX(220%) skewX(-15deg); }
        }
        .cc-sheen { animation: card-sheen 3.5s ease-in-out infinite; }
      `}</style>

      <div className="relative w-full aspect-[1.586/1] max-w-[420px] mx-auto rounded-2xl overflow-hidden
                      bg-gradient-to-br from-indigo-950 via-[#0f1c4e] to-teal-900
                      border border-white/10 shadow-2xl shadow-indigo-950/40
                      transition-transform duration-300 group-hover:scale-[1.02] group-hover:rotate-1">

        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-teal-400/20 blur-2xl" />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-indigo-400/20 blur-2xl" />

        {/* Moving sheen */}
        <div className="absolute inset-y-0 w-1/3 bg-white/5 cc-sheen pointer-events-none" />

        {/* Card body */}
        <div className="relative z-10 h-full flex flex-col justify-between p-5 text-white">
          {/* Top row: brand + chip */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-teal-200/80 font-semibold">
                Teacher Bonus Card
              </p>
              <p className="text-xs text-white/60 mt-0.5">
                {schoolName ?? 'Ta\'lim markazi'}
                {subject ? ` • ${subject}` : ''}
              </p>
            </div>
            {/* Chip */}
            <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500
                            shadow-inner relative overflow-hidden">
              <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-px bg-amber-700/40" />
              <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 w-px bg-amber-700/40" />
            </div>
          </div>

          {/* Middle: balance */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-medium">
              Umumiy komissiya balansi
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
              {formatUzs(animatedTotal)}
              <span className="text-sm font-semibold text-teal-300 ml-1.5">{currency}</span>
            </p>
          </div>

          {/* Bottom row: paid / pending + holder */}
          <div className="flex items-end justify-between gap-3">
            <div className="flex gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/40">To'langan</p>
                <p className="text-xs font-bold text-emerald-300">
                  {formatUzs(paidUzs)} {currency}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/40">Kutilmoqda</p>
                <p className="text-xs font-bold text-amber-300">
                  {formatUzs(pendingUzs)} {currency}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/40">Karta egasi</p>
              <p className="text-xs font-bold truncate max-w-[140px]">
                {holderName.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Card number decoration */}
        <div className="absolute bottom-5 left-5 hidden">
          <span className="font-mono text-white/30 text-xs tracking-widest">
            {shortId}•••• •••• ••••
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommissionCreditCard;