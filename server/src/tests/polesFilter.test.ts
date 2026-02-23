import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('GET /api/poles — filtros ahi_min, ahi_max, status', () => {
  it('deve filtrar por ahi_min', async () => {
    const res = await request(app).get('/api/poles?ahi_min=50');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('poles');
    for (const pole of res.body.poles) {
      if (pole.ahi_score !== null) {
        expect(pole.ahi_score).toBeGreaterThanOrEqual(50);
      }
    }
  });

  it('deve filtrar por ahi_max', async () => {
    const res = await request(app).get('/api/poles?ahi_max=80');
    expect(res.status).toBe(200);
    for (const pole of res.body.poles) {
      if (pole.ahi_score !== null) {
        expect(pole.ahi_score).toBeLessThanOrEqual(80);
      }
    }
  });

  it('deve filtrar por ahi_min e ahi_max combinados', async () => {
    const res = await request(app).get('/api/poles?ahi_min=40&ahi_max=90');
    expect(res.status).toBe(200);
    for (const pole of res.body.poles) {
      if (pole.ahi_score !== null) {
        expect(pole.ahi_score).toBeGreaterThanOrEqual(40);
        expect(pole.ahi_score).toBeLessThanOrEqual(90);
      }
    }
  });

  it('deve filtrar por status', async () => {
    const res = await request(app).get('/api/poles?status=pending');
    expect(res.status).toBe(200);
    for (const pole of res.body.poles) {
      expect(pole.status).toBe('pending');
    }
  });

  it('deve combinar tenant_id e ahi_min', async () => {
    const res = await request(app).get('/api/poles?tenant_id=1&ahi_min=0');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    for (const pole of res.body.poles) {
      expect(pole.tenant_id).toBe(1);
    }
  });

  it('deve retornar lista vazia quando nenhum polo satisfaz o filtro', async () => {
    const res = await request(app).get('/api/poles?ahi_min=999');
    expect(res.status).toBe(200);
    expect(res.body.poles).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

describe('GET /api/poles/heatmap', () => {
  it('deve retornar 200 com count e points', async () => {
    const res = await request(app).get('/api/poles/heatmap');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('points');
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body.count).toBe(res.body.points.length);
  });

  it('deve retornar apenas campos leves (id, lat, lng, ahi_score, name)', async () => {
    const res = await request(app).get('/api/poles/heatmap');
    expect(res.status).toBe(200);
    if (res.body.points.length > 0) {
      const point = res.body.points[0];
      expect(point).toHaveProperty('id');
      expect(point).toHaveProperty('lat');
      expect(point).toHaveProperty('lng');
      expect(point).toHaveProperty('ahi_score');
      expect(point).toHaveProperty('name');
      // Deve NÃO ter campos pesados como utm_x, material, etc.
      expect(point).not.toHaveProperty('utm_x');
      expect(point).not.toHaveProperty('material');
    }
  });

  it('deve aceitar filtro por tenant_id', async () => {
    const res = await request(app).get('/api/poles/heatmap?tenant_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
  });
});
