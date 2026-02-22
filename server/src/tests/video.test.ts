import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Video Analysis API', () => {
  let sessionId: number;
  let poleId: number;

  // Create a pole to use in video tests
  it('POST /api/poles should create a test pole', async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Vídeo Teste', tenant_id: 1
    });
    expect(res.status).toBe(200);
    poleId = res.body.id;
    expect(poleId).toBeGreaterThan(0);
  });

  describe('Session Management', () => {
    it('POST /api/video/session/start should return 400 if pole_id missing', async () => {
      const res = await request(app).post('/api/video/session/start').send({ mode: 'frame' });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/session/start should return 400 for invalid mode', async () => {
      const res = await request(app).post('/api/video/session/start').send({ pole_id: 1, mode: 'streaming' });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/session/start should create a frame session', async () => {
      const res = await request(app).post('/api/video/session/start').send({
        pole_id: poleId || 1, tenant_id: 1, mode: 'frame'
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('sessionId');
      expect(res.body.mode).toBe('frame');
      expect(res.body.status).toBe('recording');
      sessionId = res.body.sessionId;
    });

    it('POST /api/video/session/start should create a recording session', async () => {
      const res = await request(app).post('/api/video/session/start').send({
        pole_id: poleId || 1, tenant_id: 1, mode: 'recording'
      });
      expect(res.status).toBe(201);
      expect(res.body.mode).toBe('recording');
    });
  });

  describe('Frame Analysis', () => {
    it('POST /api/video/frame should return 400 if image missing', async () => {
      const res = await request(app).post('/api/video/frame').send({ pole_id: 1 });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/frame should return 400 if pole_id missing', async () => {
      const res = await request(app).post('/api/video/frame').send({ image: 'base64data' });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/frame should return 400 for invalid pole_id', async () => {
      const res = await request(app).post('/api/video/frame').send({
        pole_id: 'abc', image: 'base64data'
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/frame should return 400 for oversized image', async () => {
      const bigImage = 'A'.repeat(11_000_000);
      const res = await request(app).post('/api/video/frame').send({
        pole_id: 1, image: bigImage
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Video Upload (Offline Chunks)', () => {
    it('POST /api/video/upload should return 400 if chunk missing', async () => {
      const res = await request(app).post('/api/video/upload').send({
        pole_id: 1, sessionId: 1, chunkIndex: 0
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/upload should return 400 if sessionId invalid', async () => {
      const res = await request(app).post('/api/video/upload').send({
        pole_id: 1, sessionId: 'abc', chunk: 'base64chunk', chunkIndex: 0
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/upload should return 400 if pole_id invalid', async () => {
      const res = await request(app).post('/api/video/upload').send({
        pole_id: 0, sessionId: 1, chunk: 'base64chunk', chunkIndex: 0
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/video/upload should accept valid chunk', async () => {
      const validChunk = Buffer.from('test video chunk data').toString('base64');
      const res = await request(app).post('/api/video/upload').send({
        pole_id: poleId || 1,
        sessionId: sessionId || 1,
        chunk: validChunk,
        chunkIndex: 0,
        totalChunks: 1,
        isLast: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('chunk_received');
    });
  });

  describe('Session Complete & List', () => {
    it('POST /api/video/session/:id/complete should return 400 for invalid id', async () => {
      const res = await request(app).post('/api/video/session/abc/complete');
      expect(res.status).toBe(400);
    });

    it('POST /api/video/session/:id/complete should return 404 for non-existent session', async () => {
      const res = await request(app).post('/api/video/session/99999/complete');
      expect(res.status).toBe(404);
    });

    it('POST /api/video/session/:id/complete should complete an existing session', async () => {
      const res = await request(app).post(`/api/video/session/${sessionId}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
    });

    it('GET /api/video/sessions/:poleId should return 400 for invalid poleId', async () => {
      const res = await request(app).get('/api/video/sessions/abc');
      expect(res.status).toBe(400);
    });

    it('GET /api/video/sessions/:poleId should return an array', async () => {
      const res = await request(app).get(`/api/video/sessions/${poleId || 1}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
