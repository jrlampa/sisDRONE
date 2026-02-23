import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Work Orders Stats — GET /api/work-orders/stats', () => {
  beforeAll(async () => {
    // Seed work orders so stats are non-empty (status defaults to 'OPEN' in DB schema)
    await request(app).post('/api/work-orders').send({
      title: 'Seed Stats 1',
      priority: 'LOW',
    });
    await request(app).post('/api/work-orders').send({
      title: 'Seed Stats 2',
      priority: 'MED',
    });
  });

  it('deve retornar 200 com campos obrigatórios', async () => {
    const res = await request(app).get('/api/work-orders/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('OPEN');
    expect(res.body).toHaveProperty('IN_PROGRESS');
    expect(res.body).toHaveProperty('BLOCKED');
    expect(res.body).toHaveProperty('COMPLETED');
  });

  it('total deve ser um inteiro não-negativo', async () => {
    const res = await request(app).get('/api/work-orders/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it('soma dos status deve igualar total', async () => {
    const res = await request(app).get('/api/work-orders/stats');
    const { total, OPEN, IN_PROGRESS, BLOCKED, COMPLETED } = res.body;
    expect(OPEN + IN_PROGRESS + BLOCKED + COMPLETED).toBe(total);
  });

  it('OPEN deve ser >= 1 após seed (status padrão é OPEN)', async () => {
    const res = await request(app).get('/api/work-orders/stats');
    expect(res.body.OPEN).toBeGreaterThanOrEqual(1);
  });
});
