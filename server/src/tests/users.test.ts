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

describe('Atualizar Usuário — PUT /api/users/:id', () => {
  let testUserId: number;

  it('deve criar usuário de teste via register', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: `puttest_${Date.now()}`,
      password: 'Senha@9999',
    });
    expect(res.status).toBe(201);
    testUserId = res.body.user.id;
  });

  it('deve atualizar role do usuário (200)', async () => {
    const res = await request(app).put(`/api/users/${testUserId}`).send({ role: 'ENGINEER' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ENGINEER');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('deve retornar 400 para role inválida', async () => {
    const res = await request(app).put(`/api/users/${testUserId}`).send({ role: 'SUPERADMIN' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 quando nenhum campo é fornecido', async () => {
    const res = await request(app).put(`/api/users/${testUserId}`).send({});
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para usuário inexistente', async () => {
    const res = await request(app).put('/api/users/999999').send({ role: 'VIEWER' });
    expect(res.status).toBe(404);
  });

  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app).put('/api/users/abc').send({ role: 'VIEWER' });
    expect(res.status).toBe(400);
  });
});

describe('Excluir Usuário — DELETE /api/users/:id', () => {
  let deleteUserId: number;

  it('deve criar usuário para exclusão', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: `deltest_${Date.now()}`,
      password: 'Senha@7777',
    });
    expect(res.status).toBe(201);
    deleteUserId = res.body.user.id;
  });

  it('deve retornar 403 ao tentar excluir o próprio usuário', async () => {
    const res = await request(app)
      .delete(`/api/users/${deleteUserId}`)
      .set('x-requester-id', String(deleteUserId));
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('deve excluir usuário com sucesso (200)', async () => {
    const res = await request(app).delete(`/api/users/${deleteUserId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.id).toBe(deleteUserId);
  });

  it('deve retornar 404 para usuário já excluído', async () => {
    const res = await request(app).delete(`/api/users/${deleteUserId}`);
    expect(res.status).toBe(404);
  });

  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app).delete('/api/users/xyz');
    expect(res.status).toBe(400);
  });
});
