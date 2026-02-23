import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Tenants Endpoint — /api/tenants', () => {
  it('GET /api/tenants deve retornar 200 com array de tenants', async () => {
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/tenants cada tenant deve ter id, name e cores', async () => {
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(200);
    for (const t of res.body) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('primary_color');
      expect(t).toHaveProperty('accent_color');
    }
  });

  it('GET /api/tenants/:id deve retornar 200 para id válido', async () => {
    const res = await request(app).get('/api/tenants/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body).toHaveProperty('name');
  });

  it('GET /api/tenants/:id deve retornar 400 para id não numérico', async () => {
    const res = await request(app).get('/api/tenants/abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/tenants/:id deve retornar 404 para id inexistente', async () => {
    const res = await request(app).get('/api/tenants/999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/tenants/:id deve retornar 400 para id=0', async () => {
    const res = await request(app).get('/api/tenants/0');
    expect(res.status).toBe(400);
  });
});
