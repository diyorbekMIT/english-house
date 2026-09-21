import type { Router } from 'express';
import { RequestRejected } from './httpErrors.js';

// Ids are bigserial but stored in integer foreign keys, so anything outside 1..999,999,999
// (or not a plain integer) can never match a row — answer 400 instead of letting the
// database reject "NaN" or an out-of-range value as a 500.
const ID = /^[1-9]\d{0,8}$/;

// Validates route params (":id", ":userId" …) before any handler runs.
export const validateIdParams = (router: Router, ...names: string[]): void => {
  for (const name of names) {
    router.param(name, (_req, _res, next, value) => {
      if (ID.test(String(value))) next();
      else next(new RequestRejected(400, `Invalid ${name}`));
    });
  }
};

// Optional numeric id in the query string; absent/empty -> undefined, malformed -> 400.
export const queryId = (value: unknown, name: string): number | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'string' && ID.test(value)) return Number(value);
  throw new RequestRejected(400, `Invalid ${name}`);
};

// Optional enum value in the query string; absent/empty -> undefined, unknown -> 400.
export const queryEnum = <T extends string>(value: unknown, allowed: readonly T[], name: string): T | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new RequestRejected(400, `Invalid ${name}`);
};
