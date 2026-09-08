import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import TeacherDashboard from './pages/TeacherDashboard';

const ROLE_PATHS: Record<string, string> = {
  SUPER_ADMIN: '/superadmin',
  MANAGER: '/manager',
  ADMIN: '/admin',
  DIRECTOR: '/director',
  TEACHER: '/teacher',
};

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) => {
  const { user, logout } = useAuth();
  const isUnauthorized = !user || !user.token || !allowedRoles.includes(user.role);

  useEffect(() => {
    if (isUnauthorized && user) {
      logout();
    }
  }, [isUnauthorized, user, logout]);

  if (isUnauthorized) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppRouter = () => {
  const { user } = useAuth();
  const hasValidRole = user && user.role && ROLE_PATHS[user.role];

  return (
    <Routes>
      <Route
        path="/login"
        element={hasValidRole ? <Navigate to={ROLE_PATHS[user.role]!} replace /> : <Login />}
      />
      <Route
        path="/superadmin/*"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/*"
        element={
          <ProtectedRoute allowedRoles={['MANAGER']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/director/*"
        element={
          <ProtectedRoute allowedRoles={['DIRECTOR']}>
            <DirectorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute allowedRoles={['TEACHER']}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landing"
        element={<LandingPage />}
      />
      <Route
        path="/"
        element={<LandingPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
