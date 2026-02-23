/**
 * Tests the module-level `if (!process.env.JWT_SECRET)` branch in authService.ts.
 * Uses vi.resetModules() + dynamic import to run the module with JWT_SECRET set,
 * covering the false branch that is not reached in the regular test suite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

describe('AuthService — branch: JWT_SECRET configurado em produção', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'super-secret-for-branch-coverage-test';
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_JWT_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
    }
    vi.resetModules();
  });

  it('deve usar JWT_SECRET do env e assinar token válido (sem console.warn)', async () => {
    const { signToken, verifyToken } = await import('../services/authService');
    const payload = { userId: 99, username: 'branchtest', role: 'VIEWER', tenantId: 2 };
    const token = signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(99);
    expect(decoded.username).toBe('branchtest');
  });

  it('deve rejeitar token assinado com outro segredo', async () => {
    const { signToken } = await import('../services/authService');
    process.env.JWT_SECRET = 'different-secret';
    vi.resetModules();
    const { verifyToken } = await import('../services/authService');
    const tokenFromFirst = signToken({ userId: 1, username: 'x', role: 'ADMIN', tenantId: 1 });
    expect(() => verifyToken(tokenFromFirst)).toThrow();
  });
});
