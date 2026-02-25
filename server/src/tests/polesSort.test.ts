import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Poles Sort — GET /api/poles?sort=', () => {
  // Ensure at least two seeded poles exist (seeds.ts provides them)
  beforeAll(async () => {
    const res = await request(app).get('/api/poles');
    expect(res.status).toBe(200);
    expect(res.body.poles.length).toBeGreaterThan(0);
  });

  it('GET /api/poles?sort=ahi_asc deve ordenar por AHI crescente', async () => {
    const res = await request(app).get('/api/poles?sort=ahi_asc');
    expect(res.status).toBe(200);
    const poles = res.body.poles.filter((p: { ahi_score: number | null }) => p.ahi_score !== null);
    for (let i = 1; i < poles.length; i++) {
      expect(poles[i - 1].ahi_score).toBeLessThanOrEqual(poles[i].ahi_score);
    }
  });

  it('GET /api/poles?sort=ahi_desc deve ordenar por AHI decrescente', async () => {
    const res = await request(app).get('/api/poles?sort=ahi_desc');
    expect(res.status).toBe(200);
    const poles = res.body.poles.filter((p: { ahi_score: number | null }) => p.ahi_score !== null);
    for (let i = 1; i < poles.length; i++) {
      expect(poles[i - 1].ahi_score).toBeGreaterThanOrEqual(poles[i].ahi_score);
    }
  });

  it('GET /api/poles?sort=name_asc deve ordenar por nome crescente', async () => {
    const res = await request(app).get('/api/poles?sort=name_asc');
    expect(res.status).toBe(200);
    const names: string[] = res.body.poles.map((p: { name: string }) => p.name);
    // Verify monotonic ascending order matching SQLite's 'name ASC' (byte-order, case-sensitive)
    // This is locale-neutral and matches SQLite's default string sort.
    for (let i = 1; i < names.length; i++) {
      expect(names[i - 1] <= names[i]).toBe(true);
    }
  });

  it('GET /api/poles?sort=invalid deve usar ordenação padrão (id DESC)', async () => {
    const res = await request(app).get('/api/poles?sort=invalid_sort_key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('poles');
    expect(Array.isArray(res.body.poles)).toBe(true);
    // Default order: id DESC — first id >= last id
    const poles = res.body.poles;
    if (poles.length >= 2) {
      expect(poles[0].id).toBeGreaterThanOrEqual(poles[poles.length - 1].id);
    }
  });

  it('GET /api/poles?sort=created_asc deve ordenar por id crescente', async () => {
    const res = await request(app).get('/api/poles?sort=created_asc');
    expect(res.status).toBe(200);
    const ids = res.body.poles.map((p: { id: number }) => p.id);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i - 1]).toBeLessThanOrEqual(ids[i]);
    }
  });
});
