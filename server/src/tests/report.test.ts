import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('PDF Report Endpoint', () => {
  let testPoleId: number;

  it('Creates a test pole for PDF report', async () => {
    const res = await request(app).post('/api/poles').send({
      lat: -22.15018, lng: -42.92185,
      name: 'Poste Relatório Teste', tenant_id: 1,
    });
    expect(res.status).toBe(200);
    testPoleId = res.body.id;
    expect(testPoleId).toBeGreaterThan(0);
  });

  it('GET /api/report/pole/:id should return 400 for invalid id', async () => {
    const res = await request(app).get('/api/report/pole/abc');
    expect(res.status).toBe(400);
  });

  it('GET /api/report/pole/:id should return 400 for id=0', async () => {
    const res = await request(app).get('/api/report/pole/0');
    expect(res.status).toBe(400);
  });

  it('GET /api/report/pole/:id should return 404 for non-existent pole', async () => {
    const res = await request(app).get('/api/report/pole/99999');
    expect(res.status).toBe(404);
  });

  it('GET /api/report/pole/:id should return PDF content-type for valid pole', async () => {
    const res = await request(app).get(`/api/report/pole/${testPoleId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain(`.pdf`);
    // PDF starts with %PDF
    expect(res.body).toBeDefined();
  });
});
