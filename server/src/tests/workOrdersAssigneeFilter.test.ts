import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

let assigneeId: number;
let woId: number;

beforeAll(async () => {
  const db = await getDb();
  // Get an existing user to assign to
  const user = await db.get(`SELECT id FROM users WHERE role != 'ADMIN' LIMIT 1`);
  assigneeId = user?.id ?? 1;
  // Create a work order assigned to that user
  const woResult = await db.run(
    `INSERT INTO work_orders (title, priority, assignee_id) VALUES ('OS para filtro de designação', 'MED', ?)`,
    [assigneeId]
  );
  woId = woResult.lastID!;
});

describe('Work Orders assignee_id filter', () => {
  it('should filter work orders by assignee_id', async () => {
    const res = await request(app)
      .get(`/api/work-orders?assignee_id=${assigneeId}`)
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('work_orders');
    expect(res.body.work_orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.work_orders.every((w: any) => w.assignee_id === assigneeId)).toBe(true);
  });

  it('should return 400 for non-numeric assignee_id', async () => {
    const res = await request(app)
      .get('/api/work-orders?assignee_id=abc')
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee_id inválido/i);
  });

  it('should return 400 for zero assignee_id', async () => {
    const res = await request(app)
      .get('/api/work-orders?assignee_id=0')
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(400);
  });

  it('should return empty list when no work orders for unknown assignee_id', async () => {
    const res = await request(app)
      .get('/api/work-orders?assignee_id=999999')
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(200);
    expect(res.body.work_orders).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('should combine assignee_id with status filter', async () => {
    const res = await request(app)
      .get(`/api/work-orders?assignee_id=${assigneeId}&status=OPEN`)
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('work_orders');
    res.body.work_orders.forEach((w: any) => {
      expect(w.assignee_id).toBe(assigneeId);
      expect(w.status).toBe('OPEN');
    });
  });

  // Clean up: verify the created WO is in the list
  it('should include the seeded WO in assignee filter results', async () => {
    const res = await request(app)
      .get(`/api/work-orders?assignee_id=${assigneeId}`)
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(200);
    const ids = res.body.work_orders.map((w: any) => w.id);
    expect(ids).toContain(woId);
  });
});
