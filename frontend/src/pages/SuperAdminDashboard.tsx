import { Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';
import { LeadsAnalyticsDashboard } from './superadmin/LeadsAnalyticsDashboard';
import { SchoolsTeachersDashboard } from './superadmin/SchoolsTeachersDashboard';
import { SchoolDetailTeachersPage } from './superadmin/SchoolDetailTeachersPage';
import { TeacherStudentsDetailPage } from './superadmin/TeacherStudentsDetailPage';
import { StudentsDashboard } from './superadmin/StudentsDashboard';
import { DirectorsPage } from './superadmin/DirectorsPage';
import { AdminsPage } from './superadmin/AdminsPage';
import { CommissionRulesPage } from './superadmin/CommissionRulesPage';
import { CeoAuditLogsPage } from './superadmin/CeoAuditLogsPage';

export const SuperAdminDashboard = () => (
  <Layout>
    <Routes>
      <Route index element={<LeadsAnalyticsDashboard />} />
      <Route path="schools" element={<SchoolsTeachersDashboard />} />
      <Route path="schools/:schoolId" element={<SchoolDetailTeachersPage />} />
      <Route path="schools/:schoolId/teachers/:teacherId" element={<TeacherStudentsDetailPage />} />
      <Route path="teachers/:teacherId/students" element={<TeacherStudentsDetailPage />} />
      <Route path="teachers/:teacherId" element={<TeacherStudentsDetailPage />} />
      <Route path="students" element={<StudentsDashboard />} />
      <Route path="directors" element={<DirectorsPage />} />
      <Route path="admins" element={<AdminsPage />} />
      <Route path="rules" element={<CommissionRulesPage />} />
      <Route path="audit" element={<CeoAuditLogsPage />} />
    </Routes>
  </Layout>
);

export default SuperAdminDashboard;
