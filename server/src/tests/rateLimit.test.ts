import { describe, it, expect } from 'vitest';
import { rateLimit } from '../middleware/rateLimit';
import type { Request, Response, NextFunction } from 'express';

function makeReq(ip: string): Partial<Request> {
  return { ip, socket: { remoteAddress: ip } as any, headers: {} };
}

function makeRes(): { status: (c: number) => any; json: (b: any) => any; statusCode: number; body: any } {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}

describe('RateLimit Middleware', () => {
  it('should allow requests under the limit', () => {
    const middleware = rateLimit(5, 10_000);
    const req = makeReq('1.2.3.4') as Request;
    let nextCalled = 0;
    const next: NextFunction = () => { nextCalled++; };

    for (let i = 0; i < 5; i++) {
      const res = makeRes() as unknown as Response;
      middleware(req, res, next);
    }
    expect(nextCalled).toBe(5);
  });

  it('should return 429 when limit is exceeded', () => {
    const middleware = rateLimit(2, 10_000);
    const req = makeReq('5.6.7.8') as Request;
    const responses: any[] = [];
    const next: NextFunction = () => {};

    for (let i = 0; i < 3; i++) {
      const res = makeRes() as unknown as Response;
      middleware(req, res, next);
      responses.push(res);
    }

    expect(responses[0].statusCode).toBe(200);
    expect(responses[1].statusCode).toBe(200);
    expect(responses[2].statusCode).toBe(429);
    expect(responses[2].body.error).toContain('Muitas requisições');
  });

  it('should isolate limits per IP', () => {
    const middleware = rateLimit(1, 10_000);
    const reqA = makeReq('10.0.0.1') as Request;
    const reqB = makeReq('10.0.0.2') as Request;
    let nextCalled = 0;
    const next: NextFunction = () => { nextCalled++; };

    middleware(reqA, makeRes() as unknown as Response, next);
    middleware(reqB, makeRes() as unknown as Response, next);

    expect(nextCalled).toBe(2);
  });

  it('should fall back to socket.remoteAddress when req.ip is undefined', () => {
    const middleware = rateLimit(2, 10_000);
    const req = { ip: undefined, socket: { remoteAddress: '99.99.99.99' }, headers: {} } as unknown as Request;
    let nextCalled = 0;
    const next: NextFunction = () => { nextCalled++; };

    middleware(req, makeRes() as unknown as Response, next);
    middleware(req, makeRes() as unknown as Response, next);

    expect(nextCalled).toBe(2);
  });

  it('should fall back to "unknown" when req.ip and socket.remoteAddress are both missing', () => {
    const middleware = rateLimit(1, 10_000);
    const req = { ip: undefined, socket: { remoteAddress: undefined }, headers: {} } as unknown as Request;
    let nextCalled = 0;
    const next: NextFunction = () => { nextCalled++; };
    const res = makeRes() as unknown as Response;

    middleware(req, res, next);
    expect(nextCalled).toBe(1);
  });
});
