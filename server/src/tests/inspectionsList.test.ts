import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Listar Inspeções — GET /api/inspections', () => {
  it('deve retornar 200 com estrutura paginada', async () => {
    const res = await request(app).get('/api/inspections');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('inspections');
    expect(Array.isArray(res.body.inspections)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('pages');
  });

  it('deve aceitar ?page=1&limit=5 e retornar ≤ 5 itens', async () => {
    const res = await request(app).get('/api/inspections?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.inspections.length).toBeLessThanOrEqual(5);
    expect(res.body.limit).toBe(5);
    expect(res.body.page).toBe(1);
  });

  it('deve filtrar por pole_id válido', async () => {
    const res = await request(app).get('/api/inspections?pole_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('inspections');
    // All returned items must belong to pole_id 1 (if any)
    for (const insp of res.body.inspections) {
      expect(insp.pole_id).toBe(1);
    }
  });

  it('deve ignorar pole_id inválido (NaN) e retornar todos', async () => {
    const res = await request(app).get('/api/inspections?pole_id=abc');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
  });

  it('deve respeitar limit máximo de 200', async () => {
    const res = await request(app).get('/api/inspections?limit=9999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
  });

  it('cada inspeção deve ter campo pole_id e label', async () => {
    const res = await request(app).get('/api/inspections?limit=10');
    expect(res.status).toBe(200);
    for (const insp of res.body.inspections) {
      expect(insp).toHaveProperty('pole_id');
      expect(insp).toHaveProperty('label');
    }
  });
});
