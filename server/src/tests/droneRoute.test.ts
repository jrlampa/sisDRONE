/**
 * droneRoute.test.ts — Phase 55: Roteiro de Inspeção por Drone (TSP)
 *
 * Testa:
 * - planInspectionRoute (unit tests — puro, sem DB)
 * - GET /api/drones/route (integration)
 * - GET /api/drones/route/kml (integration)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';
import { planInspectionRoute } from '../services/routeService';

process.env.NODE_ENV = 'test';

let tenantId: number;
let poleId1: number;
let poleId2: number;

const TEST_LAT = -22.15018;
const TEST_LNG = -42.92185;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Cria 2 postes com coordenadas de teste
  const p1 = await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng, ahi_score) VALUES (?, ?, ?, ?, ?)',
    [tenantId, 'RT-P1', TEST_LAT, TEST_LNG, 90],
  );
  poleId1 = p1.lastID!;

  const p2 = await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng, ahi_score) VALUES (?, ?, ?, ?, ?)',
    [tenantId, 'RT-P2', TEST_LAT + 0.001, TEST_LNG + 0.001, 40],
  );
  poleId2 = p2.lastID!;
});

// ── Testes Unitários de planInspectionRoute ──────────────────────────────────

describe('routeService — planInspectionRoute (unit)', () => {
  it('retorna rota vazia para array sem postes', () => {
    const route = planInspectionRoute([]);
    expect(route.total_poles).toBe(0);
    expect(route.waypoints).toHaveLength(0);
    expect(route.total_distance_m).toBe(0);
  });

  it('retorna rota com 1 poste (distância 0)', () => {
    const route = planInspectionRoute([
      { id: 1, name: 'Solo', lat: TEST_LAT, lng: TEST_LNG, ahi_score: 80 },
    ]);
    expect(route.total_poles).toBe(1);
    expect(route.waypoints[0].order).toBe(1);
    expect(route.waypoints[0].distance_from_prev_m).toBe(0);
  });

  it('começa pelo poste de menor AHI quando não há ponto inicial', () => {
    const route = planInspectionRoute([
      { id: 10, name: 'Bom', lat: TEST_LAT, lng: TEST_LNG, ahi_score: 90 },
      { id: 11, name: 'Crítico', lat: TEST_LAT + 0.002, lng: TEST_LNG + 0.002, ahi_score: 20 },
    ]);
    expect(route.waypoints[0].pole_id).toBe(11); // AHI mais baixo
  });

  it('usa ponto inicial personalizado (start_lat/lng)', () => {
    const route = planInspectionRoute(
      [
        { id: 20, name: 'A', lat: TEST_LAT, lng: TEST_LNG, ahi_score: 80 },
        { id: 21, name: 'B', lat: TEST_LAT + 0.01, lng: TEST_LNG + 0.01, ahi_score: 80 },
      ],
      TEST_LAT,    // start_lat próximo de 'A'
      TEST_LNG,
    );
    expect(route.waypoints[0].pole_id).toBe(20); // 'A' mais próximo do início
    expect(route.total_distance_km).toBeGreaterThan(0);
  });

  it('ignora postes sem coordenadas', () => {
    const route = planInspectionRoute([
      { id: 30, name: 'Sem Coord', lat: null, lng: null, ahi_score: null },
      { id: 31, name: 'Com Coord', lat: TEST_LAT, lng: TEST_LNG, ahi_score: 80 },
    ]);
    expect(route.total_poles).toBe(1);
    expect(route.waypoints[0].pole_id).toBe(31);
  });

  it('calcula estimated_flight_minutes > 0 para rota com distância', () => {
    const route = planInspectionRoute([
      { id: 40, name: 'X', lat: TEST_LAT, lng: TEST_LNG, ahi_score: 80 },
      { id: 41, name: 'Y', lat: TEST_LAT + 0.05, lng: TEST_LNG + 0.05, ahi_score: 80 },
    ]);
    expect(route.estimated_flight_minutes).toBeGreaterThan(0);
    expect(route.total_distance_km).toBeGreaterThan(0);
  });
});

// ── Testes de Integração HTTP ────────────────────────────────────────────────

describe('GET /api/drones/route', () => {
  it('retorna 400 para tenant_id inválido (string)', async () => {
    const res = await request(app).get('/api/drones/route?tenant_id=abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('retorna 400 para start_lat inválido', async () => {
    const res = await request(app).get(`/api/drones/route?tenant_id=${tenantId}&start_lat=999`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/start_lat/);
  });

  it('retorna 200 com rota válida', async () => {
    const res = await request(app).get(
      `/api/drones/route?tenant_id=${tenantId}&start_lat=${TEST_LAT}&start_lng=${TEST_LNG}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.total_poles).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.waypoints)).toBe(true);
    const wp = res.body.waypoints[0];
    expect(wp.pole_id).toBeDefined();
    expect(wp.order).toBe(1);
    expect(typeof wp.distance_from_prev_m).toBe('number');
  });

  it('retorna campos total_distance_km e estimated_flight_minutes', async () => {
    const res = await request(app).get(`/api/drones/route?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total_distance_km).toBe('number');
    expect(typeof res.body.estimated_flight_minutes).toBe('number');
  });
});

describe('GET /api/drones/route/kml', () => {
  it('retorna 400 para tenant_id inválido', async () => {
    const res = await request(app).get('/api/drones/route/kml?tenant_id=0');
    expect(res.status).toBe(400);
  });

  it('retorna KML válido (Content-Type kml)', async () => {
    const res = await request(app).get(`/api/drones/route/kml?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/kml/);
    expect(res.text).toMatch(/<?xml/);
    expect(res.text).toMatch(/<kml/);
    expect(res.text).toMatch(/<Placemark>/);
  });

  it('Content-Disposition tem filename com tenantId', async () => {
    const res = await request(app).get(`/api/drones/route/kml?tenant_id=${tenantId}`);
    expect(res.headers['content-disposition']).toMatch(`tenant${tenantId}`);
  });
});
