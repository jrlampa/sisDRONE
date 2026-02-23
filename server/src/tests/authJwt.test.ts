import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Auth API', () => {
  it('POST /api/auth/login should return 400 if body is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login should return 400 if only username given', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin_eq' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login should return 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin_eq', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login should return 401 for non-existent user', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'sisdrone123' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login should return a JWT for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin_eq', password: 'sisdrone123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toBe('admin_eq');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3); // JWT format: header.payload.signature
  });

  it('Protected route should accept JWT Bearer token', async () => {
    // Login to get token
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin_eq', password: 'sisdrone123' });
    const token = loginRes.body.token;

    // Use token to access a protected endpoint via Bearer header
    const res = await request(app)
      .get('/api/poles')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
