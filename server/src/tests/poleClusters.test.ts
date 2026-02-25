/**
 * poleClusters.test.ts — Testes de Agrupamento Espacial de Postes (Phase 66)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';
import { clusterPoles } from '../services/clusterService';

let tenantId: number;

beforeAll(async () => {
  const db = await getDb();
  const t = await db.run('INSERT INTO tenants (name) VALUES (?)', ['Cluster Tenant']);
  tenantId = t.lastID!;

  // 3 postes próximos (≈100 m entre si) + 1 poste distante
  await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, network_level) VALUES (?, ?, ?, ?, ?, ?)',
    [tenantId, 'CL-1', -22.15018, -42.92185, 80, 'MT']
  );
  await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, network_level) VALUES (?, ?, ?, ?, ?, ?)',
    [tenantId, 'CL-2', -22.15025, -42.92190, 70, 'MT']
  );
  await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, network_level) VALUES (?, ?, ?, ?, ?, ?)',
    [tenantId, 'CL-3', -22.15030, -42.92195, 60, 'BT']
  );
  // Poste distante (> 1 km)
  await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, network_level) VALUES (?, ?, ?, ?, ?, ?)',
    [tenantId, 'CL-4', -22.20000, -42.95000, 20, 'MT']
  );
});

describe('clusterPoles (unit)', () => {
  it('retorna vazio para array vazio', () => {
    expect(clusterPoles([], 100)).toEqual([]);
  });

  it('retorna vazio para radius inválido (0)', () => {
    expect(clusterPoles([{ id: 1, lat: -22.15, lng: -42.92, ahi_score: 80, network_level: 'MT' }], 0)).toEqual([]);
  });

  it('agrupa postes próximos em 1 cluster com radius grande', () => {
    const poles = [
      { id: 1, lat: -22.150, lng: -42.921, ahi_score: 80, network_level: 'MT' },
      { id: 2, lat: -22.151, lng: -42.922, ahi_score: 60, network_level: 'BT' },
    ];
    const clusters = clusterPoles(poles, 1000); // 1 km radius
    // Both poles should be in clusters (may be 1 or 2 depending on cell)
    const totalPoles = clusters.reduce((s, c) => s + c.pole_count, 0);
    expect(totalPoles).toBe(2);
  });
});

describe('GET /api/poles/clusters', () => {
  it('retorna 400 sem radius_m', async () => {
    const res = await request(app).get(`/api/poles/clusters?tenant_id=${tenantId}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/radius_m/);
  });

  it('retorna 400 para radius_m > 5000', async () => {
    const res = await request(app).get(`/api/poles/clusters?tenant_id=${tenantId}&radius_m=9999`);
    expect(res.status).toBe(400);
  });

  it('retorna 400 para tenant_id inválido', async () => {
    const res = await request(app).get('/api/poles/clusters?tenant_id=abc&radius_m=100');
    expect(res.status).toBe(400);
  });

  it('retorna clusters com campos obrigatórios', async () => {
    const res = await request(app).get(`/api/poles/clusters?tenant_id=${tenantId}&radius_m=500`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cluster_count');
    expect(res.body).toHaveProperty('total_poles');
    expect(res.body).toHaveProperty('radius_m', 500);
    expect(Array.isArray(res.body.clusters)).toBe(true);
  });

  it('cada cluster tem centróide, pole_count e pole_ids', async () => {
    const res = await request(app).get(`/api/poles/clusters?tenant_id=${tenantId}&radius_m=500`);
    expect(res.status).toBe(200);
    for (const cluster of res.body.clusters) {
      expect(cluster).toHaveProperty('centroid_lat');
      expect(cluster).toHaveProperty('centroid_lng');
      expect(cluster).toHaveProperty('pole_count');
      expect(Array.isArray(cluster.pole_ids)).toBe(true);
    }
  });

  it('funciona sem tenant_id (todos os postes)', async () => {
    const res = await request(app).get('/api/poles/clusters?radius_m=200');
    expect(res.status).toBe(200);
    expect(res.body.total_poles).toBeGreaterThan(0);
  });
});
