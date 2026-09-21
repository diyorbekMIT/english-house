import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { FRONTEND_URL } from './config.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { studentsRouter } from './routes/students.js';
import { paymentsRouter } from './routes/payments.js';
import { firstPaymentsRouter } from './routes/first-payments.js';
import { commissionsRouter } from './routes/commissions.js';
import { commissionRulesRouter } from './routes/commission-rules.js';
import { payoutsRouter } from './routes/payouts.js';
import { withdrawalsRouter } from './routes/withdrawals.js';
import { auditLogsRouter } from './routes/audit-logs.js';
import { schoolsRouter } from './routes/schools.js';
import { coursesRouter } from './routes/courses.js';
import { analyticsRouter } from './routes/analytics.js';
import { RequestRejected } from './lib/httpErrors.js';

export const app = express();

// Heroku terminates TLS at its router: trust one proxy hop so req.ip is the real client
// (rate limiting) and x-forwarded-proto reflects the original scheme.
app.set('trust proxy', 1);
app.use((req, res, next) => {
  if (process.env['NODE_ENV'] === 'production' && req.headers['x-forwarded-proto'] === 'http' && req.path !== '/health') {
    res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    return;
  }
  next();
});
// This is a JSON API consumed cross-origin by the Vercel frontend.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '100kb' }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/schools', schoolsRouter);
app.use('/courses', coursesRouter);
app.use('/students', studentsRouter);
app.use('/students/:studentId/monthly-payments', paymentsRouter);
app.use('/first-payments', firstPaymentsRouter);
app.use('/commissions', commissionsRouter);
app.use('/commission-rules', commissionRulesRouter);
app.use('/payouts', payoutsRouter);
app.use('/withdrawals', withdrawalsRouter);
app.use('/audit-logs', auditLogsRouter);
app.use('/analytics', analyticsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Fallback error handler: routes here don't wrap their async logic in try/catch,
// so without this a single failing request (e.g. a DB error) crashes the whole
// process instead of just returning a 500 to that request.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof RequestRejected) {
    if (!res.headersSent) res.status(err.status).json({ error: err.message });
    return;
  }
  // Client mistakes raised by Express itself (oversized or malformed JSON body) carry a
  // 4xx status — answer with it instead of a misleading 500.
  const status = (err as { status?: number; statusCode?: number } | null)?.status
    ?? (err as { statusCode?: number } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    if (!res.headersSent) {
      res.status(status).json({ error: status === 413 ? 'Request body too large' : 'Invalid request' });
    }
    return;
  }
  console.error('Unhandled route error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});
