import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Inspections — PUT /:id', () => {
  let targetId: number;

  it('setup: get an existing inspection id', async () => {
    const listRes = await request(app).get('/api/inspections');
    expect(listRes.status).toBe(200);

    if (listRes.body.inspections.length > 0) {
      targetId = listRes.body.inspections[0].id;
    } else {
      // Create a pole and inspection for testing
      const poleRes = await request(app).post('/api/poles').send({
        lat: -22.15018, lng: -42.92185, name: 'Poste PUT Insp', tenant_id: 1,
      });
      expect(poleRes.status).toBe(200);
      const feedRes = await request(app).post('/api/feedback').send({
        labelId: 99, poleId: poleRes.body.id, isCorrect: false, correction: 'Test PUT',
      });
      expect(feedRes.status).toBe(200);
      const list2 = await request(app).get(`/api/inspections?pole_id=${poleRes.body.id}`);
      targetId = list2.body.inspections[0].id;
    }
  });

  it('PUT /api/inspections/abc → 400 (invalid id)', async () => {
    const res = await request(app).put('/api/inspections/abc').send({ label: 'Teste' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('PUT /api/inspections/0 → 400 (id=0 invalid)', async () => {
    const res = await request(app).put('/api/inspections/0').send({ label: 'Teste' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/inspections/999999 → 404 (not found)', async () => {
    const res = await request(app).put('/api/inspections/999999').send({ label: 'Teste' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrada/i);
  });

  it('PUT /api/inspections/:id with no fields → 400', async () => {
    if (!targetId) return;
    const res = await request(app).put(`/api/inspections/${targetId}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nenhum campo/i);
  });

  it('PUT /api/inspections/:id with confidence out of range → 400', async () => {
    if (!targetId) return;
    const res = await request(app).put(`/api/inspections/${targetId}`).send({ confidence: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/confidence/i);
  });

  it('PUT /api/inspections/:id with invalid source → 400', async () => {
    if (!targetId) return;
    const res = await request(app).put(`/api/inspections/${targetId}`).send({ source: 'robot' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source inválido/i);
  });

  it('PUT /api/inspections/:id → 200 updates label', async () => {
    if (!targetId) return;
    const res = await request(app)
      .put(`/api/inspections/${targetId}`)
      .send({ label: 'Cabo danificado — corrigido', confidence: 0.95, source: 'user' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', targetId);
    expect(res.body.label).toBe('Cabo danificado — corrigido');
    expect(res.body.confidence).toBeCloseTo(0.95, 2);
    expect(res.body.source).toBe('user');
  });
});
