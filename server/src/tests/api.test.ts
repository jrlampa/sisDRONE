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
    if (res.status !== 200) console.error('GET /api/poles failed:', res.body);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/feedback should return 400 if missing data', async () => {
    const res = await request(app).post('/api/feedback').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/export should return CSV content', async () => {
    const res = await request(app).get('/api/poles/export');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/csv/);
    // Simple check for header row
    expect(res.text).toContain('id');
    expect(res.text).toContain('name');
    expect(res.text).toContain('lat');
  });
});
