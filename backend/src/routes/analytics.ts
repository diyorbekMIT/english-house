import { Router } from 'express';
import { db } from '../../db/client.js';
import {
  students,
  monthlyPayments,
  auditLogs,
  schools,
  users,
  roles,
  commissions,
} from '../../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getUserBalance } from '../lib/balance.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { desc, eq, and } from 'drizzle-orm';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

// Order matters: longer/more specific keywords must be checked before shorter ones
// that could be a substring of another status's audit description text.
const CALL_STATUS_KEYWORDS = [
  'STARTED_STUDYING',
  'FIRST_LESSON',
  'MADE_PAYMENT',
  'REGISTERED',
  'REJECTED',
  'WAITING',
  'CALLED',
  'ACCEPTED', // legacy, pre-pipeline
] as const;

// CEO / SuperAdmin analytics endpoint with date range filter support
analyticsRouter.get('/ceo-summary', requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // 1. All data from DB
  const allStudents = await db.select().from(students);
  const allPayments = await db.select().from(monthlyPayments);
  const allSchools = await db.select().from(schools);
  const allCommissions = await db.select().from(commissions);

  const allUsers = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      phone: users.phone,
      roleId: users.roleId,
      roleName: roles.name,
      schoolId: users.schoolId,
      directorId: users.directorId,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id));

  const callAuditLogs = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      actorName: users.fullName,
      actorPhone: users.phone,
      description: auditLogs.description,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(eq(auditLogs.action, 'STUDENT_CALL_STATUS_UPDATE'))
    .orderBy(desc(auditLogs.createdAt));

  // 2. Lifetime / Overall metrics ("left overall data above")
  const totalLeads = allStudents.length;
  const totalRevenueUzs = allPayments.reduce((acc, p) => acc + p.amountUzs, 0);
  const paidStudentIds = new Set(allPayments.map((p) => p.studentId));
  const paidStudentsCount = paidStudentIds.size;
  const unpaidStudentsCount = Math.max(0, totalLeads - paidStudentsCount);
  // studyStatus is now binary (ACTIVE/NOACTIVE) — field names kept as studyingStudents/
  // stoppedStudents so existing frontend consumers don't need to change.
  const studyingStudents = allStudents.filter((s) => s.studyStatus === 'ACTIVE').length;
  const stoppedStudents = allStudents.filter((s) => s.studyStatus === 'NOACTIVE').length;
  const waitingLeads = allStudents.filter((s) => s.callStatus === 'WAITING').length;
  const calledLeads = allStudents.filter((s) => s.callStatus === 'CALLED').length;
  const registeredLeads = allStudents.filter((s) => s.callStatus === 'REGISTERED').length;
  const firstLessonLeads = allStudents.filter((s) => s.callStatus === 'FIRST_LESSON').length;
  const startedStudyingLeads = allStudents.filter((s) => s.callStatus === 'STARTED_STUDYING').length;
  const madePaymentLeads = allStudents.filter((s) => s.callStatus === 'MADE_PAYMENT').length;
  const rejectedLeads = allStudents.filter((s) => s.callStatus === 'REJECTED').length;
  // acceptedLeads: aggregate of every stage past WAITING and not REJECTED — kept for
  // existing consumers that only expect 3 buckets (waiting/accepted/rejected).
  const acceptedLeads = calledLeads + registeredLeads + firstLessonLeads + startedStudyingLeads + madePaymentLeads;

  const overall = {
    totalLeads,
    total: totalLeads,
    waiting: waitingLeads,
    accepted: acceptedLeads,
    rejected: rejectedLeads,
    studying: studyingStudents,
    stopped: stoppedStudents,
    studyingStudents,
    stoppedStudents,
    calledLeads,
    registeredLeads,
    firstLessonLeads,
    startedStudyingLeads,
    madePaymentLeads,
    paidStudentsCount,
    unpaidStudentsCount,
    totalRevenueUzs,
    conversionRatePercent: totalLeads > 0 ? Math.round((paidStudentsCount / totalLeads) * 100) : 0,
  };

  // 3. Date Range Parsing for Filtered Period (using local calendar)
  const now = new Date();
  let start: Date;
  let end: Date;

  const toLocalDateString = (date: Date) => date.toLocaleDateString('sv');

  if (startDate && typeof startDate === 'string' && startDate.trim()) {
    start = new Date(`${startDate}T00:00:00`);
  } else {
    // Default to last 14 days
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
  }

  if (endDate && typeof endDate === 'string' && endDate.trim()) {
    end = new Date(`${endDate}T23:59:59.999`);
  } else {
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  // 4. Period-Filtered Stats
  const periodStudents = allStudents.filter((s) => {
    const d = new Date(s.createdAt);
    return d >= start && d <= end;
  });

  const periodPayments = allPayments.filter((p) => {
    const d = new Date(p.createdAt ?? p.paidAt);
    return d >= start && d <= end;
  });

  const periodRevenueUzs = periodPayments.reduce((acc, p) => acc + p.amountUzs, 0);
  const periodPaidStudentIds = new Set(periodPayments.map((p) => p.studentId));
  const periodPaidCount = periodPaidStudentIds.size;

  const periodCalls = callAuditLogs.filter((l) => {
    const d = new Date(l.createdAt);
    return d >= start && d <= end;
  });

  const period = {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
    leadsCount: periodStudents.length,
    waitingCount: periodStudents.filter((s) => s.callStatus === 'WAITING').length,
    acceptedCount: periodStudents.filter((s) => s.callStatus !== 'WAITING' && s.callStatus !== 'REJECTED').length,
    rejectedCount: periodStudents.filter((s) => s.callStatus === 'REJECTED').length,
    callsMadeCount: periodCalls.length,
    paidStudentsCount: periodPaidCount,
    revenueUzs: periodRevenueUzs,
    conversionRatePercent:
      periodStudents.length > 0 ? Math.round((periodPaidCount / periodStudents.length) * 100) : 0,
  };

  // 5. Daily Trends — EVERY DAY STARTS FROM ZERO!
  const UZ_MONTH_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const dailyTrends: {
    date: string;
    label: string;
    newLeads: number;
    callsMade: number;
    paidCount: number;
    revenueUzs: number;
  }[] = [];

  // If date range is longer than 31 days, show the latest 31 days up to endDate in the daily chart
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const trendStart =
    totalDays > 31
      ? new Date(end.getFullYear(), end.getMonth(), end.getDate() - 30, 0, 0, 0, 0)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);

  const cursor = new Date(trendStart);
  const endLimit = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  while (cursor <= endLimit && dailyTrends.length < 32) {
    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59, 999);

    const dateStr = toLocalDateString(dayStart);
    const dNum = dayStart.getDate();
    const mNum = dayStart.getMonth();
    const label = `${String(dNum).padStart(2, '0')}-${UZ_MONTH_SHORT[mNum]}`;

    // Count for this single day (starts from 0 every day)
    const newLeads = allStudents.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= dayStart && d <= dayEnd;
    }).length;

    const callsMade = callAuditLogs.filter((l) => {
      const d = new Date(l.createdAt);
      return d >= dayStart && d <= dayEnd;
    }).length;

    const dayPayments = allPayments.filter((p) => {
      const d = new Date(p.createdAt ?? p.paidAt);
      return d >= dayStart && d <= dayEnd;
    });

    const paidCount = dayPayments.length;
    const revenueUzs = dayPayments.reduce((acc, p) => acc + p.amountUzs, 0);

    dailyTrends.push({
      date: dateStr,
      label,
      newLeads,
      callsMade,
      paidCount,
      revenueUzs,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  // 6. Admin call stats in the period
  const adminStatsMap = new Map<
    number,
    {
      adminId: number;
      adminName: string;
      adminPhone: string;
      totalCalls: number;
      accepted: number;
      rejected: number;
      waiting: number;
      lastCallAt: string;
    }
  >();

  for (const log of periodCalls) {
    const adminId = log.actorUserId ?? 0;
    if (!adminId) continue;
    const adminName = log.actorName ?? `Admin #${adminId}`;
    const adminPhone = log.actorPhone ?? '';

    if (!adminStatsMap.has(adminId)) {
      adminStatsMap.set(adminId, {
        adminId,
        adminName,
        adminPhone,
        totalCalls: 0,
        accepted: 0,
        rejected: 0,
        waiting: 0,
        lastCallAt: log.createdAt ? log.createdAt.toISOString() : '',
      });
    }

    const stat = adminStatsMap.get(adminId)!;
    stat.totalCalls += 1;

    // details.callStatus is reliably written going forward; description-text matching
    // is only a fallback for older audit rows recorded before that field existed.
    // 'ACCEPTED' is a historical value (pre-pipeline) folded into the "accepted" bucket.
    const detailsStatus = (log.details as { callStatus?: string })?.callStatus;
    const status = detailsStatus ?? (
      CALL_STATUS_KEYWORDS.find((k) => log.description.includes(k)) ?? undefined
    );

    if (status === 'REJECTED') {
      stat.rejected += 1;
    } else if (status === 'WAITING') {
      stat.waiting += 1;
    } else if (status) {
      // ACCEPTED (legacy) + CALLED/REGISTERED/FIRST_LESSON/STARTED_STUDYING/MADE_PAYMENT
      stat.accepted += 1;
    }
  }

  const adminCallStats = Array.from(adminStatsMap.values());

  // 7. Recent calls with extracted callStatus
  const recentCalls = callAuditLogs.slice(0, 20).map((l) => {
    let callStatus: string | undefined = (l.details as { callStatus?: string })?.callStatus;
    if (!callStatus || callStatus === 'UNKNOWN') {
      callStatus = CALL_STATUS_KEYWORDS.find((k) => l.description.includes(k)) ?? 'WAITING';
    }

    return {
      id: l.id,
      adminId: l.actorUserId,
      adminName: l.actorName ?? 'Admin',
      description: l.description,
      callStatus,
      studentName: (l.details as { studentName?: string })?.studentName ?? "O'quvchi",
      createdAt: l.createdAt ? l.createdAt.toISOString() : '',
    };
  });

  // 8. Schools summary
  const schoolsSummary = allSchools.map((sch) => {
    const director = allUsers.find(
      (u) => u.schoolId === sch.id && u.roleName === 'DIRECTOR',
    );
    const teachersInSchool = allUsers.filter(
      (u) => u.schoolId === sch.id && u.roleName === 'TEACHER',
    );
    const studentsInSchool = allStudents.filter((s) => s.schoolId === sch.id);
    const studyingInSchool = studentsInSchool.filter((s) => s.studyStatus === 'ACTIVE').length;
    const schoolStudentIds = new Set(studentsInSchool.map((s) => s.id));
    const schoolRevenue = allPayments
      .filter((p) => schoolStudentIds.has(p.studentId))
      .reduce((sum, p) => sum + p.amountUzs, 0);

    return {
      id: sch.id,
      name: sch.name,
      schoolNumber: sch.schoolNumber,
      shortName: sch.shortName,
      directorName: director?.fullName ?? null,
      directorPhone: director?.phone ?? null,
      teacherCount: teachersInSchool.length,
      studentCount: studentsInSchool.length,
      studyingCount: studyingInSchool,
      revenueUzs: schoolRevenue,
      isActive: sch.isActive,
    };
  });

  // 9. Teachers summary
  const teacherUsers = allUsers.filter((u) => u.roleName === 'TEACHER');
  const teachersSummary = teacherUsers.map((t) => {
    const teacherStudents = allStudents.filter((s) => s.teacherId === t.id);
    const studyingCount = teacherStudents.filter((s) => s.studyStatus === 'ACTIVE').length;
    const teacherStudentIds = new Set(teacherStudents.map((s) => s.id));
    const paidCount = Array.from(paidStudentIds).filter((id) => teacherStudentIds.has(id)).length;
    const teacherComms = allCommissions.filter((c) => c.userId === t.id);
    const totalCommission = teacherComms.reduce((sum, c) => sum + c.amountUzs, 0);
    const paidCommission = teacherComms
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + c.amountUzs, 0);
    const pendingCommission = totalCommission - paidCommission;
    const school = allSchools.find((sch) => sch.id === t.schoolId);

    return {
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      schoolId: t.schoolId,
      schoolName: school?.name ?? null,
      schoolNumber: school?.schoolNumber ?? null,
      totalStudents: teacherStudents.length,
      studyingStudents: studyingCount,
      paidStudents: paidCount,
      totalCommissionUzs: totalCommission,
      pendingCommissionUzs: pendingCommission,
    };
  });

  res.json({
    overall,
    period,
    dailyTrends,
    adminCallStats,
    recentCalls,
    schoolsSummary,
    teachersSummary,
    // Backwards compatibility alias
    leads: overall,
  });
}));

// ── Director Analytics Summary ────────────────────────────────────────────────
analyticsRouter.get('/director-summary', requireRole('DIRECTOR'), asyncHandler(async (req, res) => {
  const user = req.user!;

  // 1. Get director's school
  let schoolId = user.schoolId;
  if (!schoolId) {
    const [dUser] = await db.select().from(users).where(eq(users.id, user.userId));
    schoolId = dUser?.schoolId ?? undefined;
  }

  let schoolInfo = null;
  if (schoolId) {
    const [sch] = await db.select().from(schools).where(eq(schools.id, schoolId));
    if (sch) {
      schoolInfo = {
        id: sch.id,
        name: sch.name,
        schoolNumber: sch.schoolNumber,
      };
    }
  }

  // 2. Fetch all teachers in this school
  const schoolTeachers = schoolId
    ? await db
        .select({
          id: users.id,
          fullName: users.fullName,
          phone: users.phone,
          meta: users.meta,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.schoolId, schoolId), eq(roles.name, 'TEACHER')))
    : [];

  // 3. Fetch all students belonging to this school
  const schoolStudents = schoolId
    ? await db
        .select({
          id: students.id,
          fullName: students.fullName,
          phone: students.phone,
          secondaryPhone: students.secondaryPhone,
          teacherId: students.teacherId,
          callStatus: students.callStatus,
          studyStatus: students.studyStatus,
          createdAt: students.createdAt,
        })
        .from(students)
        .where(eq(students.schoolId, schoolId))
        .orderBy(desc(students.createdAt))
    : [];

  // 4. Fetch director commissions
  const dirCommissions = await db
    .select()
    .from(commissions)
    .where(eq(commissions.userId, user.userId));

  const totalCommissionUzs = dirCommissions.reduce((s, c) => s + c.amountUzs, 0);
  const paidCommissionUzs = dirCommissions
    .filter((c) => c.status === 'PAID')
    .reduce((s, c) => s + c.amountUzs, 0);
  const pendingCommissionUzs = totalCommissionUzs - paidCommissionUzs;

  const { payoutsNetUzs, balanceUzs } = await getUserBalance(db, user.userId);

  // 5. Aggregate metrics
  const totalStudents = schoolStudents.length;
  const studyingStudents = schoolStudents.filter((s) => s.studyStatus === 'ACTIVE').length;
  const stoppedStudents = schoolStudents.filter((s) => s.studyStatus === 'NOACTIVE').length;
  const waitingLeads = schoolStudents.filter((s) => s.callStatus === 'WAITING').length;
  const rejectedLeads = schoolStudents.filter((s) => s.callStatus === 'REJECTED').length;
  const acceptedLeads = schoolStudents.filter((s) => s.callStatus !== 'WAITING' && s.callStatus !== 'REJECTED').length;

  const summary = {
    school: schoolInfo,
    totalTeachers: schoolTeachers.length,
    totalStudents,
    studyingStudents,
    stoppedStudents,
    waitingLeads,
    acceptedLeads,
    rejectedLeads,
    studyConversionPercent: totalStudents > 0 ? Math.round((studyingStudents / totalStudents) * 100) : 0,
    totalCommissionUzs,
    paidCommissionUzs,
    pendingCommissionUzs,
    payoutsNetUzs,
    balanceUzs,
  };

  // 6. 14-day daily student registrations in this school (starts from zero every day)
  const now = new Date();
  const dailyTrends = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = d.toLocaleDateString('sv');
    const dayName = d.toLocaleDateString('uz-UZ', { weekday: 'short' });
    const dayStudents = schoolStudents.filter((s) => {
      const cd = new Date(s.createdAt);
      return cd.toLocaleDateString('sv') === dateStr;
    });

    dailyTrends.push({
      date: dateStr,
      label: `${d.getDate()}-${d.toLocaleDateString('uz-UZ', { month: 'short' })} (${dayName})`,
      newStudents: dayStudents.length,
      studyingCount: dayStudents.filter((s) => s.studyStatus === 'ACTIVE').length,
    });
  }

  // 7. Teacher performance breakdown for director
  const teachersPerformance = schoolTeachers.map((t) => {
    const tStudents = schoolStudents.filter((s) => s.teacherId === t.id);
    const studying = tStudents.filter((s) => s.studyStatus === 'ACTIVE').length;
    const stopped = tStudents.filter((s) => s.studyStatus === 'NOACTIVE').length;
    return {
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      subject: (t.meta as { subject?: string })?.subject ?? '—',
      totalStudents: tStudents.length,
      studyingStudents: studying,
      stoppedStudents: stopped,
      conversionPercent: tStudents.length > 0 ? Math.round((studying / tStudents.length) * 100) : 0,
      students: tStudents,
    };
  });

  res.json({
    summary,
    dailyTrends,
    teachersPerformance,
    students: schoolStudents,
  });
}));

// ── Teacher Analytics Summary ─────────────────────────────────────────────────
analyticsRouter.get('/teacher-summary', requireRole('TEACHER'), asyncHandler(async (req, res) => {
  const user = req.user!;

  // 1. Get teacher's user & school info
  const [tUser] = await db.select().from(users).where(eq(users.id, user.userId));
  let schoolInfo = null;
  if (tUser?.schoolId) {
    const [sch] = await db.select().from(schools).where(eq(schools.id, tUser.schoolId));
    if (sch) {
      schoolInfo = {
        id: sch.id,
        name: sch.name,
        schoolNumber: sch.schoolNumber,
      };
    }
  }

  // 2. Fetch all students registered by this teacher
  const myStudents = await db
    .select({
      id: students.id,
      fullName: students.fullName,
      phone: students.phone,
      secondaryPhone: students.secondaryPhone,
      callStatus: students.callStatus,
      studyStatus: students.studyStatus,
      createdAt: students.createdAt,
    })
    .from(students)
    .where(eq(students.teacherId, user.userId))
    .orderBy(desc(students.createdAt));

  // 3. Fetch teacher commissions
  const teacherCommissions = await db
    .select()
    .from(commissions)
    .where(eq(commissions.userId, user.userId));

  const totalCommissionUzs = teacherCommissions.reduce((s, c) => s + c.amountUzs, 0);
  const paidCommissionUzs = teacherCommissions
    .filter((c) => c.status === 'PAID')
    .reduce((s, c) => s + c.amountUzs, 0);
  const pendingCommissionUzs = totalCommissionUzs - paidCommissionUzs;

  const { payoutsNetUzs, balanceUzs } = await getUserBalance(db, user.userId);

  // 4. Metrics
  const totalStudents = myStudents.length;
  const studyingStudents = myStudents.filter((s) => s.studyStatus === 'ACTIVE').length;
  const stoppedStudents = myStudents.filter((s) => s.studyStatus === 'NOACTIVE').length;
  const waitingLeads = myStudents.filter((s) => s.callStatus === 'WAITING').length;
  const rejectedLeads = myStudents.filter((s) => s.callStatus === 'REJECTED').length;
  const acceptedLeads = myStudents.filter((s) => s.callStatus !== 'WAITING' && s.callStatus !== 'REJECTED').length;

  const summary = {
    school: schoolInfo,
    subject: (tUser?.meta as { subject?: string })?.subject ?? '—',
    totalStudents,
    studyingStudents,
    stoppedStudents,
    waitingLeads,
    acceptedLeads,
    rejectedLeads,
    studyConversionPercent: totalStudents > 0 ? Math.round((studyingStudents / totalStudents) * 100) : 0,
    totalCommissionUzs,
    paidCommissionUzs,
    pendingCommissionUzs,
    payoutsNetUzs,
    balanceUzs,
  };

  // 5. 14-day daily student registrations by this teacher (starts from zero every day)
  const now = new Date();
  const dailyTrends = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = d.toLocaleDateString('sv');
    const dayName = d.toLocaleDateString('uz-UZ', { weekday: 'short' });
    const dayStudents = myStudents.filter((s) => {
      const cd = new Date(s.createdAt);
      return cd.toLocaleDateString('sv') === dateStr;
    });

    dailyTrends.push({
      date: dateStr,
      label: `${d.getDate()}-${d.toLocaleDateString('uz-UZ', { month: 'short' })} (${dayName})`,
      newStudents: dayStudents.length,
      studyingCount: dayStudents.filter((s) => s.studyStatus === 'ACTIVE').length,
    });
  }

  res.json({
    summary,
    dailyTrends,
    students: myStudents,
  });
}));
