import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface AuthUser {
  token: string;
  role: string;
  userId: number;
  fullName: string;
  schoolId?: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (phone: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

interface LoginResponse {
  token: string;
  role: string;
  userId: number;
  fullName: string;
  schoolId?: number | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const VALID_ROLES = ['SUPER_ADMIN', 'MANAGER', 'SALES_MANAGER', 'ADMIN', 'DIRECTOR', 'TEACHER'];

const parseUser = (): AuthUser | null => {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && parsed.token && parsed.role && VALID_ROLES.includes(parsed.role)) {
      return parsed;
    }
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    return null;
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(parseUser);
  const queryClient = useQueryClient();

  const login = async (phone: string, password: string): Promise<AuthUser> => {
    const { data } = await api.post<LoginResponse>('/auth/login', { phone, password });
    const authUser: AuthUser = {
      token: data.token,
      role: data.role,
      userId: data.userId,
      fullName: data.fullName,
      schoolId: data.schoolId,
    };
    localStorage.setItem('user', JSON.stringify(authUser));
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    queryClient.clear();
    setUser(authUser);
    return authUser;
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    // Otherwise the next account signing in on this tab briefly sees the previous
    // user's cached students, payouts and commission rules.
    queryClient.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
