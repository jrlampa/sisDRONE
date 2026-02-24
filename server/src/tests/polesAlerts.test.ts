import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('GET /api/poles/alerts', () => {
  it('deve retornar 200 com objeto de alertas', async () => {
    const res = await request(app).get('/api/poles/alerts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('threshold', 30);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('poles');
    expect(Array.isArray(res.body.poles)).toBe(true);
  });

  it('deve retornar apenas postes com AHI < 30', async () => {
    const res = await request(app).get('/api/poles/alerts');
    expect(res.status).toBe(200);
    for (const pole of res.body.poles) {
      expect(pole.ahi_score).toBeLessThan(30);
    }
  });

  it('deve aceitar filtro por tenant_id', async () => {
    const res = await request(app).get('/api/poles/alerts?tenant_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('threshold', 30);
  });

  it('deve retornar alertas ordenados por AHI crescente', async () => {
    const res = await request(app).get('/api/poles/alerts');
    expect(res.status).toBe(200);
    const poles = res.body.poles;
    for (let i = 1; i < poles.length; i++) {
      expect(poles[i].ahi_score).toBeGreaterThanOrEqual(poles[i - 1].ahi_score);
    }
  });
});

describe('GET /api/poles — paginação', () => {
  let totalPoles: number;

  beforeAll(async () => {
    const res = await request(app).get('/api/poles?limit=200');
    expect(res.status).toBe(200);
    totalPoles = res.body.total;
  });

  it('deve retornar estrutura paginada com page, limit, pages, total e poles', async () => {
    const res = await request(app).get('/api/poles?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('poles');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 5);
    expect(res.body).toHaveProperty('pages');
    expect(Array.isArray(res.body.poles)).toBe(true);
    expect(res.body.poles.length).toBeLessThanOrEqual(5);
  });

  it('deve respeitar o limite máximo de 200 registros por página', async () => {
    const res = await request(app).get('/api/poles?limit=9999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
  });

  it('deve usar page=1 e limit=100 como padrão', async () => {
    const res = await request(app).get('/api/poles');
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(100);
  });

  it('total deve ser consistente entre páginas', async () => {
    const res1 = await request(app).get('/api/poles?page=1&limit=5');
    const res2 = await request(app).get('/api/poles?page=2&limit=5');
    expect(res1.body.total).toBe(res2.body.total);
  });
});
