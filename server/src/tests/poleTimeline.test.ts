/**
 * poleTimeline.test.ts — Phase 45: Timeline de Inspeções por Poste
 * Tests for GET /api/poles/:id/timeline
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let timelinePoleId: number;
let emptyTimelinePoleId: number;

describe('Pole Timeline — GET /api/poles/:id/timeline', () => {
  beforeAll(async () => {
    const db = await getDb();
    const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
    const tenantId = tenant?.id ?? 1;

    // Poste A — com inspeção e 2 snapshots AHI
    const rA = await db.run(
      `INSERT INTO poles (tenant_id, name, lat, lng, status, ahi_score)
       VALUES (?, 'Timeline-Pole-A', -22.15050, -42.92150, 'good', 80)`,
      [tenantId]
    );
    timelinePoleId = rA.lastID!;

    await db.run(
      `INSERT INTO labels (pole_id, label, confidence, source, created_at)
       VALUES (?, 'Bom', 0.95, 'ai', '2025-06-01 10:00:00')`,
      [timelinePoleId]
    );
    await db.run(
      `INSERT INTO ahi_history (pole_id, tenant_id, ahi_score, recorded_at)
       VALUES (?, ?, 70, '2025-01-01 08:00:00')`,
      [timelinePoleId, tenantId]
    );
    await db.run(
      `INSERT INTO ahi_history (pole_id, tenant_id, ahi_score, recorded_at)
       VALUES (?, ?, 80, '2025-06-01 09:00:00')`,
      [timelinePoleId, tenantId]
    );

    // Poste B — sem nenhum evento
    const rB = await db.run(
      `INSERT INTO poles (tenant_id, name, lat, lng, status)
       VALUES (?, 'Timeline-Pole-Empty', -22.15060, -42.92160, 'good')`,
      [tenantId]
    );
    emptyTimelinePoleId = rB.lastID!;
  });

  it('deve retornar 400 para id não numérico', async () => {
    const res = await request(app).get('/api/poles/abc/timeline');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 para id = 0', async () => {
    const res = await request(app).get('/api/poles/0/timeline');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para poste inexistente', async () => {
    const res = await request(app).get('/api/poles/999999/timeline');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar timeline com inspection e ahi_snapshot', async () => {
    const res = await request(app).get(`/api/poles/${timelinePoleId}/timeline`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pole_id', timelinePoleId);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('timeline');
    expect(Array.isArray(res.body.timeline)).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(3); // 1 inspection + 2 AHI snapshots
  });

  it('deve conter campos corretos na entrada de inspeção', async () => {
    const res = await request(app).get(`/api/poles/${timelinePoleId}/timeline`);
    expect(res.status).toBe(200);
    const entry = res.body.timeline.find((e: { type: string }) => e.type === 'inspection');
    expect(entry).toBeDefined();
    expect(entry).toHaveProperty('label', 'Bom');
    expect(entry).toHaveProperty('confidence', 0.95);
    expect(entry).toHaveProperty('source', 'ai');
    expect(entry).toHaveProperty('date');
  });

  it('deve calcular delta_ahi entre snapshots consecutivos', async () => {
    const res = await request(app).get(`/api/poles/${timelinePoleId}/timeline`);
    expect(res.status).toBe(200);
    const ahiEntries = res.body.timeline.filter((e: { type: string }) => e.type === 'ahi_snapshot');
    expect(ahiEntries.length).toBe(2);
    // Most recent snapshot (80) — delta = 80 - 70 = +10
    const recent = ahiEntries[0];
    expect(recent.ahi_score).toBe(80);
    expect(recent.delta_ahi).toBe(10);
    // Oldest snapshot (70) — delta = null (no older entry)
    const oldest = ahiEntries[1];
    expect(oldest.ahi_score).toBe(70);
    expect(oldest.delta_ahi).toBeNull();
  });

  it('deve retornar timeline vazia para poste sem histórico', async () => {
    const res = await request(app).get(`/api/poles/${emptyTimelinePoleId}/timeline`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.timeline).toEqual([]);
  });
});
