import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminPanelDashboard from './pages/AdminPanelDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import TeacherDashboard from './pages/TeacherDashboard';

const ROLE_PATHS: Record<string, string> = {
  SUPER_ADMIN: '/superadmin',
  MANAGER: '/manager',
  SALES_MANAGER: '/sales-manager',
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
  const { user } = useAuth();

  if (!user || !user.token) {
    return <Navigate to="/login" replace />;
  }
  // Signed in but opened another role's URL: send them to their own dashboard rather
  // than logging them out. (The API enforces access regardless — this is only UX.)
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_PATHS[user.role] ?? '/login'} replace />;
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
        path="/sales-manager/*"
        element={
          <ProtectedRoute allowedRoles={['SALES_MANAGER']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminPanelDashboard />
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
