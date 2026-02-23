import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Health Endpoint', () => {
  it('GET /health should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health should return db: connected', async () => {
    const res = await request(app).get('/health');
    expect(res.body.db).toBe('connected');
  });

  it('GET /health should return uptime_s as a number', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.uptime_s).toBe('number');
    expect(res.body.uptime_s).toBeGreaterThanOrEqual(0);
  });

  it('GET /health should return poles count as a number', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.poles).toBe('number');
    expect(res.body.poles).toBeGreaterThanOrEqual(0);
  });

  it('GET /health should return version field', async () => {
    const res = await request(app).get('/health');
    expect(res.body.version).toBe('1.0.0');
  });
});
