import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../app.js';
import { db } from '../../../db/client.js';
import { users, roles, schools, students, commissions } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';

export const PASSWORD = 'pass-12345';
const HASH = bcrypt.hashSync(PASSWORD, 4); // low cost: tests create many users

let counter = 0;
export const uniquePhone = (): string => `+99890${String(1000000 + counter++)}`;

export const api = () => request(app);
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const login = async (phone: string, password = PASSWORD): Promise<string> => {
  const res = await api().post('/auth/login').send({ phone, password });
  if (res.status !== 200) throw new Error(`login failed for ${phone}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token as string;
};

export interface TestUser { id: number; phone: string; token: string }

export const makeUser = async (
  roleName: string,
  opts: { schoolId?: number | null; fullName?: string } = {},
): Promise<TestUser> => {
  const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
  const phone = uniquePhone();
  const [user] = await db
    .insert(users)
    .values({
      fullName: opts.fullName ?? `${roleName} ${phone}`,
      phone,
      passwordHash: HASH,
      roleId: role!.id,
      schoolId: opts.schoolId ?? null,
    })
    .returning({ id: users.id });
  return { id: user!.id, phone, token: await login(phone) };
};

export const makeSchool = async (name = 'Test school'): Promise<number> => {
  const [s] = await db.insert(schools).values({ name, schoolNumber: String(counter++) }).returning({ id: schools.id });
  return s!.id;
};

export const makeStudent = async (fields: Partial<typeof students.$inferInsert> = {}): Promise<number> => {
  const [s] = await db
    .insert(students)
    .values({ fullName: 'Student', phone: uniquePhone(), ...fields })
    .returning({ id: students.id });
  return s!.id;
};

export const addPendingCommission = async (userId: number, studentId: number, amountUzs: number): Promise<void> => {
  await db.insert(commissions).values({ userId, studentId, amountUzs, type: 'MONTHLY_COMMISSION', status: 'PENDING' });
};

// The CEO the rest of the suite acts as; created once per file that needs it.
export const makeCeo = (): Promise<TestUser> => makeUser('SUPER_ADMIN');

export const setRules = async (
  ceoToken: string,
  overrides: Partial<Record<string, number>> = {},
): Promise<void> => {
  const res = await api()
    .put('/commission-rules')
    .set(bearer(ceoToken))
    .send({
      teacherSignupBonusUzs: 0,
      directorSignupBonusUzs: 0,
      teacherMonthlyPercent: 1000,
      directorMonthlyPercent: 500,
      teacherFirstPaymentPercent: 2000,
      directorFirstPaymentPercent: 1000,
      specialPriceUzs: 1_000_000,
      withdrawLimitTeacherUzs: 0,
      withdrawLimitDirectorUzs: 0,
      ...overrides,
    });
  if (res.status !== 200) throw new Error(`setRules failed: ${res.status}`);
};
