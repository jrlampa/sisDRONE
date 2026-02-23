import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

let testPoleId: number;

describe('AI Predict Endpoint — GET /api/ai/predict/:id', () => {
  beforeAll(async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Predict Test', tenant_id: 1
    });
    expect(res.status).toBe(200);
    testPoleId = res.body.id;
  });

  it('deve retornar 400 para id não numérico', async () => {
    const res = await request(app).get('/api/ai/predict/abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 para id = 0', async () => {
    const res = await request(app).get('/api/ai/predict/0');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para poste inexistente', async () => {
    const res = await request(app).get('/api/ai/predict/999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar previsão válida para poste existente', async () => {
    const res = await request(app).get(`/api/ai/predict/${testPoleId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('estimated_eol_date');
    expect(res.body).toHaveProperty('years_remaining');
    expect(res.body).toHaveProperty('decay_rate');
    expect(res.body).toHaveProperty('confidence');
    expect(res.body).toHaveProperty('health_history');
    expect(Array.isArray(res.body.health_history)).toBe(true);
  });
});
