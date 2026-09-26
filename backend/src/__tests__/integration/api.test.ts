import { describe, it, expect, beforeAll } from 'vitest';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { users, roles, students, monthlyPayments, commissions, withdrawRequests } from '../../../db/schema.js';
import { api, bearer, login, makeUser, makeSchool, makeStudent, makeCeo, setRules, addPendingCommission, uniquePhone, PASSWORD, type TestUser } from './helpers.js';

let ceo: TestUser;

beforeAll(async () => {
  ceo = await makeCeo();
  await setRules(ceo.token);
});

describe('authentication', () => {
  it('logs in and issues a token that carries only the user id', async () => {
    const t = await makeUser('TEACHER');
    const payload = JSON.parse(Buffer.from(t.token.split('.')[1]!, 'base64url').toString());
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'userId']);
    expect(payload.userId).toBe(t.id);
  });

  it('rejects a wrong password and a missing/garbage/forged token', async () => {
    const t = await makeUser('TEACHER');
    expect((await api().post('/auth/login').send({ phone: t.phone, password: 'wrong-password-1' })).status).toBe(401);
    expect((await api().get('/students')).status).toBe(401);
    expect((await api().get('/students').set(bearer('abc.def.ghi'))).status).toBe(401);

    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: ceo.id })}.`;
    expect((await api().get('/commission-rules').set(bearer(forged))).status).toBe(401);
  });

  it('takes effect immediately when a user is deactivated', async () => {
    const t = await makeUser('TEACHER');
    expect((await api().get('/withdrawals/eligibility').set(bearer(t.token))).status).toBe(200);
    await db.update(users).set({ isActive: false }).where(eq(users.id, t.id));
    expect((await api().get('/withdrawals/eligibility').set(bearer(t.token))).status).toBe(401);
    await db.update(users).set({ isActive: true }).where(eq(users.id, t.id));
    expect((await api().get('/withdrawals/eligibility').set(bearer(t.token))).status).toBe(200);
  });

  it('takes effect immediately when a user changes role', async () => {
    const t = await makeUser('TEACHER');
    const [smRole] = await db.select().from(roles).where(eq(roles.name, 'SALES_MANAGER'));
    await db.update(users).set({ roleId: smRole!.id }).where(eq(users.id, t.id));
    // /withdrawals/eligibility is teacher/director-only
    expect((await api().get('/withdrawals/eligibility').set(bearer(t.token))).status).toBe(403);
  });

  it('rate-limits repeated failed logins for one account after 8 tries', async () => {
    const phone = uniquePhone();
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) {
      statuses.push((await api().post('/auth/login').send({ phone, password: 'wrong-password-1' })).status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses[8]).toBe(429);
  });

  it('writes login attempts to the audit log', async () => {
    const t = await makeUser('TEACHER');
    await api().post('/auth/login').send({ phone: t.phone, password: 'wrong-password-1' });
    const rows = await db.execute(sql`SELECT action FROM audit_logs WHERE action IN ('LOGIN_SUCCESS','LOGIN_FAILED') AND entity_id = ${t.id}`);
    const actions = rows.rows.map((r) => r['action']);
    expect(actions).toContain('LOGIN_SUCCESS');
    expect(actions).toContain('LOGIN_FAILED');
  });
});

describe('audit log', () => {
  it('cannot be edited or deleted, even directly in SQL', async () => {
    // drizzle wraps driver errors; the trigger's message is on the underlying cause
    const causeOf = async (q: Promise<unknown>) => ((await q.then(() => null, (e) => e)) as { cause?: { message?: string } } | null)?.cause?.message ?? '';
    expect(await causeOf(db.execute(sql`UPDATE audit_logs SET description = 'tampered'`))).toMatch(/append-only/);
    expect(await causeOf(db.execute(sql`DELETE FROM audit_logs`))).toMatch(/append-only/);
  });
});

describe('access scoping', () => {
  let schoolA: number, schoolB: number;
  let directorA: TestUser, directorB: TestUser, teacherA: TestUser, teacherB: TestUser;
  let studentA: number, studentB: number;

  beforeAll(async () => {
    schoolA = await makeSchool('A');
    schoolB = await makeSchool('B');
    directorA = await makeUser('DIRECTOR', { schoolId: schoolA });
    directorB = await makeUser('DIRECTOR', { schoolId: schoolB });
    teacherA = await makeUser('TEACHER', { schoolId: schoolA });
    teacherB = await makeUser('TEACHER', { schoolId: schoolB });
    studentA = await makeStudent({ teacherId: teacherA.id, schoolId: schoolA, directorId: directorA.id });
    studentB = await makeStudent({ teacherId: teacherB.id, schoolId: schoolB, directorId: directorB.id });
  });

  it('a teacher only sees their own students', async () => {
    expect((await api().get(`/students/${studentA}`).set(bearer(teacherA.token))).status).toBe(200);
    expect((await api().get(`/students/${studentB}`).set(bearer(teacherA.token))).status).toBe(404);
    const list = await api().get('/students').set(bearer(teacherA.token));
    expect(list.body.map((s: { id: number }) => s.id)).toEqual([studentA]);
  });

  it('a director only sees their own school', async () => {
    expect((await api().get(`/students/${studentA}`).set(bearer(directorA.token))).status).toBe(200);
    expect((await api().get(`/students/${studentB}`).set(bearer(directorA.token))).status).toBe(404);
    expect((await api().get(`/users/${teacherB.id}`).set(bearer(directorA.token))).status).toBe(404);
    expect((await api().get(`/users/${teacherA.id}`).set(bearer(directorA.token))).status).toBe(200);
  });

  it('a director with no school sees nothing and can create nothing', async () => {
    const orphan = await makeUser('DIRECTOR');
    const list = await api().get('/students').set(bearer(orphan.token));
    expect(list.body).toEqual([]);
    const create = await api()
      .post('/users/teacher')
      .set(bearer(orphan.token))
      .send({ fullName: 'x', phone: uniquePhone(), password: PASSWORD, schoolId: schoolA });
    expect(create.status).toBe(403);
  });

  it('nobody but the CEO can see the CEO account', async () => {
    expect((await api().get(`/users/${ceo.id}`).set(bearer(directorA.token))).status).toBe(404);
    const sm = await makeUser('SALES_MANAGER');
    const list = await api().get('/users').set(bearer(sm.token));
    expect(list.body.some((u: { role: string }) => u.role === 'SUPER_ADMIN')).toBe(false);
  });

  it('student attribution comes from the caller, not the request body', async () => {
    const res = await api()
      .post('/students')
      .set(bearer(teacherA.token))
      .send({ fullName: 'Attribution', phone: uniquePhone(), schoolId: schoolB, teacherId: teacherB.id, directorId: directorB.id });
    expect(res.status).toBe(201);
    expect(res.body.schoolId).toBe(schoolA);
    expect(res.body.teacherId).toBe(teacherA.id);
    expect(res.body.directorId).toBe(directorA.id);
  });

  it('a director cannot assign a student to a teacher of another school', async () => {
    const res = await api()
      .post('/students')
      .set(bearer(directorA.token))
      .send({ fullName: 'Cross', phone: uniquePhone(), teacherId: teacherB.id });
    expect(res.status).toBe(403);
  });

  it('a duplicate phone does not leak another school\'s student to an outsider', async () => {
    const phone = uniquePhone();
    await makeStudent({ fullName: 'Secret Name', phone, teacherId: teacherB.id, schoolId: schoolB });
    const outsider = await api().post('/students').set(bearer(teacherA.token)).send({ fullName: 'dup', phone });
    expect(outsider.status).toBe(409);
    expect(JSON.stringify(outsider.body)).not.toContain('Secret Name');
    const staff = await makeUser('SALES_MANAGER');
    const insider = await api().post('/students').set(bearer(staff.token)).send({ fullName: 'dup', phone });
    expect(insider.status).toBe(409);
    expect(JSON.stringify(insider.body)).toContain('Secret Name');
  });

  it('only the CEO can read the commission rules', async () => {
    expect((await api().get('/commission-rules').set(bearer(teacherA.token))).status).toBe(403);
    expect((await api().get('/commission-rules').set(bearer(directorA.token))).status).toBe(403);
    expect((await api().get('/commission-rules').set(bearer(ceo.token))).status).toBe(200);
  });
});

describe('payments and commissions', () => {
  let school: number, director: TestUser, teacher: TestUser, salesManager: TestUser, admin: TestUser;

  const newStudent = () => makeStudent({ teacherId: teacher.id, schoolId: school, directorId: director.id });
  const pay = (studentId: number, token: string, body: object = { amountUzs: 500_000, paidForMonth: '2026-09' }) =>
    api().post(`/students/${studentId}/monthly-payments`).set(bearer(token)).send(body);

  beforeAll(async () => {
    school = await makeSchool('Pay school');
    director = await makeUser('DIRECTOR', { schoolId: school });
    teacher = await makeUser('TEACHER', { schoolId: school });
    salesManager = await makeUser('SALES_MANAGER');
    admin = await makeUser('ADMIN');
    await setRules(ceo.token, { specialPriceUzs: 1_000_000 });
  });

  it('first payment earns the big rate on the special price, later ones the small rate', async () => {
    const s = await newStudent();
    expect((await pay(s, salesManager.token)).status).toBe(201);
    expect((await pay(s, admin.token, { amountUzs: 400_000, paidForMonth: '2026-10' })).status).toBe(201);
    const rows = await db.select().from(commissions).where(eq(commissions.studentId, s));
    const amounts = (type: string, userId: number) => rows.filter((c) => c.type === type && c.userId === userId).map((c) => c.amountUzs);
    expect(amounts('SIGNUP_BONUS', teacher.id)).toEqual([200_000]); // 20% of 1,000,000
    expect(amounts('SIGNUP_BONUS', director.id)).toEqual([100_000]); // 10%
    expect(amounts('MONTHLY_COMMISSION', teacher.id)).toEqual([100_000]); // 10%
    expect(amounts('MONTHLY_COMMISSION', director.id)).toEqual([50_000]); // 5%
    const [st] = await db.select().from(students).where(eq(students.id, s));
    expect(st!.studyStatus).toBe('ACTIVE');
    expect(st!.callStatus).toBe('MADE_PAYMENT');
  });

  it('five concurrent first-payment submits create exactly one first payment and one bonus set', async () => {
    const s = await newStudent();
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(s, salesManager.token)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const payments = await db.select().from(monthlyPayments).where(eq(monthlyPayments.studentId, s));
    expect(payments).toHaveLength(5);
    expect(payments.filter((p) => p.isFirstPayment)).toHaveLength(1);
    const bonuses = await db.select().from(commissions).where(and(eq(commissions.studentId, s), eq(commissions.type, 'SIGNUP_BONUS')));
    expect(bonuses).toHaveLength(2); // teacher + director, once
  });

  it('enforces who may record payments and what a payment may look like', async () => {
    const s = await newStudent();
    expect((await pay(s, director.token)).status).toBe(403); // directors don't record payments
    expect((await pay(s, admin.token)).status).toBe(403); // admin can't take the FIRST payment
    expect((await pay(s, salesManager.token, { amountUzs: 500_000, paidForMonth: '2026-13' })).status).toBe(400);
    expect((await pay(s, salesManager.token, { amountUzs: 3_000_000_000, paidForMonth: '2026-09' })).status).toBe(400);
    expect((await pay(s, salesManager.token, { amountUzs: 1_000_001, paidForMonth: '2026-09' })).status).toBe(400); // above the special price
    expect((await pay(s, salesManager.token, { amountUzs: 1_000_000, paidForMonth: '2026-09' })).status).toBe(201); // exactly at the cap
  });

  it('only the CEO can mark a commission paid or void a payment', async () => {
    const s = await newStudent();
    const first = (await pay(s, salesManager.token)).body;
    const [c] = await db.select().from(commissions).where(eq(commissions.studentId, s));
    expect((await api().patch(`/commissions/${c!.id}/mark-paid`).set(bearer(salesManager.token))).status).toBe(403);
    expect((await api().patch(`/students/${s}/monthly-payments/${first.id}/void`).set(bearer(salesManager.token)).send({ reason: 'x' })).status).toBe(403);
    expect((await api().patch(`/commissions/${c!.id}/mark-paid`).set(bearer(ceo.token))).status).toBe(200);
  });

  it('voiding a payment cancels its commissions and needs a reason', async () => {
    const s = await newStudent();
    await pay(s, salesManager.token);
    const later = (await pay(s, admin.token, { amountUzs: 300_000, paidForMonth: '2026-10' })).body;

    const noReason = await api().patch(`/students/${s}/monthly-payments/${later.id}/void`).set(bearer(ceo.token)).send({});
    expect(noReason.status).toBe(400);

    const ok = await api().patch(`/students/${s}/monthly-payments/${later.id}/void`).set(bearer(ceo.token)).send({ reason: 'double entry' });
    expect(ok.status).toBe(200);
    expect(ok.body.cancelledCommissions).toBe(2);
    const cancelled = await db.select().from(commissions).where(and(eq(commissions.monthlyPaymentId, later.id), eq(commissions.status, 'CANCELLED')));
    expect(cancelled).toHaveLength(2);
    expect((await api().patch(`/students/${s}/monthly-payments/${later.id}/void`).set(bearer(ceo.token)).send({ reason: 'again' })).status).toBe(409);

    // cancelled money is not in the teacher's balance
    const bal = await api().get(`/payouts/balance/${teacher.id}`).set(bearer(ceo.token));
    expect(bal.body.commissionTotalUzs).toBeGreaterThan(0);
    const all = await db.select().from(commissions).where(eq(commissions.userId, teacher.id));
    const expected = all.filter((c) => c.status !== 'CANCELLED').reduce((a, c) => a + c.amountUzs, 0);
    expect(bal.body.commissionTotalUzs).toBe(expected);
  });

  it('a first payment can only be voided last, and then the student can be re-paid as "first"', async () => {
    const s = await newStudent();
    const first = (await pay(s, salesManager.token)).body;
    const later = (await pay(s, admin.token, { amountUzs: 300_000, paidForMonth: '2026-10' })).body;

    const blocked = await api().patch(`/students/${s}/monthly-payments/${first.id}/void`).set(bearer(ceo.token)).send({ reason: 'x' });
    expect(blocked.status).toBe(409);

    await api().patch(`/students/${s}/monthly-payments/${later.id}/void`).set(bearer(ceo.token)).send({ reason: 'x' });
    expect((await api().patch(`/students/${s}/monthly-payments/${first.id}/void`).set(bearer(ceo.token)).send({ reason: 'x' })).status).toBe(200);

    const [st] = await db.select().from(students).where(eq(students.id, s));
    expect(st!.studyStatus).toBe('NOACTIVE');
    const again = await pay(s, salesManager.token);
    expect(again.status).toBe(201);
    expect(again.body.isFirstPayment).toBe(true);
  });
});

describe('marking a student as paid', () => {
  let school: number, director: TestUser, teacher: TestUser, salesManager: TestUser;

  const callStatus = (studentId: number, status: string) =>
    api().patch(`/students/${studentId}/call-status`).set(bearer(salesManager.token)).send({ callStatus: status });
  const balanceOf = async (u: TestUser) => (await api().get(`/payouts/balance/${u.id}`).set(bearer(u.token))).body;
  const pendingReward = async (u: TestUser) => (await balanceOf(u)).commissionPendingUzs;

  beforeAll(async () => {
    school = await makeSchool('Paid-status school');
    director = await makeUser('DIRECTOR', { schoolId: school });
    teacher = await makeUser('TEACHER', { schoolId: school });
    salesManager = await makeUser('SALES_MANAGER');
    await setRules(ceo.token, { teacherFirstPaymentPercent: 3000, directorFirstPaymentPercent: 1500, specialPriceUzs: 250_000 });
  });

  it('refuses "To\'lov qildi" until a payment is recorded, so no one is marked paid without a bonus', async () => {
    const s = await makeStudent({ teacherId: teacher.id, schoolId: school, directorId: director.id });
    expect((await callStatus(s, 'STARTED_STUDYING')).status).toBe(200);

    const refused = await callStatus(s, 'MADE_PAYMENT');
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/birinchi to'lovini kiriting/);
    const [st] = await db.select().from(students).where(eq(students.id, s));
    expect(st!.callStatus).toBe('STARTED_STUDYING');
    expect(st!.studyStatus).toBe('NOACTIVE');
  });

  it('recording the first payment marks the student paid and fills both pending rewards', async () => {
    const s = await makeStudent({ fullName: 'Paid-status student', teacherId: teacher.id, schoolId: school, directorId: director.id });
    const teacherBefore = await balanceOf(teacher);
    const directorBefore = await balanceOf(director);

    const paid = await api().post(`/students/${s}/monthly-payments`).set(bearer(salesManager.token)).send({ amountUzs: 250_000, paidForMonth: '2026-09' });
    expect(paid.status).toBe(201);
    const teacherAfter = await balanceOf(teacher);
    const directorAfter = await balanceOf(director);
    expect(teacherAfter.commissionPendingUzs).toBe(teacherBefore.commissionPendingUzs + 75_000); // 30% of 250,000
    expect(directorAfter.commissionPendingUzs).toBe(directorBefore.commissionPendingUzs + 37_500); // 15% of 250,000
    // The pending reward is not added to the Bonus Card balance.
    expect(teacherAfter.balanceUzs).toBe(teacherBefore.balanceUzs);
    expect(directorAfter.balanceUzs).toBe(directorBefore.balanceUzs);

    // The teacher's reward history names the student and month, but not what the student paid.
    const history = (await api().get('/commissions').set(bearer(teacher.token))).body as Record<string, unknown>[];
    expect(history.every((c) => c['userId'] === teacher.id)).toBe(true);
    const row = history.find((c) => c['studentId'] === s);
    expect(row).toMatchObject({ studentName: 'Paid-status student', paidForMonth: '2026-09', type: 'SIGNUP_BONUS', amountUzs: 75_000 });
    expect(JSON.stringify(row)).not.toContain('250000');

    const [st] = await db.select().from(students).where(eq(students.id, s));
    expect(st!.callStatus).toBe('MADE_PAYMENT');
    expect(st!.studyStatus).toBe('ACTIVE');

    // With a payment on record the status can be set back by hand, and that creates no extra bonus.
    expect((await callStatus(s, 'CALLED')).status).toBe(200);
    expect((await callStatus(s, 'MADE_PAYMENT')).status).toBe(200);
    expect(await pendingReward(teacher)).toBe(teacherBefore.commissionPendingUzs + 75_000);
  });

  it('a voided payment does not count as a payment on record', async () => {
    const s = await makeStudent({ teacherId: teacher.id, schoolId: school, directorId: director.id });
    const first = (await api().post(`/students/${s}/monthly-payments`).set(bearer(salesManager.token)).send({ amountUzs: 250_000, paidForMonth: '2026-09' })).body;
    expect((await api().patch(`/students/${s}/monthly-payments/${first.id}/void`).set(bearer(ceo.token)).send({ reason: 'test' })).status).toBe(200);
    expect((await callStatus(s, 'MADE_PAYMENT')).status).toBe(409);
  });
});

describe('withdrawals', () => {
  let school: number, director: TestUser, teacher: TestUser, studentId: number;

  beforeAll(async () => {
    school = await makeSchool('Withdraw school');
    director = await makeUser('DIRECTOR', { schoolId: school });
    teacher = await makeUser('TEACHER', { schoolId: school });
    studentId = await makeStudent({ teacherId: teacher.id, schoolId: school, directorId: director.id });
    await setRules(ceo.token, { withdrawLimitTeacherUzs: 300_000 });
  });

  const eligibility = async (t: TestUser) => (await api().get('/withdrawals/eligibility').set(bearer(t.token))).body;
  const request = (t: TestUser) => api().post('/withdrawals').set(bearer(t.token)).send({});

  it('five concurrent requests create exactly one', async () => {
    const t = await makeUser('TEACHER', { schoolId: school });
    await addPendingCommission(t.id, studentId, 700_000);
    const results = await Promise.all(Array.from({ length: 5 }, () => request(t)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    const rows = await db.select().from(withdrawRequests).where(eq(withdrawRequests.userId, t.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountUzs).toBe(600_000); // 2x the 300,000 limit
  });

  it('a paid-out withdrawal is not subtracted twice from what can be withdrawn next', async () => {
    const t = await makeUser('TEACHER', { schoolId: school });
    await addPendingCommission(t.id, studentId, 1_747_500);
    const created = (await request(t)).body;
    expect(created.amountUzs).toBe(1_500_000);
    expect((await api().patch(`/withdrawals/${created.id}/verify`).set(bearer(ceo.token)).send({})).status).toBe(200);
    expect((await api().patch(`/withdrawals/${created.id}/give`).set(bearer(ceo.token)).send({})).status).toBe(200);
    expect((await eligibility(t)).availableUzs).toBe(247_500);

    await addPendingCommission(t.id, studentId, 400_000); // earns more afterwards
    const e = await eligibility(t);
    expect(e.availableUzs).toBe(647_500);
    expect(e.withdrawableUzs).toBe(600_000);
  });

  it('verifying takes the amount out of pending; rejecting a pending request frees the amount', async () => {
    const t = await makeUser('TEACHER', { schoolId: school });
    await addPendingCommission(t.id, studentId, 300_000);
    const first = (await request(t)).body;
    expect((await api().get(`/payouts/balance/${t.id}`).set(bearer(ceo.token))).body.commissionPendingUzs).toBe(300_000); // still pending
    const noReason = await api().patch(`/withdrawals/${first.id}/reject`).set(bearer(ceo.token)).send({});
    expect(noReason.status).toBe(400);
    expect((await api().patch(`/withdrawals/${first.id}/reject`).set(bearer(ceo.token)).send({ comment: 'wrong bank details' })).status).toBe(200);
    expect((await eligibility(t)).withdrawableUzs).toBe(300_000);

    const second = (await request(t)).body;
    await api().patch(`/withdrawals/${second.id}/verify`).set(bearer(ceo.token)).send({ comment: 'come tomorrow' });
    const bal = (await api().get(`/payouts/balance/${t.id}`).set(bearer(ceo.token))).body;
    expect(bal.commissionPendingUzs).toBe(0);
    expect(bal.balanceUzs).toBe(0);
    // once verified it can no longer be rejected
    expect((await api().patch(`/withdrawals/${second.id}/reject`).set(bearer(ceo.token)).send({ comment: 'late' })).status).toBe(404);
  });

  it('only the CEO can act on a request, and a request cannot skip verification', async () => {
    const t = await makeUser('TEACHER', { schoolId: school });
    await addPendingCommission(t.id, studentId, 300_000);
    const r = (await request(t)).body;
    expect((await api().patch(`/withdrawals/${r.id}/verify`).set(bearer(t.token)).send({})).status).toBe(403);
    expect((await api().patch(`/withdrawals/${r.id}/give`).set(bearer(ceo.token)).send({})).status).toBe(404); // not VERIFIED yet
  });

  it('refuses a withdrawal below the limit or while no limit is configured', async () => {
    const t = await makeUser('TEACHER', { schoolId: school });
    await addPendingCommission(t.id, studentId, 100_000);
    expect((await request(t)).status).toBe(400);
    const dir = await makeUser('DIRECTOR', { schoolId: school }); // director limit is 0 = disabled
    await addPendingCommission(dir.id, studentId, 10_000_000);
    expect((await request(dir)).status).toBe(400);
  });
});

describe('account management', () => {
  it('lets a user change their own password and the old one stops working', async () => {
    const t = await makeUser('TEACHER');
    expect((await api().patch('/users/me/password').set(bearer(t.token)).send({ currentPassword: 'nope-nope-1', newPassword: 'brand-new-pass-1' })).status).toBe(400);
    expect((await api().patch('/users/me/password').set(bearer(t.token)).send({ currentPassword: PASSWORD, newPassword: 'short' })).status).toBe(400);
    expect((await api().patch('/users/me/password').set(bearer(t.token)).send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' })).status).toBe(200);
    expect((await api().post('/auth/login').send({ phone: t.phone, password: PASSWORD })).status).toBe(401);
    expect(await login(t.phone, 'brand-new-pass-1')).toBeTruthy();
  });

  it('lets only the CEO reset, edit, deactivate and reactivate users', async () => {
    const victim = await makeUser('TEACHER');
    const other = await makeUser('TEACHER');
    expect((await api().patch(`/users/${victim.id}/password`).set(bearer(other.token)).send({ newPassword: 'hacked-pass-1' })).status).toBe(403);
    expect((await api().patch(`/users/${victim.id}`).set(bearer(other.token)).send({ fullName: 'x' })).status).toBe(403);
    expect((await api().patch(`/users/${victim.id}/password`).set(bearer(ceo.token)).send({ newPassword: 'reset-pass-1234' })).status).toBe(200);
    expect(await login(victim.phone, 'reset-pass-1234')).toBeTruthy();

    expect((await api().delete(`/users/${victim.id}`).set(bearer(ceo.token))).status).toBe(200);
    expect((await api().post('/auth/login').send({ phone: victim.phone, password: 'reset-pass-1234' })).status).toBe(401);
    expect((await api().patch(`/users/${victim.id}/reactivate`).set(bearer(ceo.token))).status).toBe(200);
    expect(await login(victim.phone, 'reset-pass-1234')).toBeTruthy();
  });

  it('never lets the CEO deactivate themselves', async () => {
    expect((await api().delete(`/users/${ceo.id}`).set(bearer(ceo.token))).status).toBe(400);
  });
});

// A unique-constraint violation must come back as a friendly 4xx, never a 500. These paths
// read the Postgres error code, which drizzle wraps — keep them covered across ORM upgrades.
describe('unique constraint handling', () => {
  it('reports a duplicate user phone as a clean 400', async () => {
    const school = await makeSchool('Dup school');
    const director = await makeUser('DIRECTOR', { schoolId: school });
    const phone = uniquePhone();
    const body = { fullName: 'Dup Teacher', phone, password: PASSWORD };
    expect((await api().post('/users/teacher').set(bearer(director.token)).send(body)).status).toBe(201);
    const again = await api().post('/users/teacher').set(bearer(director.token)).send(body);
    expect(again.status).toBe(400);
    expect(JSON.stringify(again.body)).toContain('allaqachon');
  });

  it('two simultaneous creations of the same student phone give one 201 and one 409, never a 500', async () => {
    const teacher = await makeUser('TEACHER');
    const phone = uniquePhone();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        api().post('/students').set(bearer(teacher.token)).send({ fullName: 'Race', phone }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409]);
  });

  it('answers 409 when the CEO edits a phone onto one already in use', async () => {
    const a = await makeUser('TEACHER');
    const b = await makeUser('TEACHER');
    expect((await api().patch(`/users/${b.id}`).set(bearer(ceo.token)).send({ phone: a.phone })).status).toBe(409);

    const s1 = await makeStudent();
    const s2 = await makeStudent();
    const [{ phone }] = await db.select({ phone: students.phone }).from(students).where(eq(students.id, s1));
    expect((await api().patch(`/students/${s2}`).set(bearer(ceo.token)).send({ phone })).status).toBe(409);
  });
});

// Malformed ids and filter values used to reach the database and come back as 500s.
describe('input validation', () => {
  it('answers 400 (not 500) for malformed ids in the path', async () => {
    const sm = await makeUser('SALES_MANAGER');
    for (const bad of ['abc', '0', '-5', '1.5', '99999999999']) {
      expect((await api().get(`/students/${bad}`).set(bearer(ceo.token))).status, `students/${bad}`).toBe(400);
    }
    expect((await api().get('/students/999999999').set(bearer(ceo.token))).status).toBe(404); // valid but absent
    expect((await api().patch('/commissions/abc/mark-paid').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().get('/payouts/balance/abc').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().post('/students/abc/monthly-payments').set(bearer(sm.token)).send({ amountUzs: 1000, paidForMonth: '2026-09' })).status).toBe(400);
    expect((await api().patch('/students/1/monthly-payments/xyz/void').set(bearer(ceo.token)).send({ reason: 'x' })).status).toBe(400);
  });

  it('answers 400 for bad filter values and still honours good ones', async () => {
    expect((await api().get('/students?callStatus=BOGUS').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().get('/students?schoolId=abc').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().get('/commissions?status=nope').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().get('/commissions?userId=abc').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().get('/withdrawals?status=nope').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().get('/payouts?status=nope').set(bearer(ceo.token))).status).toBe(400);
    expect((await api().get('/audit-logs?entityId=abc').set(bearer(ceo.token))).status).toBe(400);

    expect((await api().get('/students?callStatus=WAITING').set(bearer(ceo.token))).status).toBe(200);
    expect((await api().get('/commissions?status=PENDING').set(bearer(ceo.token))).status).toBe(200);
    expect((await api().get('/withdrawals?status=PENDING').set(bearer(ceo.token))).status).toBe(200);
  });

  it('reports which input was wrong', async () => {
    const res = await api().get('/students?callStatus=BOGUS').set(bearer(ceo.token));
    expect(res.body.error).toBe('Invalid callStatus');
  });
});
