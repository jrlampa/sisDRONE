import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('GET /api/poles/:id/history', () => {
  it('should return 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/poles/abc/history');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for id = 0', async () => {
    const res = await request(app).get('/api/poles/0/history');
    expect(res.status).toBe(400);
  });

  it('should return 200 with empty array for pole with no inspections', async () => {
    // Create a pole first
    const create = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Histórico Teste', tenant_id: 1
    });
    expect(create.status).toBe(200);
    const poleId = create.body.id;

    const res = await request(app).get(`/api/poles/${poleId}/history`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should return 200 with array even for non-existent pole id', async () => {
    const res = await request(app).get('/api/poles/99999/history');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});
