import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

describe('GET /api/inspections — source filter', () => {
  beforeAll(async () => {
    const db = await getDb();
    // Seed a pole + labels with different sources for testing
    const poleRes = await db.run(
      "INSERT INTO poles (name, lat, lng, tenant_id) VALUES ('Source Test Pole', -22.15, -42.92, 1)"
    );
    const poleId = poleRes.lastID!;
    await db.run(
      "INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, 'AI Label', 0.9, 'ai')",
      [poleId]
    );
    await db.run(
      "INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, 'User Label', 1.0, 'user')",
      [poleId]
    );
    await db.run(
      "INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, 'Manual Label', 1.0, 'manual')",
      [poleId]
    );
  });

  it('should return all inspections when no source filter', async () => {
    const res = await request(app)
      .get('/api/inspections')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.inspections).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });

  it('should filter by source=ai', async () => {
    const res = await request(app)
      .get('/api/inspections?source=ai')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.inspections.every((i: { source: string }) => i.source === 'ai')).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('should filter by source=user', async () => {
    const res = await request(app)
      .get('/api/inspections?source=user')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.inspections.every((i: { source: string }) => i.source === 'user')).toBe(true);
  });

  it('should filter by source=manual', async () => {
    const res = await request(app)
      .get('/api/inspections?source=manual')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.inspections.every((i: { source: string }) => i.source === 'manual')).toBe(true);
  });

  it('should ignore invalid source value (no filter applied)', async () => {
    const res = await request(app)
      .get('/api/inspections?source=invalid_source')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    // Invalid source is ignored, all inspections are returned
    expect(res.body.inspections).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });

  it('should combine pole_id and source filters', async () => {
    // Get the test pole id first
    const db = await getDb();
    const pole = await db.get("SELECT id FROM poles WHERE name = 'Source Test Pole'");
    const res = await request(app)
      .get(`/api/inspections?pole_id=${pole.id}&source=ai`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.inspections.every((i: { source: string; pole_id: number }) =>
      i.source === 'ai' && i.pole_id === pole.id
    )).toBe(true);
  });
});
