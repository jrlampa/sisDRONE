/**
 * ahiHistory.test.ts — Phase 34: Histórico de AHI (Série Temporal)
 * Tests for GET /api/poles/:id/ahi-history
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;
let poleWithHistId: number;
let poleEmptyId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Pole with AHI history
  const rA = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status, ahi_score)
     VALUES (?, 'AHI-Hist-Pole', -22.15100, -42.92200, 'good', 75)`,
    [tenantId]
  );
  poleWithHistId = rA.lastID!;

  // Insert 3 AHI snapshots
  await db.run('INSERT INTO ahi_history (pole_id, tenant_id, ahi_score, recorded_at) VALUES (?, ?, ?, ?)',
    [poleWithHistId, tenantId, 90, '2025-01-01 10:00:00']);
  await db.run('INSERT INTO ahi_history (pole_id, tenant_id, ahi_score, recorded_at) VALUES (?, ?, ?, ?)',
    [poleWithHistId, tenantId, 80, '2025-06-01 10:00:00']);
  await db.run('INSERT INTO ahi_history (pole_id, tenant_id, ahi_score, recorded_at) VALUES (?, ?, ?, ?)',
    [poleWithHistId, tenantId, 75, '2026-01-01 10:00:00']);

  // Pole with no history
  const rB = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'AHI-Empty-Pole', -22.15200, -42.92300, 'good')`,
    [tenantId]
  );
  poleEmptyId = rB.lastID!;
});

describe('Phase 34 — GET /api/poles/:id/ahi-history', () => {
  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app)
      .get('/api/poles/abc/ahi-history')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/);
  });

  it('deve retornar 404 para poste inexistente', async () => {
    const res = await request(app)
      .get('/api/poles/999999/ahi-history')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(404);
  });

  it('deve retornar array vazio para poste sem histórico', async () => {
    const res = await request(app)
      .get(`/api/poles/${poleEmptyId}/ahi-history`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.history).toEqual([]);
    expect(res.body.pole_id).toBe(poleEmptyId);
  });

  it('deve retornar o histórico com campos obrigatórios', async () => {
    const res = await request(app)
      .get(`/api/poles/${poleWithHistId}/ahi-history`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(Array.isArray(res.body.history)).toBe(true);

    const entry = res.body.history[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('pole_id');
    expect(entry).toHaveProperty('ahi_score');
    expect(entry).toHaveProperty('recorded_at');
  });

  it('deve retornar em ordem decrescente (mais recente primeiro)', async () => {
    const res = await request(app)
      .get(`/api/poles/${poleWithHistId}/ahi-history`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    const dates = res.body.history.map((h: { recorded_at: string }) => h.recorded_at);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });

  it('deve respeitar o parâmetro limit', async () => {
    const res = await request(app)
      .get(`/api/poles/${poleWithHistId}/ahi-history?limit=2`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeLessThanOrEqual(2);
    expect(res.body.history.length).toBeLessThanOrEqual(2);
  });
});
