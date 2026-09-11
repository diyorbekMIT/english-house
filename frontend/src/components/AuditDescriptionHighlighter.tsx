import React from 'react';

interface Props {
  text: string;
}

// Map common backend phrases into friendly Uzbek
const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/^Student\s+/i, "O`quvchi "],
  [/\s+created\s+by\s+/i, " — Ro'yxatdan o'tkazuvchi: "],
  [/^Director\s+/i, "Direktor "],
  [/^Teacher\s+/i, "O'qituvchi "],
  [/^Sales manager\s+/i, "Sotuv menejeri "],
  [/^School\s+/i, "Maktab "],
  [/\s+created$/i, " yaratildi"],
  [/\s+updated$/i, " yangilandi"],
  [/^Call status changed to\s+/i, "Qo'ng'iroq holati: "],
  [/^Call status updated to\s+/i, "Qo'ng'iroq holati: "],
  [/^Study status changed to\s+/i, "O'qish holati: "],
  [/^Study status updated to\s+/i, "O'qish holati: "],
  [/^Monthly payment\s+/i, "Oylik to'lov: "],
  [/\s+for student\s+/i, " | O'quvchi: "],
  [/^Commission\s+(\d+)\s+marked as PAID/i, "№$1 komissiya to'langan deb belgilandi"],
  [/^Commission\s+(\d+)\s+status set to\s+/i, "№$1 komissiya holati: "],
  [/Commission rules updated/i, "Komissiya stavkalari va qoidalari yangilandi"],
];

function localizeDescription(raw: string): string {
  let res = raw;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    res = res.replace(pattern, replacement);
  }
  return res;
}

export const AuditDescriptionHighlighter: React.FC<Props> = ({ text }) => {
  if (!text) return null;

  const localized = localizeDescription(text);

  // Regex to split by:
  // 1. Quoted names/strings: 'Name'
  // 2. Call statuses: WAITING, CALLED, REGISTERED, FIRST_LESSON, STARTED_STUDYING, MADE_PAYMENT, REJECTED
  // 3. Study statuses: ACTIVE, NOACTIVE
  // 4. Other: PAID
  // 5. Roles: TEACHER, DIRECTOR, SALES_MANAGER, SUPER_ADMIN, SuperAdmin, MANAGER
  const regex =
    /('([^']+)')|\b(WAITING|CALLED|REGISTERED|FIRST_LESSON|STARTED_STUDYING|MADE_PAYMENT|REJECTED|ACTIVE|NOACTIVE|PAID|TEACHER|DIRECTOR|SALES_MANAGER|SUPER_ADMIN|SuperAdmin|MANAGER)\b/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(localized)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`} className="text-slate-700">
          {localized.slice(lastIndex, match.index)}
        </span>
      );
    }

    const fullMatch = match[0];
    const quotedName = match[2]; // inside quotes '...'
    const keyword = match[3]; // status or role

    if (quotedName !== undefined) {
      // Highlighted Name / School / Entity
      elements.push(
        <span
          key={`quoted-${match.index}`}
          className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md font-bold text-blue-950 bg-blue-100 border border-blue-200 text-xs shadow-2xs"
        >
          {quotedName}
        </span>
      );
    } else if (keyword) {
      // Status badges in Uzbek
      if (keyword === 'WAITING') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-amber-800 bg-amber-100 border border-amber-300 text-xs"
          >
            ⏳ Kutilmoqda (WAITING)
          </span>
        );
      } else if (keyword === 'CALLED') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-blue-800 bg-blue-100 border border-blue-300 text-xs"
          >
            📞 Aloqaga chiqildi (CALLED)
          </span>
        );
      } else if (keyword === 'REGISTERED') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-indigo-800 bg-indigo-100 border border-indigo-300 text-xs"
          >
            Kursga yozildi (REGISTERED)
          </span>
        );
      } else if (keyword === 'FIRST_LESSON') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-teal-800 bg-teal-100 border border-teal-300 text-xs"
          >
            Birinchi dars (FIRST_LESSON)
          </span>
        );
      } else if (keyword === 'STARTED_STUDYING') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-cyan-800 bg-cyan-100 border border-cyan-300 text-xs"
          >
            Dars boshladi (STARTED_STUDYING)
          </span>
        );
      } else if (keyword === 'MADE_PAYMENT') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 text-xs"
          >
            ✓ To'lov qildi (MADE_PAYMENT)
          </span>
        );
      } else if (keyword === 'REJECTED') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-rose-800 bg-rose-100 border border-rose-300 text-xs"
          >
            ✕ Rad etildi (REJECTED)
          </span>
        );
      } else if (keyword === 'ACTIVE') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 text-xs"
          >
            Faol (ACTIVE)
          </span>
        );
      } else if (keyword === 'NOACTIVE') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-rose-800 bg-rose-100 border border-rose-300 text-xs"
          >
            Faol emas (NOACTIVE)
          </span>
        );
      } else if (keyword === 'PAID') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 text-xs"
          >
            To'landi (PAID)
          </span>
        );
      } else if (keyword === 'TEACHER') {
        // Role badges
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md font-semibold text-teal-900 bg-teal-100 border border-teal-300 text-xs"
          >
            O'QITUVCHI (TEACHER)
          </span>
        );
      } else if (keyword === 'DIRECTOR') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md font-semibold text-purple-900 bg-purple-100 border border-purple-300 text-xs"
          >
            DIREKTOR (DIRECTOR)
          </span>
        );
      } else if (keyword === 'SALES_MANAGER') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md font-semibold text-blue-900 bg-blue-100 border border-blue-300 text-xs"
          >
            SOTUV MENEJERI (SALES_MANAGER)
          </span>
        );
      } else if (keyword === 'SUPER_ADMIN' || keyword === 'SuperAdmin') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md font-semibold text-indigo-900 bg-indigo-100 border border-indigo-300 text-xs"
          >
            SUPERADMIN (CEO)
          </span>
        );
      } else if (keyword === 'MANAGER') {
        elements.push(
          <span
            key={`kw-${match.index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md font-semibold text-slate-900 bg-slate-200 border border-slate-300 text-xs"
          >
            MENEJER (MANAGER)
          </span>
        );
      } else {
        elements.push(
          <span key={`kw-${match.index}`} className="font-semibold text-slate-900">
            {fullMatch}
          </span>
        );
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Remaining text
  if (lastIndex < localized.length) {
    elements.push(
      <span key={`text-${lastIndex}`} className="text-slate-700">
        {localized.slice(lastIndex)}
      </span>
    );
  }

  return <span className="inline-flex flex-wrap items-center gap-1 leading-relaxed">{elements}</span>;
};

export default AuditDescriptionHighlighter;
