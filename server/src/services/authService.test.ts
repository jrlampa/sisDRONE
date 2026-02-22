import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, hashPassword, comparePassword } from '../services/authService';

describe('AuthService', () => {
  const payload = { userId: 1, username: 'admin_eq', role: 'ADMIN', tenantId: 1 };

  it('should sign and verify a JWT token', () => {
    const token = signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.username).toBe(payload.username);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.tenantId).toBe(payload.tenantId);
  });

  it('should throw on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  it('should throw on tampered token', () => {
    const token = signToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('should hash and verify password', async () => {
    const hash = await hashPassword('sisdrone123');
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('sisdrone123');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

    const isValid = await comparePassword('sisdrone123', hash);
    expect(isValid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correctPassword');
    const isValid = await comparePassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });
});
