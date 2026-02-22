import { describe, it, expect } from 'vitest';
import { checkPermission } from '../middleware/auth';
import type { Request, Response, NextFunction } from 'express';

function makeReq(role?: string): Partial<Request> {
  return {
    headers: role ? { 'x-user-role': role } : {}
  };
}

function makeRes(): { status: (code: number) => any; json: (body: any) => any; statusCode: number; body: any } {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}

describe('Auth Middleware - checkPermission', () => {
  it('should call next() when role is allowed', () => {
    const middleware = checkPermission(['ADMIN', 'ENGINEER']);
    const req = makeReq('ADMIN') as Request;
    const res = makeRes() as unknown as Response;
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req, res, next);

    expect(nextCalled).toBe(true);
  });

  it('should return 401 when no role header is provided', () => {
    const middleware = checkPermission(['ADMIN']);
    const req = makeReq() as Request;
    const res = makeRes() as unknown as Response;
    const next: NextFunction = () => {};

    middleware(req, res, next);

    expect((res as any).statusCode).toBe(401);
    expect((res as any).body.error).toContain('Authentication required');
  });

  it('should return 403 when role is not in allowed list', () => {
    const middleware = checkPermission(['ADMIN']);
    const req = makeReq('VIEWER') as Request;
    const res = makeRes() as unknown as Response;
    const next: NextFunction = () => {};

    middleware(req, res, next);

    expect((res as any).statusCode).toBe(403);
    expect((res as any).body.error).toContain('Forbidden');
  });

  it('should allow ENGINEER when included in allowed roles', () => {
    const middleware = checkPermission(['ADMIN', 'ENGINEER']);
    const req = makeReq('ENGINEER') as Request;
    const res = makeRes() as unknown as Response;
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req, res, next);

    expect(nextCalled).toBe(true);
  });
});
