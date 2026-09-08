"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = require("express");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.analyticsRouter = (0, express_1.Router)();
exports.analyticsRouter.use(auth_js_1.authenticate);
// CEO / SuperAdmin analytics endpoint with date range filter support
exports.analyticsRouter.get('/ceo-summary', (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const { startDate, endDate } = req.query;
    // 1. All data from DB
    const allStudents = await client_js_1.db.select().from(schema_js_1.students);
    const allPayments = await client_js_1.db.select().from(schema_js_1.monthlyPayments);
    const allSchools = await client_js_1.db.select().from(schema_js_1.schools);
    const allCommissions = await client_js_1.db.select().from(schema_js_1.commissions);
    const allUsers = await client_js_1.db
        .select({
        id: schema_js_1.users.id,
        fullName: schema_js_1.users.fullName,
        phone: schema_js_1.users.phone,
        roleId: schema_js_1.users.roleId,
        roleName: schema_js_1.roles.name,
        schoolId: schema_js_1.users.schoolId,
        directorId: schema_js_1.users.directorId,
    })
        .from(schema_js_1.users)
        .innerJoin(schema_js_1.roles, (0, drizzle_orm_1.eq)(schema_js_1.users.roleId, schema_js_1.roles.id));
    const callAuditLogs = await client_js_1.db
        .select({
        id: schema_js_1.auditLogs.id,
        actorUserId: schema_js_1.auditLogs.actorUserId,
        actorName: schema_js_1.users.fullName,
        actorPhone: schema_js_1.users.phone,
        description: schema_js_1.auditLogs.description,
        details: schema_js_1.auditLogs.details,
        createdAt: schema_js_1.auditLogs.createdAt,
    })
        .from(schema_js_1.auditLogs)
        .leftJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.auditLogs.actorUserId, schema_js_1.users.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.auditLogs.action, 'STUDENT_CALL_STATUS_UPDATE'))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.auditLogs.createdAt));
    // 2. Lifetime / Overall metrics ("left overall data above")
    const totalLeads = allStudents.length;
    const totalRevenueUzs = allPayments.reduce((acc, p) => acc + p.amountUzs, 0);
    const paidStudentIds = new Set(allPayments.map((p) => p.studentId));
    const paidStudentsCount = paidStudentIds.size;
    const unpaidStudentsCount = Math.max(0, totalLeads - paidStudentsCount);
    const studyingStudents = allStudents.filter((s) => s.studyStatus === 'STUDYING').length;
    const stoppedStudents = allStudents.filter((s) => s.studyStatus === 'STOPPED').length;
    const waitingLeads = allStudents.filter((s) => s.callStatus === 'WAITING').length;
    const acceptedLeads = allStudents.filter((s) => s.callStatus === 'ACCEPTED').length;
    const rejectedLeads = allStudents.filter((s) => s.callStatus === 'REJECTED').length;
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
        paidStudentsCount,
        unpaidStudentsCount,
        totalRevenueUzs,
        conversionRatePercent: totalLeads > 0 ? Math.round((paidStudentsCount / totalLeads) * 100) : 0,
    };
    // 3. Date Range Parsing for Filtered Period (using local calendar)
    const now = new Date();
    let start;
    let end;
    const toLocalDateString = (date) => date.toLocaleDateString('sv');
    if (startDate && typeof startDate === 'string' && startDate.trim()) {
        start = new Date(`${startDate}T00:00:00`);
    }
    else {
        // Default to last 14 days
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
    }
    if (endDate && typeof endDate === 'string' && endDate.trim()) {
        end = new Date(`${endDate}T23:59:59.999`);
    }
    else {
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
        acceptedCount: periodStudents.filter((s) => s.callStatus === 'ACCEPTED').length,
        rejectedCount: periodStudents.filter((s) => s.callStatus === 'REJECTED').length,
        callsMadeCount: periodCalls.length,
        paidStudentsCount: periodPaidCount,
        revenueUzs: periodRevenueUzs,
        conversionRatePercent: periodStudents.length > 0 ? Math.round((periodPaidCount / periodStudents.length) * 100) : 0,
    };
    // 5. Daily Trends — EVERY DAY STARTS FROM ZERO!
    const UZ_MONTH_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const dailyTrends = [];
    // If date range is longer than 31 days, show the latest 31 days up to endDate in the daily chart
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const trendStart = totalDays > 31
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
    const adminStatsMap = new Map();
    for (const log of periodCalls) {
        const adminId = log.actorUserId ?? 0;
        if (!adminId)
            continue;
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
        const stat = adminStatsMap.get(adminId);
        stat.totalCalls += 1;
        const detailsStatus = log.details?.callStatus;
        if (detailsStatus === 'ACCEPTED' || log.description.includes('ACCEPTED')) {
            stat.accepted += 1;
        }
        else if (detailsStatus === 'REJECTED' || log.description.includes('REJECTED')) {
            stat.rejected += 1;
        }
        else if (detailsStatus === 'WAITING' || log.description.includes('WAITING')) {
            stat.waiting += 1;
        }
    }
    const adminCallStats = Array.from(adminStatsMap.values());
    // 7. Recent calls with extracted callStatus
    const recentCalls = callAuditLogs.slice(0, 20).map((l) => {
        let callStatus = l.details?.callStatus;
        if (!callStatus || callStatus === 'UNKNOWN') {
            if (l.description.includes('ACCEPTED'))
                callStatus = 'ACCEPTED';
            else if (l.description.includes('REJECTED'))
                callStatus = 'REJECTED';
            else if (l.description.includes('WAITING'))
                callStatus = 'WAITING';
            else
                callStatus = 'ACCEPTED';
        }
        return {
            id: l.id,
            adminId: l.actorUserId,
            adminName: l.actorName ?? 'Admin',
            description: l.description,
            callStatus,
            studentName: l.details?.studentName ?? "O'quvchi",
            createdAt: l.createdAt ? l.createdAt.toISOString() : '',
        };
    });
    // 8. Schools summary
    const schoolsSummary = allSchools.map((sch) => {
        const director = allUsers.find((u) => u.schoolId === sch.id && u.roleName === 'DIRECTOR');
        const teachersInSchool = allUsers.filter((u) => u.schoolId === sch.id && u.roleName === 'TEACHER');
        const studentsInSchool = allStudents.filter((s) => s.schoolId === sch.id);
        const studyingInSchool = studentsInSchool.filter((s) => s.studyStatus === 'STUDYING').length;
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
        const studyingCount = teacherStudents.filter((s) => s.studyStatus === 'STUDYING').length;
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
});
// ── Director Analytics Summary ────────────────────────────────────────────────
exports.analyticsRouter.get('/director-summary', (0, auth_js_1.requireRole)('DIRECTOR'), async (req, res) => {
    const user = req.user;
    // 1. Get director's school
    let schoolId = user.schoolId;
    if (!schoolId) {
        const [dUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.userId));
        schoolId = dUser?.schoolId ?? undefined;
    }
    let schoolInfo = null;
    if (schoolId) {
        const [sch] = await client_js_1.db.select().from(schema_js_1.schools).where((0, drizzle_orm_1.eq)(schema_js_1.schools.id, schoolId));
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
        ? await client_js_1.db
            .select({
            id: schema_js_1.users.id,
            fullName: schema_js_1.users.fullName,
            phone: schema_js_1.users.phone,
            meta: schema_js_1.users.meta,
            isActive: schema_js_1.users.isActive,
            createdAt: schema_js_1.users.createdAt,
        })
            .from(schema_js_1.users)
            .innerJoin(schema_js_1.roles, (0, drizzle_orm_1.eq)(schema_js_1.users.roleId, schema_js_1.roles.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.schoolId, schoolId), (0, drizzle_orm_1.eq)(schema_js_1.roles.name, 'TEACHER')))
        : [];
    // 3. Fetch all students belonging to this school
    const schoolStudents = schoolId
        ? await client_js_1.db
            .select({
            id: schema_js_1.students.id,
            fullName: schema_js_1.students.fullName,
            phone: schema_js_1.students.phone,
            secondaryPhone: schema_js_1.students.secondaryPhone,
            teacherId: schema_js_1.students.teacherId,
            callStatus: schema_js_1.students.callStatus,
            studyStatus: schema_js_1.students.studyStatus,
            createdAt: schema_js_1.students.createdAt,
        })
            .from(schema_js_1.students)
            .where((0, drizzle_orm_1.eq)(schema_js_1.students.schoolId, schoolId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.students.createdAt))
        : [];
    // 4. Fetch director commissions
    const dirCommissions = await client_js_1.db
        .select()
        .from(schema_js_1.commissions)
        .where((0, drizzle_orm_1.eq)(schema_js_1.commissions.userId, user.userId));
    const totalCommissionUzs = dirCommissions.reduce((s, c) => s + c.amountUzs, 0);
    const paidCommissionUzs = dirCommissions
        .filter((c) => c.status === 'PAID')
        .reduce((s, c) => s + c.amountUzs, 0);
    const pendingCommissionUzs = totalCommissionUzs - paidCommissionUzs;
    // 5. Aggregate metrics
    const totalStudents = schoolStudents.length;
    const studyingStudents = schoolStudents.filter((s) => s.studyStatus === 'STUDYING').length;
    const stoppedStudents = schoolStudents.filter((s) => s.studyStatus === 'STOPPED').length;
    const waitingLeads = schoolStudents.filter((s) => s.callStatus === 'WAITING').length;
    const acceptedLeads = schoolStudents.filter((s) => s.callStatus === 'ACCEPTED').length;
    const rejectedLeads = schoolStudents.filter((s) => s.callStatus === 'REJECTED').length;
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
            studyingCount: dayStudents.filter((s) => s.studyStatus === 'STUDYING').length,
        });
    }
    // 7. Teacher performance breakdown for director
    const teachersPerformance = schoolTeachers.map((t) => {
        const tStudents = schoolStudents.filter((s) => s.teacherId === t.id);
        const studying = tStudents.filter((s) => s.studyStatus === 'STUDYING').length;
        const stopped = tStudents.filter((s) => s.studyStatus === 'STOPPED').length;
        return {
            id: t.id,
            fullName: t.fullName,
            phone: t.phone,
            subject: t.meta?.subject ?? '—',
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
});
// ── Teacher Analytics Summary ─────────────────────────────────────────────────
exports.analyticsRouter.get('/teacher-summary', (0, auth_js_1.requireRole)('TEACHER'), async (req, res) => {
    const user = req.user;
    // 1. Get teacher's user & school info
    const [tUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.userId));
    let schoolInfo = null;
    if (tUser?.schoolId) {
        const [sch] = await client_js_1.db.select().from(schema_js_1.schools).where((0, drizzle_orm_1.eq)(schema_js_1.schools.id, tUser.schoolId));
        if (sch) {
            schoolInfo = {
                id: sch.id,
                name: sch.name,
                schoolNumber: sch.schoolNumber,
            };
        }
    }
    // 2. Fetch all students registered by this teacher
    const myStudents = await client_js_1.db
        .select({
        id: schema_js_1.students.id,
        fullName: schema_js_1.students.fullName,
        phone: schema_js_1.students.phone,
        secondaryPhone: schema_js_1.students.secondaryPhone,
        callStatus: schema_js_1.students.callStatus,
        studyStatus: schema_js_1.students.studyStatus,
        createdAt: schema_js_1.students.createdAt,
    })
        .from(schema_js_1.students)
        .where((0, drizzle_orm_1.eq)(schema_js_1.students.teacherId, user.userId))
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.students.createdAt));
    // 3. Fetch teacher commissions
    const teacherCommissions = await client_js_1.db
        .select()
        .from(schema_js_1.commissions)
        .where((0, drizzle_orm_1.eq)(schema_js_1.commissions.userId, user.userId));
    const totalCommissionUzs = teacherCommissions.reduce((s, c) => s + c.amountUzs, 0);
    const paidCommissionUzs = teacherCommissions
        .filter((c) => c.status === 'PAID')
        .reduce((s, c) => s + c.amountUzs, 0);
    const pendingCommissionUzs = totalCommissionUzs - paidCommissionUzs;
    // 4. Metrics
    const totalStudents = myStudents.length;
    const studyingStudents = myStudents.filter((s) => s.studyStatus === 'STUDYING').length;
    const stoppedStudents = myStudents.filter((s) => s.studyStatus === 'STOPPED').length;
    const waitingLeads = myStudents.filter((s) => s.callStatus === 'WAITING').length;
    const acceptedLeads = myStudents.filter((s) => s.callStatus === 'ACCEPTED').length;
    const rejectedLeads = myStudents.filter((s) => s.callStatus === 'REJECTED').length;
    const summary = {
        school: schoolInfo,
        subject: tUser?.meta?.subject ?? '—',
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
            studyingCount: dayStudents.filter((s) => s.studyStatus === 'STUDYING').length,
        });
    }
    res.json({
        summary,
        dailyTrends,
        students: myStudents,
    });
});
