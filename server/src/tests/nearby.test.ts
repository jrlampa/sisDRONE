import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

// Test coordinates: Nova Friburgo/RJ reference point
const REF_LAT = -22.15018;
const REF_LNG = -42.92185;

describe('Nearby Poles Endpoint', () => {
  it('GET /api/poles/nearby should return 400 if params are missing', async () => {
    const res = await request(app).get('/api/poles/nearby');
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/nearby should return 400 for invalid lat', async () => {
    const res = await request(app).get('/api/poles/nearby?lat=abc&lng=-42.92185&radius=500');
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/nearby should return 400 if radius <= 0', async () => {
    const res = await request(app).get(`/api/poles/nearby?lat=${REF_LAT}&lng=${REF_LNG}&radius=-100`);
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/nearby should return 400 if radius > 50000m', async () => {
    const res = await request(app).get(`/api/poles/nearby?lat=${REF_LAT}&lng=${REF_LNG}&radius=60000`);
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/nearby should return 400 for out-of-range lat', async () => {
    const res = await request(app).get('/api/poles/nearby?lat=200&lng=-42.92185&radius=500');
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/nearby with 100m radius should return result object', async () => {
    const res = await request(app).get(`/api/poles/nearby?lat=${REF_LAT}&lng=${REF_LNG}&radius=100`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('poles');
    expect(Array.isArray(res.body.poles)).toBe(true);
    expect(res.body.radius_m).toBe(100);
    expect(res.body).toHaveProperty('count');
  });

  it('GET /api/poles/nearby with 500m radius should include all poles within 500m', async () => {
    const res = await request(app).get(`/api/poles/nearby?lat=${REF_LAT}&lng=${REF_LNG}&radius=500`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('poles');
    // All returned poles must have distance <= 500m
    for (const pole of res.body.poles) {
      expect(pole.distance_m).toBeLessThanOrEqual(500);
    }
  });

  it('GET /api/poles/nearby with 1km radius should return more than 500m result', async () => {
    const res500 = await request(app).get(`/api/poles/nearby?lat=${REF_LAT}&lng=${REF_LNG}&radius=500`);
    const res1000 = await request(app).get(`/api/poles/nearby?lat=${REF_LAT}&lng=${REF_LNG}&radius=1000`);
    expect(res1000.status).toBe(200);
    // 1km radius should have >= poles than 500m
    expect(res1000.body.count).toBeGreaterThanOrEqual(res500.body.count);
  });

  it('returned poles should be sorted by distance ascending', async () => {
    const res = await request(app).get(`/api/poles/nearby?lat=${REF_LAT}&lng=${REF_LNG}&radius=50000`);
    expect(res.status).toBe(200);
    const poles = res.body.poles;
    for (let i = 1; i < poles.length; i++) {
      expect(poles[i].distance_m).toBeGreaterThanOrEqual(poles[i - 1].distance_m);
    }
  });
});
