import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

// Set test environment
process.env.NODE_ENV = 'test';

describe('API Endpoints', () => {
  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/poles should return an array', async () => {
    const res = await request(app).get('/api/poles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/feedback should return 400 if missing data', async () => {
    const res = await request(app).post('/api/feedback').send({});
    expect(res.status).toBe(400);
  });
});
