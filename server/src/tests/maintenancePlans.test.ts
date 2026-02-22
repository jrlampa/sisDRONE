import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Maintenance Plans API', () => {
  let poleId: number;

  it('POST /api/poles should create a pole for maintenance tests', async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Manutenção Teste', tenant_id: 1
    });
    expect(res.status).toBe(200);
    poleId = res.body.id;
  });

  it('GET /api/maintenance/:poleId should return 200 with empty array for new pole', async () => {
    const res = await request(app).get(`/api/maintenance/${poleId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /api/maintenance/:poleId should return 400 for invalid poleId (abc)', async () => {
    const res = await request(app).get('/api/maintenance/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('GET /api/maintenance/0 should return 400', async () => {
    const res = await request(app).get('/api/maintenance/0');
    expect(res.status).toBe(400);
  });

  it('PATCH /api/maintenance/:planId/status should return 400 for invalid planId', async () => {
    const res = await request(app)
      .patch('/api/maintenance/abc/status')
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/maintenance/:planId/status should return 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/maintenance/1/status')
      .send({ status: 'INVALID_STATUS' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Status/i);
  });
});
