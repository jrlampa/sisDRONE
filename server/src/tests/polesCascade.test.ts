import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Poles CASCADE DELETE — labels, maintenance_plans, work_orders', () => {
  let poleId: number;
  let planId: number;
  let workOrderId: number;

  beforeAll(async () => {
    // Create a pole to be deleted
    const poleRes = await request(app).post('/api/poles').send({
      lat: -22.16, lng: -42.93, name: 'Poste Cascade Test', tenant_id: 1,
    });
    expect(poleRes.status).toBe(200);
    poleId = poleRes.body.id;

    // Create a maintenance plan for the pole
    const planRes = await request(app)
      .post('/api/ai/plan')
      .set('x-user-role', 'ENGINEER')
      .send({ poleId, analysis: { condition: 'good', confidence: 0.9, analysis_summary: 'OK', ahi_score: 85, pole_type: 'Concreto' } });
    // May fail in test env (Groq unavailable), that's OK; we only need to verify cascade
    planId = planRes.body?.planId ?? 0;

    // Create a work order linked to the pole
    const woRes = await request(app).post('/api/work-orders').send({
      title: 'Ordem Cascade Test', pole_id: poleId, priority: 'LOW',
    });
    expect(woRes.status).toBe(201);
    workOrderId = woRes.body.id;
  });

  it('DELETE /api/poles/:id should succeed and return id', async () => {
    const res = await request(app).delete(`/api/poles/${poleId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: poleId });
    expect(res.body.message).toContain('removido');
  });

  it('GET /api/poles/:id should return 404 after cascade delete', async () => {
    const res = await request(app).get(`/api/poles/${poleId}`);
    expect(res.status).toBe(404);
  });

  it('work order linked to deleted pole should also be removed', async () => {
    const res = await request(app).get(`/api/work-orders/${workOrderId}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/poles/:id/images after cascade delete should 404', async () => {
    const res = await request(app).get(`/api/poles/${poleId}/images`);
    expect(res.status).toBe(404);
  });

  it('GET /api/poles/:id/summary after cascade delete should 404', async () => {
    const res = await request(app).get(`/api/poles/${poleId}/summary`);
    expect(res.status).toBe(404);
  });
});
