import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../../lib/api';
import AuditDescriptionHighlighter from '../../components/AuditDescriptionHighlighter';
import type { AuditLog } from './types';

const AUDIT_ACTION_MAP: Record<string, { label: string; badgeClass: string; icon: string }> = {
  STUDENT_CREATE: {
    label: "O'quvchi qo'shildi",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
    icon: "🎓",
  },
  STUDENT_CALL_STATUS_UPDATE: {
    label: "Qo'ng'iroq holati yangilandi",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
    icon: "📞",
  },
  STUDENT_STUDY_STATUS_UPDATE: {
    label: "O'qish holati yangilandi",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-300",
    icon: "📚",
  },
  MONTHLY_PAYMENT_CREATE: {
    label: "Oylik to'lov qabul qilindi",
    badgeClass: "bg-green-50 text-green-800 border-green-300",
    icon: "💵",
  },
  COMMISSION_MARK_PAID: {
    label: "Komissiya to'landi",
    badgeClass: "bg-teal-50 text-teal-800 border-teal-300",
    icon: "✅",
  },
  COMMISSION_STATUS_UPDATE: {
    label: "Komissiya holati o'zgartirildi",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-300",
    icon: "💳",
  },
  COMMISSION_RULES_UPDATE: {
    label: "Komissiya stavkalari yangilandi",
    badgeClass: "bg-orange-50 text-orange-800 border-orange-300",
    icon: "⚙️",
  },
  TEACHER_CREATE: {
    label: "O'qituvchi tayinlandi",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-300",
    icon: "👨‍🏫",
  },
  DIRECTOR_CREATE: {
    label: "Direktor tayinlandi",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-300",
    icon: "👔",
  },
  ADMIN_CREATE: {
    label: "Admin yaratildi",
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-300",
    icon: "🛡️",
  },
  MANAGER_CREATE: {
    label: "Menejer yaratildi",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
    icon: "💼",
  },
  USER_DEACTIVATE: {
    label: "Foydalanuvchi bloklandi",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-300",
    icon: "🚫",
  },
  SCHOOL_CREATE: {
    label: "Yangi maktab qo'shildi",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-300",
    icon: "🏫",
  },
  SCHOOL_UPDATE: {
    label: "Maktab ma'lumotlari yangilandi",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-300",
    icon: "✏️",
  },
};

const AUDIT_ENTITY_MAP: Record<string, { label: string; icon: string }> = {
  student: { label: "O'quvchi", icon: "🎓" },
  user: { label: "Foydalanuvchi", icon: "👤" },
  monthly_payment: { label: "Oylik to'lov", icon: "💰" },
  commission: { label: "Komissiya", icon: "💳" },
  commission_rules: { label: "Komissiya qoidasi", icon: "⚙️" },
  school: { label: "Maktab", icon: "🏫" },
};

export const CeoAuditLogsPage = () => {
  const getTodayStr = () => new Date().toLocaleDateString('sv');

  const [startDate, setStartDate] = useState<string>(getTodayStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('today');
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectToday = () => {
    const today = getTodayStr();
    setStartDate(today);
    setEndDate(today);
    setPreset('today');
  };

  const handleSelectYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yStr = d.toLocaleDateString('sv');
    setStartDate(yStr);
    setEndDate(yStr);
    setPreset('yesterday');
  };

  const handleSelectWeek = () => {
    const today = getTodayStr();
    const d = new Date();
    d.setDate(d.getDate() - 6);
    setStartDate(d.toLocaleDateString('sv'));
    setEndDate(today);
    setPreset('week');
  };

  const handleSelectMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('sv');
    setStartDate(firstDay);
    setEndDate(getTodayStr());
    setPreset('month');
  };

  const handleSelectAll = () => {
    setStartDate('');
    setEndDate('');
    setPreset('all');
  };

  const handleCustomStart = (val: string) => {
    setStartDate(val);
    setPreset('custom');
  };

  const handleCustomEnd = (val: string) => {
    setEndDate(val);
    setPreset('custom');
  };

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set('startDate', startDate);
  if (endDate) queryParams.set('endDate', endDate);
  queryParams.set('limit', '500');

  const {
    data: logs = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', startDate, endDate],
    queryFn: () => api.get(`/audit-logs?${queryParams.toString()}`).then((r) => r.data),
  });

  const uniqueActors = useMemo(() => {
    const map = new Map<number, { id: number; name: string; phone?: string | null }>();
    logs.forEach((l) => {
      if (l.actorUserId && !map.has(l.actorUserId)) {
        map.set(l.actorUserId, {
          id: l.actorUserId,
          name: l.actorName || `Foydalanuvchi #${l.actorUserId}`,
          phone: l.actorPhone || null,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action))).sort();
  }, [logs]);

  const uniqueEntities = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.entityType).filter(Boolean) as string[])).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterAction && l.action !== filterAction) return false;
      if (filterActor && String(l.actorUserId) !== filterActor) return false;
      if (filterEntity && l.entityType?.toLowerCase() !== filterEntity.toLowerCase()) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const actionLabel = AUDIT_ACTION_MAP[l.action]?.label?.toLowerCase() || '';
        const entityLabel = AUDIT_ENTITY_MAP[l.entityType?.toLowerCase() || '']?.label?.toLowerCase() || '';
        return (
          l.description.toLowerCase().includes(q) ||
          (l.actorName && l.actorName.toLowerCase().includes(q)) ||
          (l.actorPhone && l.actorPhone.toLowerCase().includes(q)) ||
          l.action.toLowerCase().includes(q) ||
          actionLabel.includes(q) ||
          (l.entityType && l.entityType.toLowerCase().includes(q)) ||
          entityLabel.includes(q)
        );
      }
      return true;
    });
  }, [logs, filterAction, filterActor, filterEntity, searchTerm]);

  const callUpdatesCount = logs.filter((l) => l.action.includes('CALL')).length;
  const studentCreatesCount = logs.filter((l) => l.action === 'STUDENT_CREATE').length;
  const studyStatusUpdatesCount = logs.filter((l) => l.action.includes('STUDY_STATUS')).length;
  const otherActionsCount = Math.max(0, logs.length - (callUpdatesCount + studentCreatesCount + studyStatusUpdatesCount));

  const getPeriodLabel = () => {
    if (preset === 'today') {
      const todayDate = new Date();
      return `Bugun — ${todayDate.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `Kecha — ${y.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    if (preset === 'week') {
      return `Oxirgi 7 kun`;
    }
    if (preset === 'month') {
      return `Joriy oy`;
    }
    if (preset === 'all') {
      return `Barcha vaqt`;
    }
    return `${startDate || 'Avvalidan'} — ${endDate || 'Hozirgacha'}`;
  };

  const formatAuditTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = getTodayStr();
    const logDateStr = d.toLocaleDateString('sv');
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (logDateStr === today) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Bugun
          </span>
          <span className="font-mono text-slate-700 text-xs font-semibold">{timeStr}</span>
        </div>
      );
    }
    return (
      <div>
        <span className="block font-mono text-slate-700 text-xs font-semibold">{d.toLocaleDateString()}</span>
        <span className="text-2xs font-mono text-slate-400">{timeStr}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-800 text-xs font-bold mb-2">
            🔒 Maxfiy — Faqat CEO uchun
          </div>
          <h1 className="page-title">CEO Audit Jurnali</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tizimdagi barcha amallar, qo'ng'iroqlar, to'lovlar va foydalanuvchilar harakati monitoringi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <span className="text-2xs text-slate-400 uppercase font-semibold block">Joriy sana</span>
            <span className="text-xs font-bold text-slate-800">
              {new Date().toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn btn-outline text-xs flex items-center gap-1.5 shadow-xs"
            title="Qayta yuklash"
          >
            <span className={isFetching ? 'animate-spin inline-block' : ''}>🔄</span>
            Yangilash
          </button>
        </div>
      </div>

      {/* Date Range Selection Card */}
      <div className="card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider block">
              Sana oralig'i filtri
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-slate-900">
                {getPeriodLabel()}
              </span>
              {preset === 'today' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Har kuni avtomatik yangilanadi
                </span>
              )}
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectToday}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                preset === 'today'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Bugun
            </button>
            <button
              type="button"
              onClick={handleSelectYesterday}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                preset === 'yesterday'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Kecha
            </button>
            <button
              type="button"
              onClick={handleSelectWeek}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                preset === 'week'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Oxirgi 7 kun
            </button>
            <button
              type="button"
              onClick={handleSelectMonth}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                preset === 'month'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Shu oy
            </button>
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                preset === 'all'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Barcha vaqt
            </button>
          </div>
        </div>

        {/* Custom Date Pickers & Breakdown Badges */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Aniq davr:</span>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-slate-400 font-medium">Dan:</span>
              <input
                type="date"
                className="bg-transparent text-xs font-medium text-slate-800 outline-none cursor-pointer"
                value={startDate}
                onChange={(e) => handleCustomStart(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-slate-400 font-medium">Gacha:</span>
              <input
                type="date"
                className="bg-transparent text-xs font-medium text-slate-800 outline-none cursor-pointer"
                value={endDate}
                onChange={(e) => handleCustomEnd(e.target.value)}
              />
            </div>
            {preset !== 'today' && (
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold px-2 py-1 underline"
              >
                Bugunga qaytish
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 text-xs font-semibold border border-blue-100">
              Jami: <strong>{logs.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 text-xs font-medium border border-amber-100">
              📞 Qo'ng'iroqlar: <strong>{callUpdatesCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 text-xs font-medium border border-emerald-100">
              🎓 Yangi o'quvchilar: <strong>{studentCreatesCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-900 text-xs font-medium border border-purple-100">
              ⚙️ Boshqa amallar: <strong>{otherActionsCount + studyStatusUpdatesCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Filter bar with Status & Admin Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <span>🔎</span>
            <span>Audit filtrlari</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Ko'rsatilmoqda: <strong className="text-slate-900">{filteredLogs.length}</strong> / Jami: {logs.length} ta yozuv
            </span>
            {(filterAction || filterActor || filterEntity || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setFilterAction('');
                  setFilterActor('');
                  setFilterEntity('');
                  setSearchTerm('');
                }}
                className="px-2 py-1 rounded-md text-2xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 transition-colors"
                title="Barcha filtrlarni tozalash"
              >
                ✕ Filtrlarni tozalash
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <input
              type="text"
              className="input w-full text-xs sm:text-sm pl-8 py-2"
              placeholder="Tavsif, foydalanuvchi yoki tel…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div>
            <select
              className="input w-full text-xs sm:text-sm py-2 bg-white cursor-pointer"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">Barcha harakat turlari ({logs.length})</option>
              {uniqueActions.map((a) => {
                const meta = AUDIT_ACTION_MAP[a];
                const count = logs.filter((l) => l.action === a).length;
                return (
                  <option key={a} value={a}>
                    {meta ? `${meta.icon} ${meta.label}` : a} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <select
              className="input w-full text-xs sm:text-sm py-2 bg-white cursor-pointer"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
            >
              <option value="">Barcha bajaruvchilar (Adminlar / Xodimlar)</option>
              {uniqueActors.map((actor) => {
                const count = logs.filter((l) => l.actorUserId === actor.id).length;
                return (
                  <option key={actor.id} value={String(actor.id)}>
                    👤 {actor.name} {actor.phone ? `(${actor.phone})` : ''} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <select
              className="input w-full text-xs sm:text-sm py-2 bg-white cursor-pointer"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
            >
              <option value="">Barcha ob'ektlar ({logs.length})</option>
              {uniqueEntities.map((ent) => {
                const meta = AUDIT_ENTITY_MAP[ent.toLowerCase()];
                const count = logs.filter((l) => l.entityType?.toLowerCase() === ent.toLowerCase()).length;
                return (
                  <option key={ent} value={ent}>
                    {meta ? `${meta.icon} ${meta.label}` : ent} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Bajaruvchi (Foydalanuvchi)</th>
                <th>Harakat turi</th>
                <th style={{ minWidth: '380px' }}>Tavsif (Highlight qilingan)</th>
                <th>Ob'ekt</th>
                <th>Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="animate-spin inline-block">⏳</span>
                      Audit yozuvlari yuklanmoqda…
                    </div>
                  </td>
                </tr>
              )}

              {filteredLogs.map((l) => {
                const actionMeta = AUDIT_ACTION_MAP[l.action];
                const entityKey = l.entityType?.toLowerCase() || '';
                const entityMeta = AUDIT_ENTITY_MAP[entityKey];

                return (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-mono text-xs text-slate-400">#{l.id}</td>
                    <td>
                      {l.actorName ? (
                        <div>
                          <span className="font-bold text-slate-900 text-xs">{l.actorName}</span>
                          {l.actorPhone && (
                            <span className="block text-2xs font-mono text-slate-500">{l.actorPhone}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">ID: {l.actorUserId}</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5 items-start">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${
                            actionMeta
                              ? actionMeta.badgeClass
                              : 'bg-blue-50 text-blue-900 border-blue-200'
                          }`}
                        >
                          <span>{actionMeta?.icon || '📌'}</span>
                          <span>{actionMeta?.label || l.action}</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 pl-0.5">
                          {l.action}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <AuditDescriptionHighlighter text={l.description} />
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <span>{entityMeta?.icon || '📦'}</span>
                        <span>{entityMeta?.label || l.entityType || '—'}</span>
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs whitespace-nowrap">
                      {formatAuditTime(l.createdAt)}
                    </td>
                  </tr>
                );
              })}

              {!isLoading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="max-w-md mx-auto text-center space-y-2">
                      <div className="text-3xl">🔍</div>
                      <p className="font-semibold text-slate-800 text-sm">
                        {filterAction || filterActor || filterEntity || searchTerm
                          ? "Tanlangan filtrlar bo'yicha audit yozuvlari topilmadi"
                          : preset === 'today'
                          ? "Bugungi kun uchun audit yozuvlari hali mavjud emas"
                          : "Tanlangan sana oralig'ida audit yozuvlari topilmadi"}
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {filterAction || filterActor || filterEntity || searchTerm
                          ? "Qidiruv so'zini yoki tanlangan holat/bajaruvchi filtrlarini o'zgartirib ko'ring."
                          : preset === 'today'
                          ? "Tizim har kuni 00:00 dan yangilanadi. O'tgan kunlar va avvalgi audit tarixini ko'rish uchun yuqoridagi sana oralig'ini tanlang yoki 'Barcha vaqt' tugmasini bosing."
                          : "Boshqa sana oralig'ini belgilab ko'ring yoki barcha yozuvlarni oching."}
                      </p>
                      {(filterAction || filterActor || filterEntity || searchTerm) && (
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="mt-3 btn btn-secondary text-xs"
                        >
                          Barcha audit tarixini ko'rish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
