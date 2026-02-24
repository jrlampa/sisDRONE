import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('GET /api/poles/:id/work-orders', () => {
  let poleId: number;
  let workOrderId: number;

  it('setup: create pole and work order', async () => {
    const poleRes = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste WO Test', tenant_id: 1,
    });
    expect(poleRes.status).toBe(200);
    poleId = poleRes.body.id;

    const woRes = await request(app).post('/api/work-orders').send({
      title: 'OS do Poste', priority: 'HIGH', pole_id: poleId,
    });
    expect(woRes.status).toBe(201);
    workOrderId = woRes.body.id;
  });

  it('GET /api/poles/abc/work-orders → 400', async () => {
    const res = await request(app).get('/api/poles/abc/work-orders');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/poles/0/work-orders → 400', async () => {
    const res = await request(app).get('/api/poles/0/work-orders');
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/999999/work-orders → 404', async () => {
    const res = await request(app).get('/api/poles/999999/work-orders');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrado/i);
  });

  it('GET /api/poles/:id/work-orders → 200 with expected shape', async () => {
    const res = await request(app).get(`/api/poles/${poleId}/work-orders`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pole_id', poleId);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.work_orders)).toBe(true);
  });

  it('GET /api/poles/:id/work-orders includes the created work order', async () => {
    const res = await request(app).get(`/api/poles/${poleId}/work-orders`);
    expect(res.status).toBe(200);
    const found = res.body.work_orders.find((wo: any) => wo.id === workOrderId);
    expect(found).toBeDefined();
    expect(found.title).toBe('OS do Poste');
    expect(found.priority).toBe('HIGH');
  });
});

describe('GET /api/work-orders — paginação', () => {
  it('GET /api/work-orders returns paginated shape', async () => {
    const res = await request(app).get('/api/work-orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('work_orders');
    expect(Array.isArray(res.body.work_orders)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 50);
    expect(res.body).toHaveProperty('pages');
  });

  it('GET /api/work-orders?page=1&limit=2 respects limit', async () => {
    const res = await request(app).get('/api/work-orders?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.work_orders.length).toBeLessThanOrEqual(2);
    expect(res.body.limit).toBe(2);
  });

  it('GET /api/work-orders?status=OPEN returns only OPEN', async () => {
    const res = await request(app).get('/api/work-orders?status=OPEN');
    expect(res.status).toBe(200);
    for (const wo of res.body.work_orders) {
      expect(wo.status).toBe('OPEN');
    }
  });
});
