/**
 * circuits.test.ts — Phase 41: Circuitos Elétricos / Alimentadores
 * Tests for /api/circuits CRUD + /api/circuits/:id/stats
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;
let circuitId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;
});

describe('Phase 41 — Circuitos Elétricos', () => {
  it('POST /api/circuits deve criar um circuito válido', async () => {
    const res = await request(app)
      .post('/api/circuits')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'Circuito Teste A', description: 'Alimentador principal', color: '#f59e0b', tenant_id: tenantId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Circuito Teste A');
    expect(res.body.color).toBe('#f59e0b');
    circuitId = res.body.id;
  });

  it('POST /api/circuits deve retornar 400 sem name', async () => {
    const res = await request(app)
      .post('/api/circuits')
      .set('x-user-role', 'ADMIN')
      .send({ tenant_id: tenantId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('GET /api/circuits deve listar circuitos do tenant', async () => {
    const res = await request(app)
      .get(`/api/circuits?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.circuits)).toBe(true);
  });

  it('GET /api/circuits/:id deve retornar o circuito', async () => {
    const res = await request(app)
      .get(`/api/circuits/${circuitId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(circuitId);
    expect(res.body.name).toBe('Circuito Teste A');
  });

  it('GET /api/circuits/:id deve retornar 404 para id inexistente', async () => {
    const res = await request(app)
      .get('/api/circuits/999999')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(404);
  });

  it('PUT /api/circuits/:id deve atualizar o nome e cor', async () => {
    const res = await request(app)
      .put(`/api/circuits/${circuitId}`)
      .set('x-user-role', 'ADMIN')
      .send({ name: 'Circuito Atualizado', color: '#10b981' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Circuito Atualizado');
    expect(res.body.color).toBe('#10b981');
  });

  it('GET /api/circuits/:id/stats deve retornar estatísticas do circuito', async () => {
    const db = await getDb();
    // Associate one pole to this circuit
    const pole = await db.run(
      `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, circuit_id) VALUES (?, 'CktPole', -22.15, -42.92, 72, ?)`,
      [tenantId, circuitId]
    );
    // Associate one conductor
    const pole2 = await db.run(
      `INSERT INTO poles (tenant_id, name, lat, lng, circuit_id) VALUES (?, 'CktPole2', -22.151, -42.921, ?)`,
      [tenantId, circuitId]
    );
    await db.run(
      `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, computed_length_m, circuit_id)
       VALUES (?, ?, ?, 'BT', 120, ?)`,
      [tenantId, pole.lastID, pole2.lastID, circuitId]
    );

    const res = await request(app)
      .get(`/api/circuits/${circuitId}/stats`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.circuit_id).toBe(circuitId);
    expect(res.body.total_poles).toBeGreaterThanOrEqual(1);
    expect(res.body.total_conductors).toBeGreaterThanOrEqual(1);
    expect(res.body.total_length_km).toBeGreaterThanOrEqual(0);
    expect(res.body.avg_ahi).toBeDefined();
  });

  it('GET /api/circuits/:id/stats deve retornar 404 para circuito inexistente', async () => {
    const res = await request(app)
      .get('/api/circuits/999999/stats')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/circuits/:id deve remover o circuito', async () => {
    // Create a new one to delete
    const createRes = await request(app)
      .post('/api/circuits')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'Deletar', tenant_id: tenantId });
    const deleteId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/circuits/${deleteId}`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(deleteId);

    // Should be gone
    const checkRes = await request(app)
      .get(`/api/circuits/${deleteId}`)
      .set('x-user-role', 'ADMIN');
    expect(checkRes.status).toBe(404);
  });
});
