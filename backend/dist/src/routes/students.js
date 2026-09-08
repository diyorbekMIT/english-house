"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = exports.studentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_js_1 = require("../../db/client.js");
const schema_js_1 = require("../../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const audit_js_1 = require("../middleware/audit.js");
const drizzle_orm_1 = require("drizzle-orm");
exports.studentsRouter = (0, express_1.Router)();
exports.studentsRouter.use(auth_js_1.authenticate);
const normalizePhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 9) {
        return `+998${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('998')) {
        return `+${digits}`;
    }
    const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};
exports.normalizePhone = normalizePhone;
const CreateStudentSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(5),
    secondaryPhone: zod_1.z.string().optional(),
    schoolId: zod_1.z.number().int().optional(),
    directorId: zod_1.z.number().int().optional(),
    teacherId: zod_1.z.number().int().optional(),
    callStatus: zod_1.z.enum(['WAITING', 'ACCEPTED', 'REJECTED']).optional().default('WAITING'),
    studyStatus: zod_1.z.enum(['STUDYING', 'STOPPED']).optional().default('STOPPED'),
    callNote: zod_1.z.string().max(500).optional(),
    meta: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.studentsRouter.post('/', (0, auth_js_1.requireRole)('TEACHER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const parsed = CreateStudentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const rawPhone = parsed.data.phone.trim();
    const normalizedPhone = (0, exports.normalizePhone)(rawPhone);
    const rawDigits = rawPhone.replace(/\D/g, '');
    // Check if student with this phone number already exists
    const checkConditions = [
        (0, drizzle_orm_1.eq)(schema_js_1.students.phone, normalizedPhone),
        (0, drizzle_orm_1.eq)(schema_js_1.students.phone, rawPhone),
    ];
    if (rawDigits.length >= 7) {
        checkConditions.push((0, drizzle_orm_1.like)(schema_js_1.students.phone, `%${rawDigits.slice(-9)}`));
    }
    const [existingStudent] = await client_js_1.db
        .select({
        id: schema_js_1.students.id,
        fullName: schema_js_1.students.fullName,
        phone: schema_js_1.students.phone,
        teacherId: schema_js_1.students.teacherId,
        schoolId: schema_js_1.students.schoolId,
    })
        .from(schema_js_1.students)
        .where((0, drizzle_orm_1.or)(...checkConditions))
        .limit(1);
    if (existingStudent) {
        let teacherInfo = '';
        if (existingStudent.teacherId) {
            const [tUser] = await client_js_1.db
                .select({ fullName: schema_js_1.users.fullName })
                .from(schema_js_1.users)
                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, existingStudent.teacherId));
            if (tUser)
                teacherInfo = ` (Ustoz: ${tUser.fullName})`;
        }
        let schoolInfo = '';
        if (existingStudent.schoolId) {
            const [sch] = await client_js_1.db
                .select({ name: schema_js_1.schools.name, schoolNumber: schema_js_1.schools.schoolNumber })
                .from(schema_js_1.schools)
                .where((0, drizzle_orm_1.eq)(schema_js_1.schools.id, existingStudent.schoolId));
            if (sch)
                schoolInfo = ` [№ ${sch.schoolNumber} — ${sch.name}]`;
        }
        res.status(409).json({
            error: `Ushbu telefon raqamli o'quvchi (${existingStudent.phone}) tizimda allaqachon mavjud! '${existingStudent.fullName}'${teacherInfo}${schoolInfo}. Takroriy ma'lumot kiritish taqiqlanadi.`,
            existingStudent: {
                id: existingStudent.id,
                fullName: existingStudent.fullName,
                phone: existingStudent.phone,
            },
        });
        return;
    }
    const user = req.user;
    const teacherId = user.role === 'TEACHER' ? user.userId : (parsed.data.teacherId ?? undefined);
    let schoolId = parsed.data.schoolId;
    // Automatically link student to teacher's school
    if (user.role === 'TEACHER') {
        if (!schoolId && user.schoolId) {
            schoolId = user.schoolId;
        }
        if (!schoolId) {
            const [tUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.userId));
            if (tUser?.schoolId)
                schoolId = tUser.schoolId;
        }
    }
    else if (teacherId && !schoolId) {
        const [tUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, teacherId));
        if (tUser?.schoolId)
            schoolId = tUser.schoolId;
    }
    // Dynamic director assignment based on the school's active director
    let directorId = parsed.data.directorId;
    if (schoolId && !directorId) {
        const [activeDir] = await client_js_1.db
            .select({ id: schema_js_1.users.id })
            .from(schema_js_1.users)
            .innerJoin(schema_js_1.roles, (0, drizzle_orm_1.eq)(schema_js_1.users.roleId, schema_js_1.roles.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.users.schoolId, schoolId), (0, drizzle_orm_1.eq)(schema_js_1.roles.name, 'DIRECTOR'), (0, drizzle_orm_1.eq)(schema_js_1.users.isActive, true)))
            .limit(1);
        if (activeDir)
            directorId = activeDir.id;
    }
    const normalizedSecondaryPhone = parsed.data.secondaryPhone?.trim()
        ? (0, exports.normalizePhone)(parsed.data.secondaryPhone.trim())
        : null;
    try {
        const [student] = await client_js_1.db
            .insert(schema_js_1.students)
            .values({
            fullName: parsed.data.fullName.trim(),
            phone: normalizedPhone,
            secondaryPhone: normalizedSecondaryPhone,
            schoolId,
            directorId,
            teacherId,
            callStatus: parsed.data.callStatus,
            studyStatus: parsed.data.studyStatus,
            callNote: parsed.data.callNote ?? null,
            meta: parsed.data.meta ?? null,
        })
            .returning();
        await (0, audit_js_1.logAudit)(client_js_1.db, {
            actorUserId: user.userId,
            action: 'STUDENT_CREATE',
            entityType: 'student',
            entityId: student.id,
            description: `Student '${student.fullName}' (${normalizedPhone}) created by ${user.role}`,
        });
        res.status(201).json(student);
    }
    catch (err) {
        if (err?.code === '23505') {
            res.status(409).json({
                error: `Ushbu telefon raqamli o'quvchi (${normalizedPhone}) tizimda allaqachon mavjud! Takroriy o'quvchi kiritish taqiqlanadi.`,
            });
            return;
        }
        throw err;
    }
});
exports.studentsRouter.get('/', (0, auth_js_1.requireRole)('TEACHER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const user = req.user;
    const { callStatus, studyStatus, schoolId, teacherId } = req.query;
    const conditions = [];
    if (user.role === 'TEACHER') {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.students.teacherId, user.userId));
    }
    // DIRECTOR sees all students belonging to their school (not bound to personal directorId!)
    if (user.role === 'DIRECTOR') {
        let dirSchoolId = user.schoolId;
        if (!dirSchoolId) {
            const [dirUser] = await client_js_1.db.select().from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.userId));
            dirSchoolId = dirUser?.schoolId ?? undefined;
        }
        if (dirSchoolId) {
            conditions.push((0, drizzle_orm_1.eq)(schema_js_1.students.schoolId, dirSchoolId));
        }
    }
    if (callStatus)
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.students.callStatus, String(callStatus)));
    if (studyStatus)
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.students.studyStatus, String(studyStatus)));
    if (schoolId)
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.students.schoolId, Number(schoolId)));
    if (teacherId)
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.students.teacherId, Number(teacherId)));
    const rows = await client_js_1.db
        .select({
        id: schema_js_1.students.id,
        fullName: schema_js_1.students.fullName,
        phone: schema_js_1.students.phone,
        secondaryPhone: schema_js_1.students.secondaryPhone,
        schoolId: schema_js_1.students.schoolId,
        directorId: schema_js_1.students.directorId,
        teacherId: schema_js_1.students.teacherId,
        callStatus: schema_js_1.students.callStatus,
        studyStatus: schema_js_1.students.studyStatus,
        callNote: schema_js_1.students.callNote,
        meta: schema_js_1.students.meta,
        createdAt: schema_js_1.students.createdAt,
        updatedAt: schema_js_1.students.updatedAt,
        schoolName: schema_js_1.schools.name,
        schoolNumber: schema_js_1.schools.schoolNumber,
        teacherName: schema_js_1.users.fullName,
        teacherPhone: schema_js_1.users.phone,
    })
        .from(schema_js_1.students)
        .leftJoin(schema_js_1.schools, (0, drizzle_orm_1.eq)(schema_js_1.students.schoolId, schema_js_1.schools.id))
        .leftJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.students.teacherId, schema_js_1.users.id))
        .where(conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.students.createdAt));
    res.json(rows);
});
exports.studentsRouter.get('/:id', (0, auth_js_1.requireRole)('TEACHER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const id = Number(req.params['id']);
    const [student] = await client_js_1.db
        .select({
        id: schema_js_1.students.id,
        fullName: schema_js_1.students.fullName,
        phone: schema_js_1.students.phone,
        secondaryPhone: schema_js_1.students.secondaryPhone,
        schoolId: schema_js_1.students.schoolId,
        directorId: schema_js_1.students.directorId,
        teacherId: schema_js_1.students.teacherId,
        callStatus: schema_js_1.students.callStatus,
        studyStatus: schema_js_1.students.studyStatus,
        callNote: schema_js_1.students.callNote,
        meta: schema_js_1.students.meta,
        createdAt: schema_js_1.students.createdAt,
        updatedAt: schema_js_1.students.updatedAt,
        schoolName: schema_js_1.schools.name,
        schoolNumber: schema_js_1.schools.schoolNumber,
        teacherName: schema_js_1.users.fullName,
        teacherPhone: schema_js_1.users.phone,
    })
        .from(schema_js_1.students)
        .leftJoin(schema_js_1.schools, (0, drizzle_orm_1.eq)(schema_js_1.students.schoolId, schema_js_1.schools.id))
        .leftJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.students.teacherId, schema_js_1.users.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.students.id, id));
    if (!student) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(student);
});
exports.studentsRouter.patch('/:id/call-status', (0, auth_js_1.requireRole)('ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const id = Number(req.params['id']);
    const schema = zod_1.z.object({
        callStatus: zod_1.z.enum(['WAITING', 'ACCEPTED', 'REJECTED']),
        callNote: zod_1.z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const updateData = {
        callStatus: parsed.data.callStatus,
        updatedAt: new Date(),
    };
    // Always write callNote (even if empty string, to clear previous note)
    if (parsed.data.callNote !== undefined) {
        updateData.callNote = parsed.data.callNote || null;
    }
    const [student] = await client_js_1.db
        .update(schema_js_1.students)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema_js_1.students.id, id))
        .returning();
    if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
    }
    const noteText = parsed.data.callNote ? ` | Izoh: "${parsed.data.callNote}"` : '';
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'STUDENT_CALL_STATUS_UPDATE',
        entityType: 'student',
        entityId: id,
        description: `Student '${student.fullName}' call_status changed to ${parsed.data.callStatus} by ${req.user.fullName || req.user.role}${noteText}`,
        details: {
            studentId: id,
            studentName: student.fullName,
            callStatus: parsed.data.callStatus,
            callNote: parsed.data.callNote || null,
            adminId: req.user.userId,
            adminName: req.user.fullName,
        },
    });
    res.json(student);
});
exports.studentsRouter.patch('/:id/study-status', (0, auth_js_1.requireRole)('ADMIN', 'DIRECTOR', 'TEACHER', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
    const id = Number(req.params['id']);
    const schema = zod_1.z.object({ studyStatus: zod_1.z.enum(['STUDYING', 'STOPPED']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    const [student] = await client_js_1.db
        .update(schema_js_1.students)
        .set({ studyStatus: parsed.data.studyStatus, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.students.id, id))
        .returning();
    if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
    }
    await (0, audit_js_1.logAudit)(client_js_1.db, {
        actorUserId: req.user.userId,
        action: 'STUDENT_STUDY_STATUS_UPDATE',
        entityType: 'student',
        entityId: id,
        description: `Student '${student.fullName}' study_status changed to ${parsed.data.studyStatus}`,
    });
    res.json(student);
});
