import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('GET /api/video/session/:id', () => {
  let sessionId: number;
  let poleId: number;

  it('POST /api/poles should create test pole', async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Sessão GET Teste', tenant_id: 1
    });
    expect(res.status).toBe(200);
    poleId = res.body.id;
    expect(poleId).toBeGreaterThan(0);
  });

  it('POST /api/video/session/start should create session for GET test', async () => {
    const res = await request(app).post('/api/video/session/start').send({
      pole_id: poleId || 1, tenant_id: 1, mode: 'frame'
    });
    expect(res.status).toBe(201);
    sessionId = res.body.sessionId;
    expect(sessionId).toBeGreaterThan(0);
  });

  it('GET /api/video/session/:id should return 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/video/session/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/i);
  });

  it('GET /api/video/session/:id should return 400 for id=0', async () => {
    const res = await request(app).get('/api/video/session/0');
    expect(res.status).toBe(400);
  });

  it('GET /api/video/session/:id should return 404 for non-existent session', async () => {
    const res = await request(app).get('/api/video/session/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrada/i);
  });

  it('GET /api/video/session/:id should return session with correct fields', async () => {
    const res = await request(app).get(`/api/video/session/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', sessionId);
    expect(res.body).toHaveProperty('pole_id', poleId);
    expect(res.body).toHaveProperty('mode', 'frame');
    expect(res.body).toHaveProperty('status', 'recording');
    expect(res.body).toHaveProperty('frame_count', 0);
  });
});
