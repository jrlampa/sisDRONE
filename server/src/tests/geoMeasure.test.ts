/**
 * geoMeasure.test.ts — Phase 52: API de Medição Geoespacial
 * Testes para POST /api/geo/measure
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

/** Coordenadas de teste: -22.15018, -42.92185 e vizinhanças */
const COORD_A: [number, number] = [-22.15018, -42.92185];
const COORD_B: [number, number] = [-22.15118, -42.92285]; // ~143 m ao sul-sudoeste
const COORD_C: [number, number] = [-22.15218, -42.92385]; // ~286 m desde A

describe('Phase 52 — POST /api/geo/measure', () => {
  it('retorna 400 quando points é ausente', async () => {
    const res = await request(app)
      .post('/api/geo/measure')
      .set('x-user-role', 'ENGINEER')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2 pontos/i);
  });

  it('retorna 400 quando há apenas 1 ponto', async () => {
    const res = await request(app)
      .post('/api/geo/measure')
      .set('x-user-role', 'ENGINEER')
      .send({ points: [COORD_A] });
    expect(res.status).toBe(400);
  });

  it('retorna 400 para latitude inválida', async () => {
    const res = await request(app)
      .post('/api/geo/measure')
      .set('x-user-role', 'ENGINEER')
      .send({ points: [[91, -42.92], COORD_B] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/latitude/i);
  });

  it('retorna 400 para longitude inválida', async () => {
    const res = await request(app)
      .post('/api/geo/measure')
      .set('x-user-role', 'ENGINEER')
      .send({ points: [COORD_A, [-22.15, 190]] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/longitude/i);
  });

  it('retorna 200 com 1 segmento para 2 pontos', async () => {
    const res = await request(app)
      .post('/api/geo/measure')
      .set('x-user-role', 'ENGINEER')
      .send({ points: [COORD_A, COORD_B] });

    expect(res.status).toBe(200);
    expect(res.body.segments).toHaveLength(1);
    expect(res.body.total_m).toBeGreaterThan(0);
    expect(res.body.total_km).toBeGreaterThan(0);
    expect(res.body.segments[0]).toHaveProperty('distance_m');
    expect(res.body.segments[0].distance_m).toBeGreaterThan(100);
    expect(res.body.segments[0].distance_m).toBeLessThan(250);
  });

  it('retorna 2 segmentos para 3 pontos e total correto', async () => {
    const res = await request(app)
      .post('/api/geo/measure')
      .set('x-user-role', 'ENGINEER')
      .send({ points: [COORD_A, COORD_B, COORD_C] });

    expect(res.status).toBe(200);
    expect(res.body.segments).toHaveLength(2);

    const sumSegments = res.body.segments.reduce(
      (acc: number, s: { distance_m: number }) => acc + s.distance_m, 0
    );
    expect(Math.abs(sumSegments - res.body.total_m)).toBeLessThan(0.01);
  });

  it('retorna 400 para mais de 100 pontos', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => [-22.15 - i * 0.001, -42.92]);
    const res = await request(app)
      .post('/api/geo/measure')
      .set('x-user-role', 'ENGINEER')
      .send({ points: tooMany });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/máximo/i);
  });
});
