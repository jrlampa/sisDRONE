import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Auth Register — POST /api/auth/register', () => {
  const uniqueName = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  it('deve criar usuário com credenciais válidas e retornar token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: uniqueName(),
      password: 'Senha@1234',
      tenant_id: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('username');
    expect(res.body.user.role).toBe('VIEWER');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('deve aceitar role ENGINEER quando fornecida', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: uniqueName(),
      password: 'Senha@5678',
      role: 'ENGINEER',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('ENGINEER');
  });

  it('deve retornar 409 para username duplicado', async () => {
    const name = uniqueName();
    await request(app).post('/api/auth/register').send({ username: name, password: 'Senha@1234' });
    const res = await request(app).post('/api/auth/register').send({ username: name, password: 'Outra@123' });
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 quando username tem menos de 3 caracteres', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'ab', password: 'Senha@1234' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 quando password tem menos de 8 caracteres', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: uniqueName(), password: '1234567' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 caracteres/);
  });

  it('deve retornar 400 quando username ou password ausentes', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: uniqueName() });
    expect(res.status).toBe(400);
  });

  it('deve usar role VIEWER quando role inválida é fornecida', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: uniqueName(),
      password: 'Senha@9012',
      role: 'SUPERADMIN',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('VIEWER');
  });

  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: uniqueName(),
      password: 'Senha@1234',
      tenant_id: -1,
    });
    expect(res.status).toBe(400);
  });
});
