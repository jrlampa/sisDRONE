import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Video Sessions List — GET /api/video/sessions', () => {
  beforeAll(async () => {
    // Create a pole and a session to ensure list is non-empty
    const poleRes = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Sessions List', tenant_id: 1,
    });
    const poleId = poleRes.body.id;
    await request(app).post('/api/video/session/start').send({
      pole_id: poleId, tenant_id: 1, mode: 'frame',
    });
  });

  it('GET /api/video/sessions deve retornar objeto paginado', async () => {
    const res = await request(app).get('/api/video/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 50);
    expect(res.body).toHaveProperty('pages');
  });

  it('GET /api/video/sessions?limit=1 deve paginar corretamente', async () => {
    const res = await request(app).get('/api/video/sessions?limit=1&page=1');
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });

  it('GET /api/video/sessions?status=recording deve filtrar por status', async () => {
    const res = await request(app).get('/api/video/sessions?status=recording');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    for (const s of res.body.sessions) {
      expect(s.status).toBe('recording');
    }
  });

  it('GET /api/video/sessions?status=completed deve filtrar por status', async () => {
    const res = await request(app).get('/api/video/sessions?status=completed');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });

  it('GET /api/video/sessions?status=invalid deve retornar 400', async () => {
    const res = await request(app).get('/api/video/sessions?status=invalid');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
