// Thrown inside a db.transaction to abort it (rolling back every write) and answer
// with a specific HTTP status instead of a generic 500.
export class RequestRejected extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Postgres unique-constraint violation.
export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
