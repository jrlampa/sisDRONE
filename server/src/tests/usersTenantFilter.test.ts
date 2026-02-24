import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Users tenant_id filter', () => {
  it('should return all users when no tenant_id provided', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter users by tenant_id=1', async () => {
    const res = await request(app)
      .get('/api/users?tenant_id=1')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // All returned users must belong to tenant 1
    res.body.forEach((u: any) => expect(u.tenant_id).toBe(1));
  });

  it('should return 400 for non-numeric tenant_id', async () => {
    const res = await request(app)
      .get('/api/users?tenant_id=abc')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id inválido/i);
  });

  it('should return 400 for tenant_id=0', async () => {
    const res = await request(app)
      .get('/api/users?tenant_id=0')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id inválido/i);
  });

  it('should not include password_hash in response', async () => {
    const res = await request(app)
      .get('/api/users?tenant_id=1')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    res.body.forEach((u: any) => expect(u).not.toHaveProperty('password_hash'));
  });
});
