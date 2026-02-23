import { describe, it, expect } from 'vitest';
import { checkPermission } from '../middleware/auth';
import { signToken } from '../services/authService';
import type { Request, Response, NextFunction } from 'express';

function makeReq(role?: string, authHeader?: string): Partial<Request> {
  const headers: Record<string, string> = {};
  if (role) headers['x-user-role'] = role;
  if (authHeader) headers['authorization'] = authHeader;
  return { headers };
}

function makeRes(): { status: (code: number) => any; json: (body: any) => any; statusCode: number; body: any } {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}

describe('Auth Middleware - checkPermission', () => {
  it('should call next() when role is allowed via x-user-role header', () => {
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

  // ── JWT Bearer token path (lines 12–19) ────────────────────────
  it('should extract role from valid JWT Bearer token', () => {
    const token = signToken({ userId: 1, username: 'admin', role: 'ADMIN', tenantId: 1 });
    const middleware = checkPermission(['ADMIN']);
    const req = makeReq(undefined, `Bearer ${token}`) as Request;
    const res = makeRes() as unknown as Response;
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };

    middleware(req, res, next);

    expect(nextCalled).toBe(true);
    expect((req as any).jwtUser).toBeDefined();
    expect((req as any).jwtUser.role).toBe('ADMIN');
  });

  it('should return 401 for invalid Bearer token', () => {
    const middleware = checkPermission(['ADMIN']);
    const req = makeReq(undefined, 'Bearer invalid.token.here') as Request;
    const res = makeRes() as unknown as Response;
    const next: NextFunction = () => {};

    middleware(req, res, next);

    expect((res as any).statusCode).toBe(401);
    expect((res as any).body.error).toContain('Authentication required');
  });

  it('should return 403 when JWT role not in allowed list', () => {
    const token = signToken({ userId: 2, username: 'viewer', role: 'VIEWER', tenantId: 1 });
    const middleware = checkPermission(['ADMIN']);
    const req = makeReq(undefined, `Bearer ${token}`) as Request;
    const res = makeRes() as unknown as Response;
    const next: NextFunction = () => {};

    middleware(req, res, next);

    expect((res as any).statusCode).toBe(403);
  });
});

