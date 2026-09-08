import express from 'express';
import cors from 'cors';
import { JWT_SECRET, PORT, FRONTEND_URL } from './config.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { studentsRouter } from './routes/students.js';
import { paymentsRouter } from './routes/payments.js';
import { commissionsRouter } from './routes/commissions.js';
import { commissionRulesRouter } from './routes/commission-rules.js';
import { auditLogsRouter } from './routes/audit-logs.js';
import { schoolsRouter } from './routes/schools.js';
import { analyticsRouter } from './routes/analytics.js';

export { JWT_SECRET };

const app = express();

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/schools', schoolsRouter);
app.use('/students', studentsRouter);
app.use('/students/:studentId/monthly-payments', paymentsRouter);
app.use('/commissions', commissionsRouter);
app.use('/commission-rules', commissionRulesRouter);
app.use('/audit-logs', auditLogsRouter);
app.use('/analytics', analyticsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Referral API running on http://localhost:${PORT}`);
});
