import type { DailyTrendItem, AdminCallStatItem } from '../../components/Charts';

export interface CeoSummary {
  overall: {
    totalLeads: number;
    waiting: number;
    accepted: number;
    rejected: number;
    studying: number;
    stopped: number;
    studyingStudents: number;
    stoppedStudents: number;
    paidStudentsCount: number;
    unpaidStudentsCount: number;
    totalRevenueUzs: number;
    conversionRatePercent: number;
  };
  period: {
    startDate: string;
    endDate: string;
    leadsCount: number;
    waitingCount: number;
    acceptedCount: number;
    rejectedCount: number;
    callsMadeCount: number;
    paidStudentsCount: number;
    revenueUzs: number;
    conversionRatePercent: number;
  };
  dailyTrends: DailyTrendItem[];
  adminCallStats: AdminCallStatItem[];
  recentCalls: {
    id: number;
    adminId: number;
    adminName: string;
    description: string;
    callStatus: string;
    callNote?: string | null;
    studentName: string;
    createdAt: string;
  }[];
  schoolsSummary: {
    id: number;
    name: string;
    schoolNumber?: string | null;
    shortName?: string | null;
    directorName: string | null;
    directorPhone: string | null;
    teacherCount: number;
    studentCount: number;
    studyingCount: number;
    revenueUzs: number;
    isActive: boolean;
  }[];
  teachersSummary: {
    id: number;
    fullName: string;
    phone: string;
    schoolId?: number | null;
    schoolName: string | null;
    schoolNumber?: string | null;
    totalStudents: number;
    studyingStudents: number;
    paidStudents: number;
    totalCommissionUzs: number;
    pendingCommissionUzs: number;
  }[];
  leads?: {
    total: number;
    waiting: number;
    accepted: number;
    rejected: number;
    studying: number;
    stopped: number;
    paidStudentsCount: number;
    unpaidStudentsCount: number;
    totalRevenueUzs: number;
    conversionRatePercent: number;
  };
}

export interface School {
  id: number;
  name: string;
  schoolNumber?: string | null;
  shortName?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  role: string;
  schoolId?: number | null;
  isActive: boolean;
  meta?: { subject?: string } | null;
  createdAt: string;
}

export interface Student {
  id: number;
  fullName: string;
  phone: string;
  secondaryPhone?: string | null;
  schoolId?: number | null;
  teacherId?: number | null;
  studyStatus: string;
  callStatus: string;
  callNote?: string | null;
  createdAt: string;
  schoolName?: string | null;
  schoolNumber?: string | null;
  teacherName?: string | null;
  teacherPhone?: string | null;
  meta?: { grade?: string; course_interest?: string; parent_name?: string } | null;
}

export interface AuditLog {
  id: number;
  actorUserId: number;
  actorName?: string | null;
  actorPhone?: string | null;
  action: string;
  entityType: string;
  description: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CommissionRules {
  id: number;
  teacherSignupBonusUzs: number;
  directorSignupBonusUzs: number;
  teacherMonthlyPercent: number;
  directorMonthlyPercent: number;
}

export interface Payout {
  id: number;
  makerId: number | null;
  receiverId: number;
  amountUzs: number;
  type: 'INITIAL_BONUS' | 'CREDIT' | 'DEBIT';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  comments?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface UserBalance {
  commissionTotalUzs: number;
  commissionPaidUzs: number;
  commissionPendingUzs: number;
  payoutsNetUzs: number;
  balanceUzs: number;
}

export interface PayoutBalanceRow extends UserBalance {
  userId: number;
  fullName: string;
  phone: string;
  role: 'DIRECTOR' | 'TEACHER';
}

export const formatDateInput = (d: Date): string => d.toLocaleDateString('sv');
