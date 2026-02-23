import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Poles Images — GET /api/poles/:id/images', () => {
  let poleId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.151, lng: -42.922, name: 'Poste Imagens Test', tenant_id: 1,
    });
    expect(res.status).toBe(200);
    poleId = res.body.id;
  });

  it('GET /api/poles/abc/images should return 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/poles/abc/images');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/poles/0/images should return 400 for id=0', async () => {
    const res = await request(app).get('/api/poles/0/images');
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/999999/images should return 404 for non-existent pole', async () => {
    const res = await request(app).get('/api/poles/999999/images');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/poles/:id/images should return 200 with images array for existing pole', async () => {
    const res = await request(app).get(`/api/poles/${poleId}/images`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pole_id', poleId);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });
});
