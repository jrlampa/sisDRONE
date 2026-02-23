import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

let testPoleId: number;

describe('Poles Summary — GET /api/poles/:id/summary', () => {
  beforeAll(async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018,
      lng: -42.92185,
      name: 'Poste Summary Teste',
      tenant_id: 1,
    });
    expect(res.status).toBe(200);
    testPoleId = res.body.id;
  });

  it('deve retornar 400 para id não numérico', async () => {
    const res = await request(app).get('/api/poles/abc/summary');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 para id = 0', async () => {
    const res = await request(app).get('/api/poles/0/summary');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para poste inexistente', async () => {
    const res = await request(app).get('/api/poles/999999/summary');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 200 com estrutura completa de summary', async () => {
    const res = await request(app).get(`/api/poles/${testPoleId}/summary`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pole');
    expect(res.body.pole.id).toBe(testPoleId);
    expect(res.body.pole).toHaveProperty('ahi_score');
    expect(res.body.pole).toHaveProperty('status');
    expect(res.body).toHaveProperty('last_inspection');
    expect(res.body).toHaveProperty('active_plan');
    expect(res.body).toHaveProperty('inspection_count');
    expect(typeof res.body.inspection_count).toBe('number');
  });

  it('deve retornar last_inspection null quando não há inspeções', async () => {
    const res = await request(app).get(`/api/poles/${testPoleId}/summary`);
    expect(res.status).toBe(200);
    // New pole has no inspections
    expect(res.body.last_inspection).toBeNull();
    expect(res.body.active_plan).toBeNull();
    expect(res.body.inspection_count).toBe(0);
  });
});
