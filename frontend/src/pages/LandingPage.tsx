import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_PATHS: Record<string, string> = {
  SUPER_ADMIN: '/superadmin',
  MANAGER: '/manager',
  SALES_MANAGER: '/sales-manager',
  ADMIN: '/admin',
  DIRECTOR: '/director',
  TEACHER: '/teacher',
};

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Calculator State
  const [roleMode, setRoleMode] = useState<'teacher' | 'director'>('teacher');
  const [studentCount, setStudentCount] = useState<number>(15);
  const [directorTeachersCount, setDirectorTeachersCount] = useState<number>(5);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Commission Calculations based on platform rules:
  // Teacher: Signup bonus 50,000 UZS + 10% monthly tuition (~65,000 UZS/month per student)
  // Director: Signup bonus 100,000 UZS + 5% monthly tuition (~32,500 UZS/month per student across all teachers)
  const tuitionPerMonth = 650000;
  
  const signupBonusPerStudent = roleMode === 'teacher' ? 50000 : 100000;
  const monthlyPercent = roleMode === 'teacher' ? 0.10 : 0.05;
  
  const effectiveStudents = roleMode === 'teacher' ? studentCount : studentCount * directorTeachersCount;
  
  const totalSignupBonus = effectiveStudents * signupBonusPerStudent;
  const monthlyRecurringCommission = Math.round(effectiveStudents * tuitionPerMonth * monthlyPercent);
  const annualTotalIncome = totalSignupBonus + monthlyRecurringCommission * 10; // 10 study months academic year

  const handleAuthRedirect = () => {
    if (user && user.role && ROLE_PATHS[user.role]) {
      navigate(ROLE_PATHS[user.role]);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8FAFC', color: '#0F172A' }}>
      {/* ── 1. STICKY TOP NAVIGATION ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-xs"
              style={{ background: '#1E3A8A' }}
            >
              R
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
                Referral Platform
              </span>
              <span className="text-[11px] font-medium text-[#0D9488] block">
                English House Hamkorlik Tizimi
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#benefits" className="hover:text-[#1E3A8A] transition-colors">
              Afzalliklar
            </a>
            <a href="#calculator" className="hover:text-[#1E3A8A] transition-colors flex items-center gap-1">
              <span>Daromad Kalkulyatori</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                Hisoblang
              </span>
            </a>
            <a href="#teachers" className="hover:text-[#1E3A8A] transition-colors">
              O'qituvchilarga
            </a>
            <a href="#directors" className="hover:text-[#1E3A8A] transition-colors">
              Direktorlarga
            </a>
            <a href="#faq" className="hover:text-[#1E3A8A] transition-colors">
              Savollar
            </a>
          </nav>

          {/* Action CTA */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <button
                onClick={handleAuthRedirect}
                className="btn-primary text-sm font-bold py-2.5 px-5 shadow-sm rounded-xl"
              >
                Kabinetga o'tish ({user.fullName}) →
              </button>
            ) : (
              <Link to="/login" className="btn-primary text-sm font-bold py-2.5 px-5 shadow-sm rounded-xl">
                Tizimga kirish →
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            aria-label="Menyu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 py-3 space-y-2 text-sm font-semibold text-slate-700">
            <a
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 hover:text-[#1E3A8A]"
            >
              Afzalliklar
            </a>
            <a
              href="#calculator"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 hover:text-[#1E3A8A]"
            >
              Daromad Kalkulyatori
            </a>
            <a
              href="#teachers"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 hover:text-[#1E3A8A]"
            >
              O'qituvchilarga
            </a>
            <a
              href="#directors"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 hover:text-[#1E3A8A]"
            >
              Direktorlarga
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 hover:text-[#1E3A8A]"
            >
              Savollar
            </a>
            <div className="pt-2 border-t border-slate-100">
              <Link to="/login" className="btn-primary w-full text-center block text-sm font-bold py-3 rounded-xl">
                Tizimga kirish →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-14 pb-20 lg:pt-24 lg:pb-28 border-b border-slate-200 bg-gradient-to-b from-blue-50/40 via-white to-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Top Announcement Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-blue-100/80 border border-blue-200 text-blue-950 text-xs sm:text-sm font-bold shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488] animate-pulse" />
              <span>🔥 Toshkent maktab rahbarlari va ustozlari uchun maxsus hamkorlik platformasi</span>
            </div>

            {/* Main Headline - Large & High Impact */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.12]">
              O'quvchilaringiz sifatli ta'lim olsin, siz esa{' '}
              <span className="text-[#1E3A8A] underline decoration-[#0D9488] decoration-4 sm:decoration-8 underline-offset-8">
                har oy barqaror daromad
              </span>{' '}
              oling!
            </h1>

            {/* Prominent Monetary Incentive Cards (Immediately visible at first glance) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl mx-auto pt-2">
              <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border-2 border-blue-200 shadow-md hover:shadow-lg transition-shadow text-left">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center text-2xl shrink-0 font-black border border-blue-200">
                  💰
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-black text-[#1E3A8A] font-mono leading-tight">
                    50,000 — 100,000 UZS
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-600">
                    Har bir o'quvchi uchun darhol naqd bonus
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border-2 border-emerald-200 shadow-md hover:shadow-lg transition-shadow text-left">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl shrink-0 font-black border border-emerald-200">
                  📈
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-black text-emerald-600 font-mono leading-tight">
                    Har oy 10% gacha
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-600">
                    O'quvchilar to'lovidan doimiy passiv komissiya
                  </div>
                </div>
              </div>
            </div>

            {/* Subheading */}
            <p className="text-base sm:text-lg lg:text-xl text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              <strong>English House</strong> ta'lim markazining xalqaro IELTS va zamonaviy til kurslarini o'quvchilaringizga tavsiya eting — har bir o'quvchi uchun kafolatlangan bonus va oylik daromad oling!
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href="#calculator"
                className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-2xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-black text-base sm:text-lg shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 text-center flex items-center justify-center gap-2.5"
              >
                <span>💰 Daromadingizni hisoblang</span>
                <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </a>

              <Link
                to="/login"
                className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 font-extrabold text-base sm:text-lg border-2 border-slate-300 shadow-md hover:shadow-lg transition-all text-center"
              >
                Kabinetingizga kiring →
              </Link>
            </div>

            {/* Trust Reassurance Bullets */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm font-semibold text-slate-500 pt-1">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="text-base">✓</span> 100% Shaffof hisob-kitob
              </span>
              <span className="flex items-center gap-1.5 text-[#1E3A8A] font-bold">
                <span className="text-base">✓</span> Har oy naqd yoki kartaga
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                <span className="text-base">✓</span> Bepul va tez ulanish
              </span>
            </div>

            {/* Trust Metrics Bar */}
            <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <span className="block text-3xl sm:text-4xl lg:text-5xl font-black text-[#1E3A8A] font-mono leading-none mb-1">
                  50+
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-700 block">Hamkor Maktablar</span>
                <span className="text-[11px] text-slate-400 font-medium">Toshkent shahri bo'ylab</span>
              </div>
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <span className="block text-3xl sm:text-4xl lg:text-5xl font-black text-[#0D9488] font-mono leading-none mb-1">
                  350+
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-700 block">Faol Ustozlar</span>
                <span className="text-[11px] text-slate-400 font-medium">Har oy daromad oluvchi</span>
              </div>
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <span className="block text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-600 font-mono leading-none mb-1">
                  100%
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-700 block">Shaffof Kabinet</span>
                <span className="text-[11px] text-slate-400 font-medium">Real vaqt monitoringi</span>
              </div>
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <span className="block text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-mono leading-none mb-1">
                  UZS
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-700 block">Kafolatlangan To'lov</span>
                <span className="text-[11px] text-slate-400 font-medium">Naqd yoki kartaga</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. INTERACTIVE INCOME CALCULATOR (MAIN HOOK) ────────────────────── */}
      <section id="calculator" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs sm:text-sm font-black text-[#0D9488] uppercase tracking-wider block mb-2">
              Kafolatlangan Hisob-Kitob
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Qancha qo'shimcha daromad olishingiz mumkin?
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-3">
              Rolingizni tanlang va tavsiya etmoqchi bo'lgan o'quvchilar sonini belgilang. Tizim sizning oylik va yillik daromadingizni bir zumda hisoblab beradi.
            </p>
          </div>

          <div className="card p-6 sm:p-10 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 border-2 border-slate-200 rounded-3xl shadow-xl">
            {/* Role Mode Selector */}
            <div className="flex justify-center mb-10">
              <div className="p-1.5 rounded-2xl bg-slate-200/90 inline-flex shadow-inner">
                <button
                  type="button"
                  onClick={() => setRoleMode('teacher')}
                  className={`px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-black transition-all ${
                    roleMode === 'teacher'
                      ? 'bg-[#1E3A8A] text-white shadow-md'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  👨‍🏫 Men O'qituvchiman (Ustoz)
                </button>
                <button
                  type="button"
                  onClick={() => setRoleMode('director')}
                  className={`px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-black transition-all ${
                    roleMode === 'director'
                      ? 'bg-[#1E3A8A] text-white shadow-md'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  👔 Men Maktab Direktoriman
                </button>
              </div>
            </div>

            {/* Inputs & Sliders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pb-8 border-b border-slate-200">
              <div className="space-y-7">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm sm:text-base font-bold text-slate-800">
                      {roleMode === 'teacher'
                        ? "Siz yo'naltiradigan o'quvchilar soni:"
                        : "Har bir ustoz o'rtacha jalb qiladigan o'quvchilar:"}
                    </label>
                    <span className="text-2xl sm:text-3xl font-black text-[#1E3A8A] font-mono">
                      {studentCount} nafar
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    value={studentCount}
                    onChange={(e) => setStudentCount(Number(e.target.value))}
                    className="w-full accent-[#1E3A8A] cursor-pointer h-3 sm:h-3.5 bg-slate-200 rounded-xl"
                  />
                  {/* Preset Pills */}
                  <div className="flex gap-2.5 mt-3">
                    {[5, 10, 20, 35, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setStudentCount(num)}
                        className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-lg transition-colors shadow-xs ${
                          studentCount === num
                            ? 'bg-blue-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {num} ta
                      </button>
                    ))}
                  </div>
                </div>

                {roleMode === 'director' && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm sm:text-base font-bold text-slate-800">
                        Maktabingizdagi faol ustozlar soni:
                      </label>
                      <span className="text-2xl sm:text-3xl font-black text-[#0D9488] font-mono">
                        {directorTeachersCount} ta ustoz
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="25"
                      step="1"
                      value={directorTeachersCount}
                      onChange={(e) => setDirectorTeachersCount(Number(e.target.value))}
                      className="w-full accent-[#0D9488] cursor-pointer h-3 sm:h-3.5 bg-slate-200 rounded-xl"
                    />
                    <div className="flex gap-2.5 mt-3">
                      {[3, 5, 8, 12, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setDirectorTeachersCount(num)}
                          className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-lg transition-colors shadow-xs ${
                            directorTeachersCount === num
                              ? 'bg-teal-700 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {num} ustoz
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 sm:p-5 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs sm:text-sm text-slate-700 space-y-2">
                  <p className="font-bold text-blue-950 text-sm flex items-center gap-1.5">
                    <span>💡</span> Rasmiy foizlar va qoidalar:
                  </p>
                  {roleMode === 'teacher' ? (
                    <ul className="space-y-1.5 text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>Har bir o'quvchi uchun <strong>50,000 UZS</strong> darhol bir martalik naqd bonus</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>Har oy o'quvchi to'lovidan <strong>10% doimiy oylik komissiya</strong> (~65,000 UZS/oy)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>O'quvchi 10 oy o'qisa, siz 10 oy davomida muntazam olasiz!</span>
                      </li>
                    </ul>
                  ) : (
                    <ul className="space-y-1.5 text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="text-teal-700 font-bold">✓</span>
                        <span>Maktabingizdan qo'shilgan har bir o'quvchi uchun <strong>100,000 UZS</strong> direktorlik bonusi</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-teal-700 font-bold">✓</span>
                        <span>Barcha ustozlar o'quvchilarining oylik to'lovidan <strong>5% doimiy mukofot</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-teal-700 font-bold">✓</span>
                        <span>Direktor almashsa ham maktab ma'lumotlari kodi bo'yicha to'liq saqlanadi</span>
                      </li>
                    </ul>
                  )}
                </div>
              </div>

              {/* Real-Time Earning Summary Card (Prominent & High-Converting) */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-blue-100 shadow-xl space-y-5">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider block">
                    Jami hisoblangan o'quvchilar:
                  </span>
                  <p className="text-2xl sm:text-4xl font-black text-slate-900 mt-1 font-mono">
                    {effectiveStudents} <span className="text-base sm:text-lg font-bold text-slate-500 font-sans">nafar o'quvchi</span>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-slate-700 block">Bir martalik ro'yxat bonusi:</span>
                    <span className="text-xs text-slate-500">O'quvchi markazga qabul qilinganda</span>
                  </div>
                  <span className="text-lg sm:text-2xl font-black text-[#1E3A8A] font-mono">
                    +{totalSignupBonus.toLocaleString()} UZS
                  </span>
                </div>

                {/* THE HERO CARD: Monthly Passive Income */}
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-100/40 border-2 border-emerald-400 shadow-sm relative overflow-hidden">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Har oy doimiy to'lanadi
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-emerald-900 block">
                    Har oylik kafolatlangan passiv daromad:
                  </span>
                  <p className="text-3xl sm:text-5xl font-black text-emerald-600 font-mono tracking-tight my-1.5">
                    +{monthlyRecurringCommission.toLocaleString()} <span className="text-base sm:text-xl font-bold">UZS / oy</span>
                  </p>
                  <span className="text-xs text-emerald-700 font-medium block">
                    O'quvchilar markazda o'qiyotgan har bir oy uchun avtomatik to'lanadi
                  </span>
                </div>

                {/* Annual Income Card */}
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-[#1E3A8A] to-blue-900 text-white shadow-md">
                  <span className="text-xs sm:text-sm font-semibold text-blue-200 uppercase tracking-wider block">
                    O'quv yili (10 oy) davomida jami sof daromad:
                  </span>
                  <p className="text-3xl sm:text-5xl font-black mt-1 font-mono tracking-tight text-amber-300">
                    {annualTotalIncome.toLocaleString()} <span className="text-lg sm:text-2xl font-bold text-white">UZS</span>
                  </p>
                  <span className="text-xs text-blue-100 block mt-1.5">
                    Asosiy darslaringizdan ajralmagan holda qo'shimcha kafolatlangan sof foyda
                  </span>
                </div>

                <Link
                  to="/login"
                  className="w-full text-center block text-base sm:text-lg py-4 px-6 font-black text-white bg-emerald-500 hover:bg-emerald-600 rounded-2xl shadow-lg hover:shadow-xl transition-all uppercase tracking-wide"
                >
                  Ushbu daromadni olishni boshlash →
                </Link>
              </div>
            </div>

            {/* Bottom Motivation Banner */}
            <div className="mt-8 text-center text-xs sm:text-sm font-semibold text-slate-600">
              ✨ Hech qanday murakkab shartlar yo'q. Faqat o'quvchi telefon raqamini kiritasiz — qolgan barcha jarayonni ma'murlarimiz bajaradi!
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. WHY WORK WITH ENGLISH HOUSE (COMPARISON) ──────────────────────── */}
      <section id="benefits" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs sm:text-sm font-black text-[#1E3A8A] uppercase tracking-wider block mb-2">
              Haqiqiy Hamkorlik
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Nega aynan English House bilan ishlash kerak?
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-3">
              Ko'plab markazlar bir martalik kichik to'lov va'da qiladi. Biz esa uzoq muddatli va shaffof daromad manbaini yaratamiz.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Bad Experience Card */}
            <div className="card p-7 sm:p-8 bg-white border border-rose-200 rounded-3xl shadow-xs">
              <div className="flex items-center gap-2.5 text-rose-700 font-extrabold text-base mb-4">
                <span className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-sm font-black">✕</span>
                Boshqa o'quv markazlari bilan ishlashda:
              </div>
              <ul className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black text-base">•</span>
                  Faqat bir martalik kichik bonus beradi va hamkorlik shu bilan to'xtaydi.
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black text-base">•</span>
                  O'quvchi to'lov qildimi yoki yo'qmi — ustozga ko'rinmaydi, shaffoflik yo'q.
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black text-base">•</span>
                  Direktor yoki o'qituvchi o'zgarsa, butun hisob-kitob yo'qolib ketadi.
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black text-base">•</span>
                  O'quvchi darsga bormasa, ustoz o'rtada xijolat bo'lib qoladi.
                </li>
              </ul>
            </div>

            {/* English House Benefit Card */}
            <div className="card p-7 sm:p-8 bg-white border-2 border-emerald-500 shadow-xl relative rounded-3xl">
              <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-black shadow-sm uppercase tracking-wider">
                Kafolatlangan
              </div>
              <div className="flex items-center gap-2.5 text-emerald-800 font-extrabold text-base mb-4">
                <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-black text-emerald-700">✓</span>
                English House Referral Platformasida:
              </div>
              <ul className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-black text-base">✓</span>
                  <span><strong>Har oylik passiv daromad:</strong> O'quvchi 1 yil o'qisa, 1 yil davomida har oy hisobingizga to'lov tushadi.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-black text-base">✓</span>
                  <span><strong>Shaffof shaxsiy kabinet:</strong> Qaysi o'quvchi to'lov qildi, qaysi biri darsda — real vaqtda ko'rasiz.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-black text-base">✓</span>
                  <span><strong>Maktab kodi bilan xavfsiz:</strong> Direktor almashsa ham maktab va o'qituvchilar bazasi o'zgarmasdan saqlanadi.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-black text-base">✓</span>
                  <span><strong>IELTS 7.0+ Natija:</strong> O'quvchilaringiz nufuzli xalqaro sertifikat oladi, bu esa maktabingiz obro'sini oshiradi.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS (4 SIMPLE STEPS) ─────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs sm:text-sm font-black text-[#0D9488] uppercase tracking-wider block mb-2">
              Atigi 4 qadam
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Tizim qanday ishlaydi?
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-3">
              Ortiqcha hujjatbozliksiz, 30 soniyada o'quvchi kiritasiz. Qolgan barcha ishlarni ma'murlarimiz o'z zimmalariga oladi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6 border-2 border-slate-200 rounded-2xl relative bg-slate-50/70 hover:bg-white hover:border-blue-300 transition-all shadow-xs hover:shadow-md">
              <span className="w-12 h-12 rounded-xl bg-[#1E3A8A] text-white font-black flex items-center justify-center text-lg mb-4 shadow-sm">
                1
              </span>
              <h3 className="font-black text-slate-900 text-base sm:text-lg mb-2">Kabinetga kiring</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Sizga berilgan telefon raqam va parol bilan platformaga kiring. Maxsus dastur o'rnatish shart emas.
              </p>
            </div>

            <div className="card p-6 border-2 border-slate-200 rounded-2xl relative bg-slate-50/70 hover:bg-white hover:border-teal-300 transition-all shadow-xs hover:shadow-md">
              <span className="w-12 h-12 rounded-xl bg-[#0D9488] text-white font-black flex items-center justify-center text-lg mb-4 shadow-sm">
                2
              </span>
              <h3 className="font-black text-slate-900 text-base sm:text-lg mb-2">O'quvchini yozing</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                O'quvchi yoki ota-onaning telefon raqamini kiritasiz (atigi 30 soniya vaqt oladi).
              </p>
            </div>

            <div className="card p-6 border-2 border-slate-200 rounded-2xl relative bg-slate-50/70 hover:bg-white hover:border-emerald-300 transition-all shadow-xs hover:shadow-md">
              <span className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-lg mb-4 shadow-sm">
                3
              </span>
              <h3 className="font-black text-slate-900 text-base sm:text-lg mb-2">Adminlar bog'lanadi</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Markazimiz mutaxassislari o'quvchiga qo'ng'iroq qilib, bepul sinov darsiga taklif etadi.
              </p>
            </div>

            <div className="card p-6 border-2 border-slate-200 rounded-2xl relative bg-slate-50/70 hover:bg-white hover:border-amber-300 transition-all shadow-xs hover:shadow-md">
              <span className="w-12 h-12 rounded-xl bg-amber-500 text-white font-black flex items-center justify-center text-lg mb-4 shadow-sm">
                4
              </span>
              <h3 className="font-black text-slate-900 text-base sm:text-lg mb-2">Har oy mukofot oling</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                O'quvchi to'lov qilishi bilan hisobingizga avtomatik bonus yoziladi va oy boshida to'lanadi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. ROLE SPECIFIC ADVANTAGES ─────────────────────────────────────── */}
      <section id="teachers" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          {/* Teachers Block */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <span className="text-xs sm:text-sm font-black text-[#1E3A8A] uppercase tracking-wider block">
                Fidoiy Ustozlar Uchun
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                O'qituvchi sifatida darsdan tashqari ikkinchi oylik maoshga ega bo'ling!
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Ko'plab ustozlar o'quvchilarga qo'shimcha dars berish uchun charchab, asabiylashadi. English House tizimi bilan siz faqat tavsiya qilasiz, darslarni tajribali IELTS instruktorlarimiz olib boradi — siz esa har oy barqaror foiz olasiz!
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                  <span className="text-emerald-600 font-black text-lg">✓</span>
                  <span>Bir sinfdan 10 ta o'quvchi yo'naltirib, oyiga <strong>650,000 UZS</strong> doimiy mukofot.</span>
                </div>
                <div className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                  <span className="text-emerald-600 font-black text-lg">✓</span>
                  <span>O'quvchi ro'yxatdan o'tgan zahoti <strong>50,000 UZS</strong> darhol naqd bonus.</span>
                </div>
                <div className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                  <span className="text-emerald-600 font-black text-lg">✓</span>
                  <span>O'quvchilaringizning ingliz tili darajasi ko'tariladi va maktabdagi baholari 5 ga chiqadi.</span>
                </div>
              </div>
            </div>

            <div className="card p-7 sm:p-8 bg-white border-2 border-slate-200 rounded-3xl shadow-md space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-black text-lg shadow-xs">
                  Sh
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">Shaxnoza M.</h4>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">1-maktab Ingliz tili ustozi</p>
                </div>
              </div>
              <p className="text-sm sm:text-base text-slate-700 italic bg-blue-50/50 p-4 rounded-2xl border border-blue-100 leading-relaxed">
                "Avval o'quvchilarim markaz so'raganda shunchaki maslahat berardim. Referral tizimiga ulangach, bir oyda 14 ta o'quvchini yo'naltirdim. Ham bolalar IELTS olishga tayyorlanyapti, ham menga oyiga 1 million so'mdan ortiq qo'shimcha daromad kelmoqda. Juda xursandman!"
              </p>
              <div className="flex items-center justify-between text-sm font-bold text-slate-600 pt-2 border-t border-slate-100">
                <span>O'quvchilari: <strong className="text-slate-900 text-base">14 nafar</strong></span>
                <span className="text-emerald-600 font-black text-base sm:text-lg">+1,100,000 UZS / oy</span>
              </div>
            </div>
          </div>

          {/* Directors Block */}
          <div id="directors" className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-10 border-t border-slate-200">
            <div className="card p-7 sm:p-8 bg-white border-2 border-slate-200 rounded-3xl shadow-md space-y-5 order-2 lg:order-1">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-900 flex items-center justify-center font-black text-lg shadow-xs">
                  S
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">Solijonov N.</h4>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Maktab Direktori</p>
                </div>
              </div>
              <p className="text-sm sm:text-base text-slate-700 italic bg-teal-50/50 p-4 rounded-2xl border border-teal-100 leading-relaxed">
                "Maktabimiz nufuzini oshirish uchun nufuzli ta'lim markazi bilan hamkorlik qilish eng to'g'ri qaror bo'ldi. O'qituvchilarimiz ham o'quvchilarni yo'naltirib qo'shimcha moddiy rag'bat olyapti, maktabimiz o'quvchilari esa IELTS sertifikatlari bilan oliy ta'limga kiryapti. Tizim 100% shaffof."
              </p>
              <div className="flex items-center justify-between text-sm font-bold text-slate-600 pt-2 border-t border-slate-100">
                <span>Ustozlar soni: <strong className="text-slate-900 text-base">8 nafar</strong></span>
                <span className="text-teal-800 font-black text-base sm:text-lg">Direktorlik mukofot jamg'armasi</span>
              </div>
            </div>

            <div className="space-y-5 order-1 lg:order-2">
              <span className="text-xs sm:text-sm font-black text-[#0D9488] uppercase tracking-wider block">
                Muhtaram Maktab Direktorlari Uchun
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Maktab reytingini ko'taring va umumiy mukofot jamg'armasiga ega bo'ling!
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Maktabingizdagi barcha o'qituvchilar faoliyati birlashgan holda umumiy direktorlik bonusi va oylik keshbek yaratadi. Direktor almashgan taqdirda ham butun ma'lumotlar bazasi maktab kodi bo'yicha mustahkam saqlanadi.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                  <span className="text-teal-700 font-black text-lg">✓</span>
                  <span>Har bir o'quvchi uchun <strong>100,000 UZS</strong> direktorlik bonusi.</span>
                </div>
                <div className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                  <span className="text-teal-700 font-black text-lg">✓</span>
                  <span>Barcha ustozlarning o'quvchilari to'lovidan <strong>5% doimiy oylik keshbek</strong>.</span>
                </div>
                <div className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                  <span className="text-teal-700 font-black text-lg">✓</span>
                  <span>O'qituvchilaringiz maoshidan tashqari pul ishlab, maktabingizdan mamnun bo'lishadi.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ACCORDION ────────────────────────────────────────────────── */}
      <section id="faq" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs sm:text-sm font-black text-[#1E3A8A] uppercase tracking-wider block mb-2">
              Savol-Javoblar
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Ko'p beriladigan savollar
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-3">
              Hamkorlik dasturi haqidagi eng muhim savollarga aniq javoblar.
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: "Mukofot pullari qachon va qanday to'lab beriladi?",
                a: "Har oyning 1-5 sanalarida o'tgan oy uchun hisoblangan barcha bonus va komissiyalar naqd pul yoki plastik kartangizga to'liq o'tkazib beriladi. Shaxsiy kabinetingizda har bir to'lovning aniq hisoboti aks etadi.",
              },
              {
                q: "O'quvchi o'qishni to'xtatib qo'ysa nima bo'ladi?",
                a: "O'quvchi markazda o'qigan barcha oylar uchun mukofotingiz to'liq to'lanadi. Agar o'quvchi keyinroq o'qishini davom ettirsa, siz yana oylik komissiya olishda davom etaverasiz.",
              },
              {
                q: "Maktab direktori o'zgarsa, maktab va o'qituvchilar hisobidagi o'quvchilar nima bo'ladi?",
                a: "Tizimimizda barcha ma'lumotlar shaxsiy maktab raqamiga (kodiga) biriktirilgan. Direktor o'zgarsa ham yangi rahbar o'z maktabining barcha o'qituvchilari va o'quvchilarini to'liq ko'radi, ustozlarning daromadlari esa o'zgarmay saqlanib qoladi.",
              },
              {
                q: "Faqat ingliz tili o'qituvchilari ishtirok etishi mumkinmi?",
                a: "Yo'q! Matematika, ona tili, tarix, sinf rahbarlari yoki hatto repetitorlar ham o'z o'quvchilariga sifatli til ta'limini tavsiya etib, qo'shimcha daromad olishlari mumkin.",
              },
              {
                q: "Kabinatga kirish uchun qayerdan login va parol olaman?",
                a: "Maktabingiz direktori yoki markazimiz menejerlari sizga telefon raqamingiz orqali shaxsiy akkaunt yaratib beradi. Tizimga kirish uchun faqat telefon raqamingiz va parolingiz kifoya.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="border-2 border-slate-200 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-800 hover:bg-slate-50"
                >
                  <span>{item.q}</span>
                  <span className="text-slate-400 text-xl font-mono shrink-0">
                    {openFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 sm:px-6 pb-6 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. CALL TO ACTION BANNER ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-[#1E3A8A] via-blue-900 to-[#0D9488] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            O'quvchilaringiz kelajagiga sarmoya kiriting va o'z mehnatingizga munosib barqaror daromad oling!
          </h2>
          <p className="text-base sm:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Bugunoq shaxsiy kabinetingizga kiring yoki markazimiz bilan bog'lanib, maktabingiz uchun eksklyuziv hamkorlik shartlarini faollashtiring.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white text-[#1E3A8A] hover:bg-slate-100 font-black text-base sm:text-lg shadow-xl hover:shadow-2xl transition-all uppercase tracking-wide"
            >
              Shaxsiy kabinetga kirish →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9. FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#1E3A8A] text-white flex items-center justify-center text-xs font-bold">
              R
            </div>
            <span className="font-semibold text-slate-200">English House Referral Platform</span>
          </div>
          <p className="text-slate-500">
            Toshkent shahar, Ta'lim markazi referral boshqaruv tizimi © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
