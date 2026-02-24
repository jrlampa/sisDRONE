import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

let poleId: number;
let woId: number;

beforeAll(async () => {
  const db = await getDb();
  // Create a pole to link
  const poleResult = await db.run(
    `INSERT INTO poles (name, lat, lng, tenant_id) VALUES ('Poste WO Filter', -22.151, -42.922, 1)`
  );
  poleId = poleResult.lastID!;
  // Create a work order linked to that pole
  const woResult = await db.run(
    `INSERT INTO work_orders (title, priority, pole_id) VALUES ('OS vinculada ao poste', 'HIGH', ?)`,
    [poleId]
  );
  woId = woResult.lastID!;
});

describe('Work Orders pole_id filter', () => {
  it('should filter work orders by pole_id', async () => {
    const res = await request(app)
      .get(`/api/work-orders?pole_id=${poleId}`)
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('work_orders');
    expect(res.body.work_orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.work_orders.every((w: any) => w.pole_id === poleId)).toBe(true);
  });

  it('should return 400 for non-numeric pole_id', async () => {
    const res = await request(app)
      .get('/api/work-orders?pole_id=abc')
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pole_id inválido/i);
  });

  it('should return 400 for zero pole_id', async () => {
    const res = await request(app)
      .get('/api/work-orders?pole_id=0')
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pole_id inválido/i);
  });

  it('should return empty list when no work orders for that pole_id', async () => {
    const res = await request(app)
      .get('/api/work-orders?pole_id=999999')
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(200);
    expect(res.body.work_orders).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('should combine pole_id with status filter', async () => {
    const res = await request(app)
      .get(`/api/work-orders?pole_id=${poleId}&status=OPEN`)
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('work_orders');
    // All results should match both filters
    res.body.work_orders.forEach((w: any) => {
      expect(w.pole_id).toBe(poleId);
      expect(w.status).toBe('OPEN');
    });
  });
});
