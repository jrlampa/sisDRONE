import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('AI Routes — Validation & Rate Limiting', () => {
  it('GET /api/ai/predict/:id should return 404 for non-existent pole', async () => {
    const res = await request(app).get('/api/ai/predict/99999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/ai/predict/:id should return 404 for string id (treated as no match)', async () => {
    const res = await request(app).get('/api/ai/predict/abc');
    expect(res.status).toBe(404);
  });

  it('POST /api/ai/plan should return 400 when analysis is missing', async () => {
    const res = await request(app).post('/api/ai/plan').send({ poleId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Analysis data is required/i);
  });

  it('POST /api/ai/plan should return 400 when poleId is not a valid integer', async () => {
    const res = await request(app).post('/api/ai/plan').send({ analysis: { condition: 'boa' }, poleId: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/poleId/i);
  });

  it('POST /api/ai/chat should return 400 when message is missing', async () => {
    const res = await request(app).post('/api/ai/chat').send({ context: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message/i);
  });

  it('POST /api/ai/chat should return 400 when message is not a string', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 123 });
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/chat should return 500 when message is valid but Groq service is unreachable in test env', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'Olá!', context: {} });
    expect(res.status).toBe(500);
  });
});
