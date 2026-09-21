// Thrown inside a db.transaction to abort it (rolling back every write) and answer
// with a specific HTTP status instead of a generic 500.
export class RequestRejected extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// The Postgres error code behind a failed query. drizzle-orm >= 0.45 wraps driver errors
// in its own error class and keeps the original (with its SQLSTATE `code`) in `cause`,
// so the code has to be looked up through the cause chain.
export const pgErrorCode = (err: unknown): string | undefined => {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
};

// Postgres unique-constraint violation.
export const isUniqueViolation = (err: unknown): boolean => pgErrorCode(err) === '23505';
