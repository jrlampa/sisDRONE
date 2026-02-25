/**
 * gisExport.test.ts — Phase 51: Export GeoJSON Aprimorado + KML para Google Earth
 * Testes de integração para GET /api/gis/export/geojson e GET /api/gis/export/kml
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId = 1;
let poleId1: number;
let poleId2: number;
let conductorId: number;

beforeAll(async () => {
  const db = await getDb();

  // Cria dois postes para o tenant 1
  const r1 = await db.run(
    `INSERT INTO poles (name, lat, lng, ahi_score, status, material, tenant_id)
     VALUES ('GIS-Pole-A', -22.15018, -42.92185, 85, 'normal', 'concreto', ?)`,
    [tenantId]
  );
  poleId1 = r1.lastID as number;

  const r2 = await db.run(
    `INSERT INTO poles (name, lat, lng, ahi_score, status, material, tenant_id)
     VALUES ('GIS-Pole-B', -22.15100, -42.92300, 45, 'warning', 'madeira', ?)`,
    [tenantId]
  );
  poleId2 = r2.lastID as number;

  // Cria um condutor ligando os dois postes
  const rc = await db.run(
    `INSERT INTO conductors (pole_from, pole_to, network_type, voltage_kv, tenant_id)
     VALUES (?, ?, 'BT', 0.22, ?)`,
    [poleId1, poleId2, tenantId]
  );
  conductorId = rc.lastID as number;
});

describe('Phase 51 — GET /api/gis/export/geojson', () => {
  it('retorna FeatureCollection com postes e condutores', async () => {
    const res = await request(app)
      .get(`/api/gis/export/geojson?tenant_id=${tenantId}`)
      .set('x-user-role', 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.features)).toBe(true);

    const poleFeatures     = res.body.features.filter((f: any) => f.properties?.entity === 'pole');
    const conductorFeatures = res.body.features.filter((f: any) => f.properties?.entity === 'conductor');

    expect(poleFeatures.length).toBeGreaterThanOrEqual(2);
    expect(conductorFeatures.length).toBeGreaterThanOrEqual(1);
  });

  it('poste tem geometria Point com propriedades completas', async () => {
    const res = await request(app)
      .get(`/api/gis/export/geojson?tenant_id=${tenantId}`)
      .set('x-user-role', 'ADMIN');

    const poleF = res.body.features.find(
      (f: any) => f.properties?.entity === 'pole' && f.id === poleId1
    );
    expect(poleF).toBeTruthy();
    expect(poleF.geometry.type).toBe('Point');
    expect(poleF.geometry.coordinates).toHaveLength(2);
    expect(poleF.properties.ahi_score).toBe(85);
    expect(poleF.properties.material).toBe('concreto');
  });

  it('condutor tem geometria LineString', async () => {
    const res = await request(app)
      .get(`/api/gis/export/geojson?tenant_id=${tenantId}`)
      .set('x-user-role', 'ADMIN');

    const cF = res.body.features.find(
      (f: any) => f.properties?.entity === 'conductor' && f.id === `c${conductorId}`
    );
    expect(cF).toBeTruthy();
    expect(cF.geometry.type).toBe('LineString');
    expect(cF.geometry.coordinates).toHaveLength(2);
  });

  it('retorna 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/gis/export/geojson?tenant_id=abc')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/i);
  });

  it('inclui metadata na resposta', async () => {
    const res = await request(app)
      .get(`/api/gis/export/geojson?tenant_id=${tenantId}`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.metadata).toBeTruthy();
    expect(typeof res.body.metadata.total_poles).toBe('number');
    expect(typeof res.body.metadata.total_conductors).toBe('number');
  });
});

describe('Phase 51 — GET /api/gis/export/kml', () => {
  it('retorna KML com Content-Type correto', async () => {
    const res = await request(app)
      .get(`/api/gis/export/kml?tenant_id=${tenantId}`)
      .set('x-user-role', 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/kml/i);
  });

  it('KML contém Placemark para cada poste com coordenadas', async () => {
    const res = await request(app)
      .get(`/api/gis/export/kml?tenant_id=${tenantId}`)
      .set('x-user-role', 'ADMIN');

    expect(res.text).toContain('<kml');
    expect(res.text).toContain('<Placemark>');
    expect(res.text).toContain('<coordinates>');
  });

  it('retorna 400 para tenant_id inválido no KML', async () => {
    const res = await request(app)
      .get('/api/gis/export/kml?tenant_id=0')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/i);
  });
});
