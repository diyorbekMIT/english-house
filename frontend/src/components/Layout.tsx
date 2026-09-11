import { useState, type ReactNode } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem { label: string; to: string; icon: ReactNode; }

const IconStudents = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 21H3a12.083 12.083 0 012.84-10.422L12 14z" />
  </svg>
);
const IconUsers = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconSchool = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const IconMoney = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconLog = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const IconSettings = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ROLE_NAV: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Lidlar va Natijalar', to: '/superadmin', icon: <IconMoney /> },
    { label: 'Maktablar & Ustozlar', to: '/superadmin/schools', icon: <IconSchool /> },
    { label: "O'quvchilar", to: '/superadmin/students', icon: <IconStudents /> },
    { label: "Birinchi to'lovlar", to: '/superadmin/first-payments', icon: <IconMoney /> },
    { label: 'Direktorlar', to: '/superadmin/directors', icon: <IconUsers /> },
    { label: 'Sotuv menejerlari', to: '/superadmin/admins', icon: <IconUsers /> },
    { label: 'Adminlar', to: '/superadmin/admin-users', icon: <IconUsers /> },
    { label: "To'lovlar", to: '/superadmin/payouts', icon: <IconMoney /> },
    { label: 'Komissiya qoidalari', to: '/superadmin/rules', icon: <IconSettings /> },
    { label: 'Audit jurnali (CEO)', to: '/superadmin/audit', icon: <IconLog /> },
  ],
  MANAGER: [
    { label: "O'quvchilar", to: '/manager/students', icon: <IconStudents /> },
    { label: "Birinchi to'lovlar", to: '/manager/first-payments', icon: <IconMoney /> },
    { label: 'Komissiyalar', to: '/manager/commissions', icon: <IconMoney /> },
  ],
  SALES_MANAGER: [
    { label: "O'quvchilar", to: '/sales-manager/students', icon: <IconStudents /> },
    { label: "Birinchi to'lovlar", to: '/sales-manager/first-payments', icon: <IconMoney /> },
    { label: 'Komissiyalar', to: '/sales-manager/commissions', icon: <IconMoney /> },
  ],
  ADMIN: [
    { label: "O'quvchilar", to: '/admin/students', icon: <IconStudents /> },
  ],
  DIRECTOR: [
    { label: 'Umumiy tahlil', to: '/director', icon: <IconSchool /> },
    { label: "O'qituvchilar", to: '/director/teachers', icon: <IconUsers /> },
    { label: "O'quvchilar", to: '/director/students', icon: <IconStudents /> },
    { label: 'Komissiyalar', to: '/director/commissions', icon: <IconMoney /> },
  ],
  TEACHER: [
    { label: 'Umumiy tahlil', to: '/teacher', icon: <IconSchool /> },
    { label: "O'quvchilarim", to: '/teacher/students', icon: <IconStudents /> },
    { label: "Yangi o'quvchi", to: '/teacher/students/new', icon: <IconStudents /> },
    { label: 'Komissiyalar', to: '/teacher/commissions', icon: <IconMoney /> },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'CEO',
  MANAGER: 'Menejer',
  SALES_MANAGER: 'Sotuv menejeri',
  ADMIN: 'Admin',
  DIRECTOR: 'Direktor',
  TEACHER: "O'qituvchi",
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const role = user?.role ?? '';
  const navItems = ROLE_NAV[role] ?? [];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FAFC' }}>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white flex flex-col transition-transform duration-300 ease-in-out md:hidden shadow-xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-4 flex items-center justify-between border-b border-slate-200">
          <Link to="/" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-xs group-hover:scale-105 transition-transform"
              style={{ background: '#1E3A8A' }}
            >
              R
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight group-hover:text-blue-900">Referral</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Link to Landing Page */}
        <div className="px-3 pt-3">
          <Link
            to="/"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-blue-900 bg-blue-50/70 hover:bg-blue-100 transition-colors border border-blue-200"
          >
            <span>🌐 Asosiy sahifa (Landing)</span>
            <span className="ml-auto text-blue-500 text-sm">↗</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split('/').length <= 2}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2 mb-2 rounded-lg bg-slate-50">
            <p className="text-xs font-semibold text-slate-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
          </div>
          <button onClick={handleLogout} className="sidebar-link text-red-600 hover:bg-red-50">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Chiqish
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-56 shrink-0 h-screen sticky top-0 flex-col bg-white border-r border-slate-200"
      >
        {/* Brand with Link to Landing Page */}
        <div className="px-4 py-5 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-2 group" title="Asosiy sahifa (Landing) ga o'tish">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-xs group-hover:scale-105 transition-transform"
              style={{ background: '#1E3A8A' }}
            >
              R
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight group-hover:text-blue-900">Referral</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
        </div>

        {/* Quick Link to Landing Page */}
        <div className="px-3 pt-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-blue-900 bg-blue-50/70 hover:bg-blue-100 transition-colors border border-blue-200"
            title="Asosiy landing sahifaga o'tish"
          >
            <span>🌐 Asosiy sahifa (Landing)</span>
            <span className="ml-auto text-blue-500 text-sm">↗</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split('/').length <= 2}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-3 border-t border-slate-200">
          <div className="px-3 py-2 mb-1 rounded-lg bg-slate-50">
            <p className="text-xs font-semibold text-slate-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
          </div>
          <button id="logout-btn" onClick={handleLogout} className="sidebar-link text-red-600 hover:bg-red-50">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Chiqish
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 flex items-center px-4 sm:px-6 shrink-0 bg-white border-b border-slate-200 justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 -ml-1 text-slate-700 hover:bg-slate-100 rounded-lg"
              title="Menyuni ochish"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="text-sm font-bold text-slate-900 md:hidden flex items-center gap-1.5 hover:text-blue-900">
              <span>Referral Platform</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Go to Landing Page Header Button */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#1E3A8A] bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200 shadow-2xs"
              title="Asosiy landing sahifaga o'tish"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Asosiy sahifa</span>
            </Link>

            <span className="text-xs sm:text-sm font-medium text-slate-700 truncate max-w-[120px] sm:max-w-none">
              {user?.fullName}
            </span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: '#1E3A8A' }}
            >
              {user?.fullName?.[0]?.toUpperCase() ?? 'U'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-3 sm:p-6 pb-20 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-2 py-1 flex items-center justify-around shadow-lg">
        {navItems.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length <= 2}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-[#1E3A8A]' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {item.icon}
            <span className="truncate max-w-[70px] mt-0.5">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default Layout;
