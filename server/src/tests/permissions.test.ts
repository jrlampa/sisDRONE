/**
 * permissions.test.ts — Phase 37: RBAC Granular por Tenant
 * Tests for GET/PUT /api/users/:id/permissions and checkGranularPermission middleware
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let testUserId: number;

beforeAll(async () => {
  // Create a test user to assign permissions to
  const res = await request(app).post('/api/auth/register').send({
    username: `perm_test_${Date.now()}`,
    password: 'Senha@Perms1',
  });
  testUserId = res.body.user?.id;
});

describe('Phase 37 — GET /api/users/:id/permissions', () => {
  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app)
      .get('/api/users/abc/permissions')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 403 para role não-ADMIN', async () => {
    const res = await request(app)
      .get(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/ADMIN/);
  });

  it('deve retornar 404 para usuário inexistente', async () => {
    const res = await request(app)
      .get('/api/users/999999/permissions')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 200 com permissions vazio para usuário sem permissões explícitas', async () => {
    const res = await request(app)
      .get(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(testUserId);
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });
});

describe('Phase 37 — PUT /api/users/:id/permissions', () => {
  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app)
      .put('/api/users/0/permissions')
      .set('x-user-role', 'ADMIN')
      .send({ permissions: [] });
    expect(res.status).toBe(400);
  });

  it('deve retornar 403 para role não-ADMIN', async () => {
    const res = await request(app)
      .put(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'VIEWER')
      .send({ permissions: [{ resource: 'poles', action: 'read' }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/ADMIN/);
  });

  it('deve retornar 400 quando permissions não é array', async () => {
    const res = await request(app)
      .put(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'ADMIN')
      .send({ permissions: 'invalido' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array/);
  });

  it('deve retornar 400 para resource inválido', async () => {
    const res = await request(app)
      .put(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'ADMIN')
      .send({ permissions: [{ resource: 'xyz', action: 'read' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/resource/);
  });

  it('deve definir permissões com sucesso (200)', async () => {
    const res = await request(app)
      .put(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'ADMIN')
      .send({
        permissions: [
          { resource: 'poles', action: 'read' },
          { resource: 'inspections', action: 'create' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(testUserId);
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions).toHaveLength(2);
  });

  it('GET após PUT deve retornar as permissões definidas', async () => {
    const res = await request(app)
      .get(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.permissions).toHaveLength(2);
    const resources = res.body.permissions.map((p: { resource: string }) => p.resource);
    expect(resources).toContain('poles');
    expect(resources).toContain('inspections');
  });

  it('PUT substitui permissões existentes (idempotente)', async () => {
    // Set only one permission
    const res = await request(app)
      .put(`/api/users/${testUserId}/permissions`)
      .set('x-user-role', 'ADMIN')
      .send({ permissions: [{ resource: 'network', action: 'read' }] });
    expect(res.status).toBe(200);
    expect(res.body.permissions).toHaveLength(1);
    expect(res.body.permissions[0].resource).toBe('network');
  });
});

describe('Phase 37 — checkGranularPermission middleware', () => {
  it('ADMIN sempre tem acesso a qualquer recurso', async () => {
    // Test via /api/network/validate — uses rateLimit but not granular; test via poles stats
    const res = await request(app)
      .get('/api/poles/stats')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
  });
});
