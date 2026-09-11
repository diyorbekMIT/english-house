import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Route handlers in this app are plain `async (req, res) => {...}` with no try/catch.
// Express 4 does not catch a rejected promise from an async handler on its own — without
// this wrapper, a DB error (e.g. a unique constraint violation) never reaches the error
// middleware, so the request just hangs forever and the client sees an endless loading
// state instead of an error.
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
