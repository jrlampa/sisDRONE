import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

let createdPoleId: number;

describe('Poles CRUD — GET/:id, PUT/:id, DELETE/:id', () => {
  beforeAll(async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste CRUD Test', tenant_id: 1,
    });
    expect(res.status).toBe(200);
    createdPoleId = res.body.id;
  });

  // ── GET /:id ───────────────────────────────────────────────────
  it('GET /api/poles/:id should return 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/poles/abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/poles/:id should return 400 for id=0', async () => {
    const res = await request(app).get('/api/poles/0');
    expect(res.status).toBe(400);
  });

  it('GET /api/poles/:id should return 404 for non-existent pole', async () => {
    const res = await request(app).get('/api/poles/999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/poles/:id should return the pole for valid id', async () => {
    const res = await request(app).get(`/api/poles/${createdPoleId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdPoleId);
    expect(res.body.name).toBe('Poste CRUD Test');
    expect(res.body.lat).toBe(-22.15018);
  });

  // ── PUT /:id ───────────────────────────────────────────────────
  it('PUT /api/poles/:id should return 400 for non-numeric id', async () => {
    const res = await request(app).put('/api/poles/abc').send({ name: 'Novo Nome' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/poles/:id should return 404 for non-existent pole', async () => {
    const res = await request(app).put('/api/poles/999999').send({ name: 'Inexistente' });
    expect(res.status).toBe(404);
  });

  it('PUT /api/poles/:id should return 400 for invalid status', async () => {
    const res = await request(app).put(`/api/poles/${createdPoleId}`).send({ status: 'WRONG' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status inválido');
  });

  it('PUT /api/poles/:id should return 400 if no fields provided', async () => {
    const res = await request(app).put(`/api/poles/${createdPoleId}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Nenhum campo');
  });

  it('PUT /api/poles/:id should update pole fields', async () => {
    const res = await request(app).put(`/api/poles/${createdPoleId}`).send({
      name: 'Poste Atualizado', material: 'Concreto', height: 12, status: 'inspected',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Poste Atualizado');
    expect(res.body.material).toBe('Concreto');
    expect(res.body.status).toBe('inspected');
  });

  // ── DELETE /:id ────────────────────────────────────────────────
  it('DELETE /api/poles/:id should return 400 for non-numeric id', async () => {
    const res = await request(app).delete('/api/poles/abc');
    expect(res.status).toBe(400);
  });

  it('DELETE /api/poles/:id should return 404 for non-existent pole', async () => {
    const res = await request(app).delete('/api/poles/999999');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/poles/:id should delete an existing pole', async () => {
    const res = await request(app).delete(`/api/poles/${createdPoleId}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('removido');
    expect(res.body.id).toBe(createdPoleId);
  });

  it('GET /api/poles/:id should return 404 after deletion', async () => {
    const res = await request(app).get(`/api/poles/${createdPoleId}`);
    expect(res.status).toBe(404);
  });

  // ── Export CSV still works (route ordering) ────────────────────
  it('GET /api/poles/export should still return CSV (not shadowed by /:id)', async () => {
    const res = await request(app).get('/api/poles/export');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/text\/csv/);
  });
});
