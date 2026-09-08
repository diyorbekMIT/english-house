import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';
import AuditDescriptionHighlighter from '../../components/AuditDescriptionHighlighter';
import { DailyActivityChart, UnifiedAdminTable } from '../../components/Charts';
import { type CeoSummary, formatDateInput } from './types';

export const LeadsAnalyticsDashboard = () => {
  const now = new Date();
  const todayStr = formatDateInput(now);
  const defaultStart = formatDateInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13));

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState<string>('14kun');

  const { data, isLoading, isFetching } = useQuery<CeoSummary>({
    queryKey: ['ceo-summary', startDate, endDate],
    queryFn: () =>
      api
        .get('/analytics/ceo-summary', {
          params: { startDate, endDate },
        })
        .then((r) => r.data),
  });

  const overall = data?.overall;
  const period = data?.period;
  const dailyTrends = data?.dailyTrends ?? [];
  const adminStats = data?.adminCallStats ?? [];
  const recentCalls = data?.recentCalls ?? [];

  const handlePreset = (presetKey: string) => {
    setActivePreset(presetKey);
    const curr = new Date();
    const tStr = formatDateInput(curr);

    if (presetKey === 'bugun') {
      setStartDate(tStr);
      setEndDate(tStr);
    } else if (presetKey === 'kecha') {
      const yest = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() - 1);
      const yStr = formatDateInput(yest);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (presetKey === '7kun') {
      const past = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() - 6);
      setStartDate(formatDateInput(past));
      setEndDate(tStr);
    } else if (presetKey === '14kun') {
      const past = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() - 13);
      setStartDate(formatDateInput(past));
      setEndDate(tStr);
    } else if (presetKey === '30kun') {
      const past = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() - 29);
      setStartDate(formatDateInput(past));
      setEndDate(tStr);
    } else if (presetKey === 'shuOy') {
      const first = new Date(curr.getFullYear(), curr.getMonth(), 1);
      setStartDate(formatDateInput(first));
      setEndDate(tStr);
    } else if (presetKey === 'barcha') {
      setStartDate('2025-01-01');
      setEndDate(tStr);
    }
  };

  if (isLoading || !overall) {
    return <div className="p-8 text-center text-slate-500">Boshqaruv tahlili yuklanmoqda…</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Title & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="page-title">CEO Boshqaruv Paneli</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Markazning umumiy holati, sana oralig'i bo'yicha tahlil va kunlik faollik dinamikasi
          </p>
        </div>
      </div>

      {/* 1. OVERALL LIFETIME SUMMARY */}
      <div className="card p-5 bg-gradient-to-r from-slate-50 to-white border border-slate-200">
        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Markazning Barcha Davr Bo'yicha Umumiy Ko'rsatkichlari (Overall)
          </span>
          <span className="text-xs text-slate-400">Jami tarixiy hisobot</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 uppercase">Jami Barcha Lidlar</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{overall.totalLeads}</p>
            <span className="text-[11px] text-slate-400">Tizimga kelib tushgan</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Jami To'lov Qilganlar</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{overall.paidStudentsCount}</p>
            <span className="text-[11px] text-emerald-600 font-medium">
              {overall.conversionRatePercent}% umumiy konversiya
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-teal-700 uppercase">Jami Umumiy Tushum</p>
            <p className="text-xl font-bold text-teal-800 mt-1">
              {overall.totalRevenueUzs.toLocaleString()} <span className="text-xs">UZS</span>
            </p>
            <span className="text-[11px] text-slate-400">Markazga kelgan mablag'</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-blue-700 uppercase">Faol O'qiyotganlar</p>
            <p className="text-2xl font-bold text-blue-800 mt-1">{overall.studyingStudents}</p>
            <span className="text-[11px] text-slate-400">
              {overall.stoppedStudents} ta hali dars boshlamagan
            </span>
          </div>
        </div>
      </div>

      {/* 2. DATE RANGE SELECTION BAR */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Quick Presets */}
          <div>
            <span className="text-xs font-bold text-slate-700 block mb-2">
              Sana oralig'i (Davr bo'yicha filtrlash):
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'bugun', label: 'Bugun' },
                { key: 'kecha', label: 'Kecha' },
                { key: '7kun', label: 'Oxirgi 7 kun' },
                { key: '14kun', label: 'Oxirgi 14 kun' },
                { key: '30kun', label: 'Oxirgi 30 kun' },
                { key: 'shuOy', label: 'Shu oy' },
                { key: 'barcha', label: 'Barcha davr' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePreset(p.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activePreset === p.key
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span>Dan:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="input py-1 px-2 text-xs w-32 sm:w-36"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span>Gacha:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="input py-1 px-2 text-xs w-32 sm:w-36"
              />
            </div>
            {isFetching && (
              <span className="text-xs text-blue-600 font-medium animate-pulse ml-1">
                Yuklanmoqda…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. SELECTED PERIOD SPECIFIC METRICS */}
      {period && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <p className="text-xs font-semibold text-slate-500 uppercase">Davrdagi Yangi Lidlar</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{period.leadsCount}</p>
            <span className="text-[11px] text-slate-400">{startDate} dan {endDate} gacha</span>
          </div>

          <div className="stat-card">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Qo'ng'iroqlar Natijasi</p>
            <p className="text-2xl font-bold text-emerald-800 mt-0.5">{period.callsMadeCount} ta</p>
            <span className="text-[11px] text-slate-500">
              Qabul: <strong>{period.acceptedCount}</strong> | Rad: <strong>{period.rejectedCount}</strong> | Kutilmoqda: <strong>{period.waitingCount}</strong>
            </span>
          </div>

          <div className="stat-card">
            <p className="text-xs font-semibold text-teal-700 uppercase">Davrda To'lov Qilganlar</p>
            <p className="text-2xl font-bold text-teal-800 mt-0.5">{period.paidStudentsCount}</p>
            <span className="text-[11px] text-teal-600 font-semibold">
              {period.conversionRatePercent}% davr konversiyasi
            </span>
          </div>

          <div className="stat-card">
            <p className="text-xs font-semibold text-amber-700 uppercase">Davrdagi Tushum</p>
            <p className="text-xl font-bold text-amber-800 mt-0.5">
              {period.revenueUzs.toLocaleString()} <span className="text-xs">UZS</span>
            </p>
            <span className="text-[11px] text-slate-400">Tanlangan sanada qabul qilingan</span>
          </div>
        </div>
      )}

      {/* 4. DAILY ACTIVITY CHART */}
      <DailyActivityChart
        data={dailyTrends}
        periodLabel={`${startDate} — ${endDate}`}
      />

      {/* 5. SINGLE UNIFIED ADMIN PERFORMANCE TABLE */}
      <UnifiedAdminTable stats={adminStats} />

      {/* 6. RECENT CALLS FEED */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="section-title">So'nggi qo'ng'iroqlar va status o'zgarishlari jurnali</h2>
            <p className="text-xs text-slate-500 mt-0.5">Adminlar tomonidan amalga oshirilgan so'nggi amallar</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Tavsif va natija</th>
                <th>Holat</th>
                <th>Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.map((c) => (
                <tr key={c.id}>
                  <td className="font-bold text-blue-900 text-xs">{c.adminName}</td>
                  <td>
                    <AuditDescriptionHighlighter text={c.description} />
                  </td>
                  <td>
                    <StatusBadge value={c.callStatus} type="call" />
                  </td>
                  <td className="text-slate-400 text-xs">{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {recentCalls.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-400">Yozuvlar yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
