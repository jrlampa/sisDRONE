import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let poleId: number;
let planId: number;

describe('Maintenance Plan by ID — GET /api/maintenance/plan/:planId', () => {
  beforeAll(async () => {
    // Create a pole
    const poleRes = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste Plano Único', tenant_id: 1,
    });
    poleId = poleRes.body.id;

    // Insert a plan directly (no Groq needed in test env)
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO maintenance_plans (pole_id, plan_text, status, estimated_cost)
       VALUES (?, ?, ?, ?)`,
      [poleId, 'Trocar isoladores danificados', 'PENDING', 1500.00]
    );
    planId = result.lastID!;
  });

  it('GET /api/maintenance/plan/abc deve retornar 400', async () => {
    const res = await request(app).get('/api/maintenance/plan/abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/maintenance/plan/0 deve retornar 400', async () => {
    const res = await request(app).get('/api/maintenance/plan/0');
    expect(res.status).toBe(400);
  });

  it('GET /api/maintenance/plan/999999 deve retornar 404', async () => {
    const res = await request(app).get('/api/maintenance/plan/999999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/maintenance/plan/:planId deve retornar o plano criado', async () => {
    const res = await request(app).get(`/api/maintenance/plan/${planId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', planId);
    expect(res.body).toHaveProperty('pole_id', poleId);
  });

  it('GET /api/maintenance/plan/:planId deve ter os campos obrigatórios', async () => {
    const res = await request(app).get(`/api/maintenance/plan/${planId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan_text');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('created_at');
  });
});
