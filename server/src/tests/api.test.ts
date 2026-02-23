import { describe, it, expect } from 'vitest';
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

  it('GET /api/poles?tenant_id=1 should filter by tenant', async () => {
    const res = await request(app).get('/api/poles?tenant_id=1');
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

  it('GET /api/tenants should return a list', async () => {
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/tenants/:id should return 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/tenants/abc');
    expect(res.status).toBe(400);
  });

  it('GET /api/tenants/:id should return 404 for missing tenant', async () => {
    const res = await request(app).get('/api/tenants/9999');
    expect(res.status).toBe(404);
  });

  it('GET /api/users should return a list', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Work Orders API', () => {
  it('GET /api/work-orders should return an array', async () => {
    const res = await request(app).get('/api/work-orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/work-orders should return 400 if title is missing', async () => {
    const res = await request(app).post('/api/work-orders').send({ description: 'Sem título' });
    expect(res.status).toBe(400);
  });

  it('POST /api/work-orders should create a work order with valid data', async () => {
    const res = await request(app).post('/api/work-orders').send({
      title: 'Substituir poste', description: 'Poste danificado por veículo', priority: 'HIGH'
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Substituir poste');
    expect(res.body.priority).toBe('HIGH');
  });

  it('GET /api/work-orders?status=INVALID should return 400', async () => {
    const res = await request(app).get('/api/work-orders?status=INVALID');
    expect(res.status).toBe(400);
  });

  it('PUT /api/work-orders/:id should return 400 for invalid id', async () => {
    const res = await request(app).put('/api/work-orders/abc').send({ status: 'OPEN' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/work-orders/:id should update status', async () => {
    // First create one
    const createRes = await request(app).post('/api/work-orders').send({ title: 'OS para atualizar' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    const res = await request(app).put(`/api/work-orders/${id}`).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('PUT /api/work-orders/:id should return 400 for invalid status', async () => {
    const createRes = await request(app).post('/api/work-orders').send({ title: 'OS status inválido' });
    const id = createRes.body.id;
    const res = await request(app).put(`/api/work-orders/${id}`).send({ status: 'WRONG_STATUS' });
    expect(res.status).toBe(400);
  });

  it('GET /api/work-orders/:id should return 400 for invalid id', async () => {
    const res = await request(app).get('/api/work-orders/abc');
    expect(res.status).toBe(400);
  });

  it('GET /api/work-orders/:id should return 404 for non-existent id', async () => {
    const res = await request(app).get('/api/work-orders/999999');
    expect(res.status).toBe(404);
  });

  it('GET /api/work-orders/:id should return a single work order', async () => {
    const createRes = await request(app).post('/api/work-orders').send({ title: 'OS para busca individual' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    const res = await request(app).get(`/api/work-orders/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.title).toBe('OS para busca individual');
  });
});

describe('Maintenance API', () => {
  it('GET /api/maintenance/:poleId should return 400 for invalid poleId', async () => {
    const res = await request(app).get('/api/maintenance/abc');
    expect(res.status).toBe(400);
  });

  it('GET /api/maintenance/:poleId should return an array for valid poleId', async () => {
    const res = await request(app).get('/api/maintenance/1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH /api/maintenance/:planId/status should return 400 for invalid planId', async () => {
    const res = await request(app).patch('/api/maintenance/abc/status').send({ status: 'COMPLETED' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/maintenance/:planId/status should return 400 for invalid status', async () => {
    const res = await request(app).patch('/api/maintenance/1/status').send({ status: 'INVALID' });
    expect(res.status).toBe(400);
  });
});

