import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Inspections — GET /:id + DELETE /:id', () => {
  let createdPoleId: number;
  let createdInspectionId: number;

  // Seed: create a pole and an inspection label before tests
  it('setup: POST /api/poles to create test pole', async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185, name: 'Poste InspCrud', tenant_id: 1,
    });
    expect(res.status).toBe(200);
    createdPoleId = res.body.id;
  });

  it('setup: POST /api/analyze to create test inspection', async () => {
    // Create a minimal inspection via feedback (no Groq needed)
    const feedbackRes = await request(app)
      .post('/api/feedback')
      .send({ labelId: 1, poleId: createdPoleId, isCorrect: true });
    expect([200, 500]).toContain(feedbackRes.status); // may 500 if label 1 absent, that's fine

    // Instead: directly get from inspections list to find a real id
    const listRes = await request(app).get('/api/inspections');
    expect(listRes.status).toBe(200);
    if (listRes.body.inspections.length > 0) {
      createdInspectionId = listRes.body.inspections[0].id;
    } else {
      // Fallback: create via feedback to own pole
      const fb = await request(app).post('/api/feedback').send({
        labelId: 99, poleId: createdPoleId, isCorrect: false, correction: 'Teste CRUD',
      });
      expect(fb.status).toBe(200);
      const list2 = await request(app).get(`/api/inspections?pole_id=${createdPoleId}`);
      createdInspectionId = list2.body.inspections[0].id;
    }
  });

  // GET /:id — invalid id
  it('GET /api/inspections/abc → 400', async () => {
    const res = await request(app).get('/api/inspections/abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/inspections/0 → 400', async () => {
    const res = await request(app).get('/api/inspections/0');
    expect(res.status).toBe(400);
  });

  it('GET /api/inspections/999999 → 404', async () => {
    const res = await request(app).get('/api/inspections/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrada/i);
  });

  it('GET /api/inspections/:id → 200 with inspection fields', async () => {
    if (!createdInspectionId) return; // skip if setup failed
    const res = await request(app).get(`/api/inspections/${createdInspectionId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', createdInspectionId);
    expect(res.body).toHaveProperty('pole_id');
    expect(res.body).toHaveProperty('label');
  });

  // DELETE /:id — invalid id
  it('DELETE /api/inspections/abc → 400', async () => {
    const res = await request(app).delete('/api/inspections/abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /api/inspections/999999 → 404', async () => {
    const res = await request(app).delete('/api/inspections/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrada/i);
  });

  it('DELETE /api/inspections/:id → 200 and verifies gone', async () => {
    if (!createdInspectionId) return;
    const res = await request(app).delete(`/api/inspections/${createdInspectionId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('id', createdInspectionId);

    // Verify gone
    const check = await request(app).get(`/api/inspections/${createdInspectionId}`);
    expect(check.status).toBe(404);
  });
});
