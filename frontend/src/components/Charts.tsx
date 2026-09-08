import React, { useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DailyTrendItem {
  date: string;
  label: string;
  newLeads: number;
  callsMade: number;
  paidCount: number;
  revenueUzs: number;
}

export interface AdminCallStatItem {
  adminId: number;
  adminName: string;
  adminPhone: string;
  totalCalls: number;
  accepted: number;
  rejected: number;
  waiting: number;
  lastCallAt: string;
}

// ── 1. DAILY ACTIVITY CHART (STARTS FROM ZERO EVERY DAY) ───────────────────────
interface DailyActivityChartProps {
  data: DailyTrendItem[];
  periodLabel?: string;
}

export const DailyActivityChart: React.FC<DailyActivityChartProps> = ({ data, periodLabel }) => {
  const [hoveredDay, setHoveredDay] = useState<DailyTrendItem | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="card p-6 text-center text-slate-400">
        Tanlangan davr uchun kunlik ma'lumotlar mavjud emas
      </div>
    );
  }

  // Find max value for scaling columns (minimum scale of 4 for clean baseline)
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.newLeads, d.callsMade, d.paidCount)),
    4
  );

  const totalPeriodLeads = data.reduce((sum, d) => sum + d.newLeads, 0);
  const totalPeriodCalls = data.reduce((sum, d) => sum + d.callsMade, 0);
  const totalPeriodPaid = data.reduce((sum, d) => sum + d.paidCount, 0);
  const totalPeriodRev = data.reduce((sum, d) => sum + d.revenueUzs, 0);

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Kunlik faollik dinamikasi
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Har bir kun 0 dan boshlanadi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {periodLabel || "Tanlangan davr bo'yicha"} har kungi yangi lidlar, qo'ng'iroqlar va to'lovlar
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="w-3 h-3 rounded-sm bg-[#1E3A8A] inline-block" />
            Yangi Lidlar
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="w-3 h-3 rounded-sm bg-[#10B981] inline-block" />
            Qo'ng'iroqlar
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="w-3 h-3 rounded-sm bg-[#0D9488] inline-block" />
            To'lovlar
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative pt-6 pb-2">
        {/* Floating Tooltip */}
        {hoveredDay && (
          <div className="mb-2 p-2.5 bg-slate-900 text-white rounded-lg shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 text-xs animate-fadeIn">
            <span className="font-bold text-amber-300">{hoveredDay.label} ({hoveredDay.date}):</span>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span>Yangi lidlar: <strong className="text-blue-300">{hoveredDay.newLeads} ta</strong></span>
              <span>Qo'ng'iroqlar: <strong className="text-emerald-300">{hoveredDay.callsMade} ta</strong></span>
              <span>To'lovlar: <strong className="text-teal-300">{hoveredDay.paidCount} ta</strong></span>
              {hoveredDay.revenueUzs > 0 && (
                <span>Tushum: <strong className="text-yellow-300">{hoveredDay.revenueUzs.toLocaleString()} UZS</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Columns Grid with Responsive Horizontal Scrolling on Mobile */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div
            className="grid gap-1 sm:gap-2 items-end h-48 border-b border-slate-200 px-1"
            style={{
              minWidth: data.length > 8 ? `${Math.max(data.length * 44, 580)}px` : '100%',
              gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {data.map((day) => {
              const chartHeight = 140; // max px height
              const leadH = (day.newLeads / maxVal) * chartHeight;
              const callH = (day.callsMade / maxVal) * chartHeight;
              const paidH = (day.paidCount / maxVal) * chartHeight;

              const isHovered = hoveredDay?.date === day.date;
              const hasActivity = day.newLeads > 0 || day.callsMade > 0 || day.paidCount > 0;

              return (
                <div
                  key={day.date}
                  className={`flex flex-col items-center justify-end h-full group cursor-pointer transition-all duration-150 relative ${
                    isHovered ? 'opacity-100' : 'hover:opacity-100'
                  }`}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => setHoveredDay(hoveredDay?.date === day.date ? null : day)}
                >
                  {/* Revenue Tag if non-zero */}
                  {day.revenueUzs > 0 && (
                    <div className="mb-1 flex justify-center w-full">
                      <span className="text-[9px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded shadow-xs whitespace-nowrap">
                        {(day.revenueUzs / 1000).toFixed(0)}k
                      </span>
                    </div>
                  )}

                  {/* Bars Trio for this Day - strictly 0px height if 0 value! */}
                  <div className="flex items-end justify-center gap-0.5 w-full max-w-[36px]">
                    {/* New Leads Bar */}
                    {day.newLeads > 0 ? (
                      <div
                        className="w-1/3 bg-[#1E3A8A] rounded-t transition-all duration-300 flex items-center justify-center relative shadow-xs"
                        style={{ height: `${Math.max(16, leadH)}px` }}
                        title={`Yangi lidlar: ${day.newLeads} ta`}
                      >
                        <span className="text-[9px] text-white font-bold leading-none">{day.newLeads}</span>
                      </div>
                    ) : (
                      <div className="w-1/3 h-0" />
                    )}

                    {/* Calls Made Bar */}
                    {day.callsMade > 0 ? (
                      <div
                        className="w-1/3 bg-[#10B981] rounded-t transition-all duration-300 flex items-center justify-center relative shadow-xs"
                        style={{ height: `${Math.max(16, callH)}px` }}
                        title={`Qo'ng'iroqlar: ${day.callsMade} ta`}
                      >
                        <span className="text-[9px] text-white font-bold leading-none">{day.callsMade}</span>
                      </div>
                    ) : (
                      <div className="w-1/3 h-0" />
                    )}

                    {/* Payments Bar */}
                    {day.paidCount > 0 ? (
                      <div
                        className="w-1/3 bg-[#0D9488] rounded-t transition-all duration-300 flex items-center justify-center relative shadow-xs"
                        style={{ height: `${Math.max(16, paidH)}px` }}
                        title={`To'lovlar: ${day.paidCount} ta`}
                      >
                        <span className="text-[9px] text-white font-bold leading-none">{day.paidCount}</span>
                      </div>
                    ) : (
                      <div className="w-1/3 h-0" />
                    )}
                  </div>

                  {/* Day Label */}
                  <span
                    className={`text-[10px] mt-1.5 truncate max-w-full font-medium transition-colors ${
                      isHovered || hasActivity ? 'text-slate-800 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Period Aggregates Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-lg">
          <span className="text-slate-500 text-[11px] block">Davrda jami yangi lidlar:</span>
          <span className="text-base font-bold text-slate-900">{totalPeriodLeads} ta</span>
        </div>
        <div className="bg-emerald-50/50 p-2.5 rounded-lg">
          <span className="text-emerald-700 text-[11px] block">Davrda amalga oshirilgan qo'ng'iroqlar:</span>
          <span className="text-base font-bold text-emerald-800">{totalPeriodCalls} ta</span>
        </div>
        <div className="bg-teal-50/50 p-2.5 rounded-lg">
          <span className="text-teal-700 text-[11px] block">Davrda to'langan o'quvchilar:</span>
          <span className="text-base font-bold text-teal-800">{totalPeriodPaid} ta</span>
        </div>
        <div className="bg-amber-50/50 p-2.5 rounded-lg">
          <span className="text-amber-800 text-[11px] block">Davrdagi jami tushum:</span>
          <span className="text-base font-bold text-amber-900">{totalPeriodRev.toLocaleString()} UZS</span>
        </div>
      </div>
    </div>
  );
};

// ── 2. UNIFIED ADMIN PERFORMANCE TABLE (NO REPETITIVE CHARTS) ───────────────────
interface UnifiedAdminTableProps {
  stats: AdminCallStatItem[];
}

export const UnifiedAdminTable: React.FC<UnifiedAdminTableProps> = ({ stats }) => {
  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Adminlar qo'ng'iroq hisoboti va natijalari taqsimoti
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tanlangan davrda qaysi admin qancha qo'ng'iroq qilgan, qabul va rad qilish ko'rsatkichlari
          </p>
        </div>
        {/* Legend for the integrated progress bar */}
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Qabul
          </span>
          <span className="flex items-center gap-1 text-rose-700">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Rad
          </span>
          <span className="flex items-center gap-1 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Kutilmoqda
          </span>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Admin F.I.SH</th>
              <th>Telefon</th>
              <th className="text-center">Jami qo'ng'iroqlar</th>
              <th className="min-w-[160px]">Natija taqsimoti (Vizual)</th>
              <th className="text-center">Qabul qilindi</th>
              <th className="text-center">Rad etildi</th>
              <th className="text-center">Kutilmoqda</th>
              <th>Oxirgi faollik</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((adm) => {
              const total = Math.max(adm.totalCalls, 1);
              const acceptPct = Math.round((adm.accepted / total) * 100);
              const rejectPct = Math.round((adm.rejected / total) * 100);
              const waitPct = Math.max(0, 100 - acceptPct - rejectPct);

              return (
                <tr key={adm.adminId}>
                  <td className="font-bold text-slate-900">{adm.adminName}</td>
                  <td className="font-mono text-xs text-slate-600">{adm.adminPhone || '—'}</td>
                  <td className="text-center font-bold text-slate-900 text-sm">
                    {adm.totalCalls} ta
                  </td>
                  <td>
                    {/* Inline Stacked Progress Bar (Directly inside table cell!) */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden">
                        {adm.accepted > 0 && (
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${acceptPct}%` }}
                            title={`Qabul: ${adm.accepted} ta (${acceptPct}%)`}
                          />
                        )}
                        {adm.rejected > 0 && (
                          <div
                            className="bg-rose-500 h-full transition-all duration-300"
                            style={{ width: `${rejectPct}%` }}
                            title={`Rad: ${adm.rejected} ta (${rejectPct}%)`}
                          />
                        )}
                        {adm.waiting > 0 && (
                          <div
                            className="bg-amber-400 h-full transition-all duration-300"
                            style={{ width: `${waitPct}%` }}
                            title={`Kutilmoqda: ${adm.waiting} ta (${waitPct}%)`}
                          />
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span className="text-emerald-700 font-bold">{acceptPct}%</span>
                        <span className="text-rose-700 font-bold">{rejectPct}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {adm.accepted} ta ({acceptPct}%)
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {adm.rejected} ta ({rejectPct}%)
                    </span>
                  </td>
                  <td className="text-center font-medium text-amber-700 text-xs">
                    {adm.waiting} ta
                  </td>
                  <td className="text-slate-400 text-xs">
                    {adm.lastCallAt ? new Date(adm.lastCallAt).toLocaleString() : '—'}
                  </td>
                </tr>
              );
            })}
            {stats.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400">
                  Tanlangan davr ichida adminlar tomonidan qo'ng'iroqlar amalga oshirilmagan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── 3. STUDY STATUS BREAKDOWN CHART ───────────────────────────────────────────
interface StudyStatusBreakdownProps {
  total: number;
  studying: number;
  stopped: number;
  waiting?: number;
  accepted?: number;
  title?: string;
  subtitle?: string;
}

export const StudyStatusBreakdownChart: React.FC<StudyStatusBreakdownProps> = ({
  total,
  studying,
  stopped,
  waiting = 0,
  accepted = 0,
  title = "O'quv markazida o'qish holati balansi",
  subtitle = "O'quvchilarning markazdagi darslarga qatnashish darajasi",
}) => {
  const studyingPercent = total > 0 ? Math.round((studying / total) * 100) : 0;
  const stoppedPercent = total > 0 ? Math.round((stopped / total) * 100) : 0;
  const otherPercent = Math.max(0, 100 - studyingPercent - stoppedPercent);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">O'qish ko'rsatkichi:</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {studyingPercent}% o'qimoqda
          </span>
        </div>
      </div>

      {/* Multi-segment visual bar */}
      <div>
        <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {studyingPercent > 0 && (
            <div
              className="bg-emerald-500 hover:bg-emerald-600 transition-all duration-300 relative group"
              style={{ width: `${studyingPercent}%` }}
              title={`O'qiyotganlar: ${studying} ta (${studyingPercent}%)`}
            />
          )}
          {stoppedPercent > 0 && (
            <div
              className="bg-rose-500 hover:bg-rose-600 transition-all duration-300 relative group"
              style={{ width: `${stoppedPercent}%` }}
              title={`O'qishni to'xtatganlar: ${stopped} ta (${stoppedPercent}%)`}
            />
          )}
          {otherPercent > 0 && (
            <div
              className="bg-amber-400 hover:bg-amber-500 transition-all duration-300 relative group"
              style={{ width: `${otherPercent}%` }}
              title={`Kutilayotgan/boshqa: ${total - studying - stopped} ta (${otherPercent}%)`}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">O'qiyotganlar</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-700 mt-1">{studying} <span className="text-xs font-normal">ta</span></p>
          <span className="text-[10px] text-emerald-600 font-medium">{studyingPercent}% jami o'quvchidan</span>
        </div>

        <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider">To'xtatganlar</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <p className="text-xl font-bold text-rose-700 mt-1">{stopped} <span className="text-xs font-normal">ta</span></p>
          <span className="text-[10px] text-rose-600 font-medium">{stoppedPercent}% jami o'quvchidan</span>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">Kutilayotgan</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-700 mt-1">{waiting} <span className="text-xs font-normal">ta</span></p>
          <span className="text-[10px] text-amber-600 font-medium">Lid holatida</span>
        </div>

        <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-blue-900 uppercase tracking-wider">Jami ro'yxat</span>
            <span className="w-2 h-2 rounded-full bg-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-950 mt-1">{total} <span className="text-xs font-normal">ta</span></p>
          <span className="text-[10px] text-blue-700 font-medium">100% qamrov</span>
        </div>
      </div>
    </div>
  );
};

// ── 4. DAILY STUDENT TREND CHART ──────────────────────────────────────────────
export interface DailyStudentItem {
  date: string;
  label: string;
  newStudents: number;
  studyingCount: number;
}

interface DailyStudentTrendChartProps {
  data: DailyStudentItem[];
  title?: string;
  subtitle?: string;
}

export const DailyStudentTrendChart: React.FC<DailyStudentTrendChartProps> = ({
  data,
  title = "Kunlik yangi o'quvchilar dinamikasi (14 kun)",
  subtitle = "Har bir kun 0 dan boshlanadi — jalb qilingan yangi o'quvchilar va ularning darsga qatnashishi",
}) => {
  const [hoveredDay, setHoveredDay] = useState<DailyStudentItem | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="card p-6 text-center text-slate-400">
        Kunlik ma'lumotlar mavjud emas
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.newStudents, d.studyingCount)), 3);
  const totalNew = data.reduce((s, d) => s + d.newStudents, 0);
  const totalStudying = data.reduce((s, d) => s + d.studyingCount, 0);

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Har kuni 0 dan boshlanadi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="w-3 h-3 rounded-sm bg-[#1E3A8A] inline-block" />
            <span>Yangi o'quvchilar</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="w-3 h-3 rounded-sm bg-[#10B981] inline-block" />
            <span>O'qiyotganlar</span>
          </div>
        </div>
      </div>

      {hoveredDay && (
        <div className="mb-2 p-2.5 bg-slate-900 text-white rounded-md flex items-center justify-between text-xs animate-fadeIn">
          <span className="font-bold text-amber-300">{hoveredDay.label} ({hoveredDay.date}):</span>
          <div className="flex items-center gap-3">
            <span>Yangi o'quvchilar: <strong className="text-blue-300">{hoveredDay.newStudents} ta</strong></span>
            <span>O'qiyotganlar: <strong className="text-emerald-300">{hoveredDay.studyingCount} ta</strong></span>
          </div>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div
          className="grid gap-1 sm:gap-2 items-end h-40 border-b border-slate-200 px-1"
          style={{
            minWidth: data.length > 8 ? `${Math.max(data.length * 40, 520)}px` : '100%',
            gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {data.map((day) => {
            const chartHeight = 115;
            const newH = (day.newStudents / maxVal) * chartHeight;
            const studyH = (day.studyingCount / maxVal) * chartHeight;
            const isHovered = hoveredDay?.date === day.date;
            const hasActivity = day.newStudents > 0 || day.studyingCount > 0;

            return (
              <div
                key={day.date}
                className={`flex flex-col items-center justify-end h-full group cursor-pointer transition-all ${
                  isHovered ? 'opacity-100' : 'hover:opacity-100'
                }`}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => setHoveredDay(hoveredDay?.date === day.date ? null : day)}
              >
                <div className="flex items-end justify-center gap-1 w-full max-w-[32px]">
                  {day.newStudents > 0 ? (
                    <div
                      className="w-1/2 bg-[#1E3A8A] rounded-t transition-all duration-300 flex items-center justify-center shadow-xs"
                      style={{ height: `${Math.max(16, newH)}px` }}
                      title={`Yangi o'quvchilar: ${day.newStudents} ta`}
                    >
                      <span className="text-[9px] text-white font-bold leading-none">{day.newStudents}</span>
                    </div>
                  ) : (
                    <div className="w-1/2 h-0" />
                  )}

                  {day.studyingCount > 0 ? (
                    <div
                      className="w-1/2 bg-[#10B981] rounded-t transition-all duration-300 flex items-center justify-center shadow-xs"
                      style={{ height: `${Math.max(16, studyH)}px` }}
                      title={`O'qiyotganlar: ${day.studyingCount} ta`}
                    >
                      <span className="text-[9px] text-white font-bold leading-none">{day.studyingCount}</span>
                    </div>
                  ) : (
                    <div className="w-1/2 h-0" />
                  )}
                </div>

                <span
                  className={`text-[10px] mt-1.5 truncate max-w-full font-medium ${
                    isHovered || hasActivity ? 'text-slate-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  {day.label.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">
        <span>Davrda jami yangi o'quvchilar: <strong className="text-blue-900">{totalNew} ta</strong></span>
        <span>Davrda faol o'qiyotganlar: <strong className="text-emerald-700">{totalStudying} ta</strong></span>
      </div>
    </div>
  );
};
