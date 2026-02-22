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

  it('POST /api/poles should return 400 if lat/lng are missing', async () => {
    const res = await request(app).post('/api/poles').send({ name: 'Teste' });
    expect(res.status).toBe(400);
  });

  it('POST /api/poles should return 400 if lat/lng are out of range', async () => {
    const res = await request(app).post('/api/poles').send({ lat: 200, lng: 300, name: 'Fora de range' });
    expect(res.status).toBe(400);
  });

  it('POST /api/poles should create a pole with valid data', async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Teste', tenant_id: 1
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Poste Teste');
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

  it('GET /api/poles/stats should return dashboard stats', async () => {
    const res = await request(app).get('/api/poles/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalPoles');
    expect(res.body).toHaveProperty('conditionStats');
  });

  it('GET /api/gis/export/geojson should return FeatureCollection', async () => {
    const res = await request(app).get('/api/gis/export/geojson');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.features)).toBe(true);
  });

  it('POST /api/gis/import/geojson should return 400 for invalid GeoJSON', async () => {
    const res = await request(app).post('/api/gis/import/geojson').send({ geojson: { type: 'Invalid' } });
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/:id/history should return 400 for invalid id', async () => {
    const res = await request(app).get('/api/abc/history');
    expect(res.status).toBe(400);
  });
});

