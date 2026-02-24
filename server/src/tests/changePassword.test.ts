import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

const TEST_USERNAME = `testchange_${Date.now()}`;
const INITIAL_PASSWORD = 'SenhaInicial@123';
const NEW_PASSWORD = 'SenhaNova@456';

describe('Auth Change Password — POST /api/auth/change-password', () => {
  beforeAll(async () => {
    // Register a fresh user for change-password tests
    await request(app).post('/api/auth/register').send({
      username: TEST_USERNAME,
      password: INITIAL_PASSWORD,
    });
  });

  it('deve retornar 400 se username ausente', async () => {
    const res = await request(app).post('/api/auth/change-password').send({
      currentPassword: INITIAL_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 se newPassword muito curta (< 8 chars)', async () => {
    const res = await request(app).post('/api/auth/change-password').send({
      username: TEST_USERNAME,
      currentPassword: INITIAL_PASSWORD,
      newPassword: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 caracteres/);
  });

  it('deve retornar 400 se newPassword igual a currentPassword', async () => {
    const res = await request(app).post('/api/auth/change-password').send({
      username: TEST_USERNAME,
      currentPassword: INITIAL_PASSWORD,
      newPassword: INITIAL_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/diferente/);
  });

  it('deve retornar 401 se currentPassword incorreta', async () => {
    const res = await request(app).post('/api/auth/change-password').send({
      username: TEST_USERNAME,
      currentPassword: 'senhaerrada123',
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/incorreta/);
  });

  it('deve retornar 200 e alterar senha com credenciais corretas', async () => {
    const res = await request(app).post('/api/auth/change-password').send({
      username: TEST_USERNAME,
      currentPassword: INITIAL_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/sucesso/i);
  });

  it('após mudança, login com nova senha deve funcionar', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: TEST_USERNAME,
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('após mudança, login com senha antiga deve falhar', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: TEST_USERNAME,
      password: INITIAL_PASSWORD,
    });
    expect(res.status).toBe(401);
  });
});
