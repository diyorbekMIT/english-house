import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_PATHS: Record<string, string> = {
  SUPER_ADMIN: '/superadmin',
  MANAGER: '/manager',
  SALES_MANAGER: '/sales-manager',
  ADMIN: '/admin',
  DIRECTOR: '/director',
  TEACHER: '/teacher',
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('+998900000001');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const authUser = await login(phone, password);
      const target = ROLE_PATHS[authUser.role] ?? '/';
      navigate(target, { replace: true });
    } catch (err: unknown) {
      setError("Telefon raqam yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#F8FAFC' }}
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}
          >
            <svg className="w-7 h-7" style={{ color: '#1E3A8A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 14l6.16-3.422A12.083 12.083 0 0121 21H3a12.083 12.083 0 012.84-10.422L12 14z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
            Referral Platform
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            Ta'lim markazi boshqaruv tizimi
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="label">Telefon raqam</label>
              <input
                id="phone"
                type="tel"
                className="input"
                placeholder="+998901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Parol</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <div className="notice-error">{error}</div>}
            <button id="login-btn" type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Kirish…' : 'Kirish'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#94A3B8' }}>
          English House © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;
