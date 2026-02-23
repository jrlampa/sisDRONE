import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Users Endpoint — GET /api/users', () => {
  it('deve retornar 200 com array de usuários', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('cada usuário deve ter id, username, role e tenant_id', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const user of res.body) {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('tenant_id');
    }
  });

  it('não deve retornar password_hash nos usuários', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    for (const user of res.body) {
      expect(user).not.toHaveProperty('password_hash');
    }
  });

  it('todos os usuários devem ter role válida (ADMIN, ENGINEER ou VIEWER)', async () => {
    const res = await request(app).get('/api/users');
    const validRoles = new Set(['ADMIN', 'ENGINEER', 'VIEWER']);
    for (const user of res.body) {
      expect(validRoles.has(user.role)).toBe(true);
    }
  });
});

describe('Users por ID — GET /api/users/:id', () => {
  it('deve retornar 200 com dados do usuário para id válido', async () => {
    const res = await request(app).get('/api/users/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body).toHaveProperty('username');
    expect(res.body).toHaveProperty('role');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('deve retornar 400 para id não numérico', async () => {
    const res = await request(app).get('/api/users/abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 para id = 0', async () => {
    const res = await request(app).get('/api/users/0');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para usuário inexistente', async () => {
    const res = await request(app).get('/api/users/999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
