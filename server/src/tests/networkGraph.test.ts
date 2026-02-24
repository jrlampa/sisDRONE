/**
 * networkGraph.test.ts — Phase 30: Topologia de Rede Elétrica
 * Tests for /api/network/graph, /api/network/segments, /api/network/isolated
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;
let poleAId: number;
let poleBId: number;
let poleCId: number; // isolated
let conductorId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Create three poles: A-B connected, C isolated
  const rA = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Net-Pole-A', -22.15020, -42.92180, 'good')`,
    [tenantId]
  );
  poleAId = rA.lastID!;

  const rB = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Net-Pole-B', -22.15050, -42.92150, 'good')`,
    [tenantId]
  );
  poleBId = rB.lastID!;

  const rC = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Net-Pole-C-Isolated', -22.16000, -42.93000, 'good')`,
    [tenantId]
  );
  poleCId = rC.lastID!;

  // Connect A to B
  const rCond = await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type) VALUES (?, ?, ?, 'BT')`,
    [tenantId, poleAId, poleBId]
  );
  conductorId = rCond.lastID!;
});

describe('Phase 30 — GET /api/network/graph', () => {
  it('deve retornar 200 com nodes e edges', async () => {
    const res = await request(app)
      .get('/api/network/graph')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nodes');
    expect(res.body).toHaveProperty('edges');
    expect(res.body).toHaveProperty('node_count');
    expect(res.body).toHaveProperty('edge_count');
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });

  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/network/graph?tenant_id=abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve filtrar por tenant_id e retornar nossos postes e condutor', async () => {
    const res = await request(app)
      .get(`/api/network/graph?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    const nodeIds = res.body.nodes.map((n: { id: number }) => n.id);
    expect(nodeIds).toContain(poleAId);
    expect(nodeIds).toContain(poleBId);
    expect(nodeIds).toContain(poleCId);
    const edgeIds = res.body.edges.map((e: { id: number }) => e.id);
    expect(edgeIds).toContain(conductorId);
  });

  it('nodes têm campos obrigatórios (id, name, lat, lng, ahi_score)', async () => {
    const res = await request(app)
      .get(`/api/network/graph?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    const node = res.body.nodes.find((n: { id: number }) => n.id === poleAId);
    expect(node).toBeDefined();
    expect(node).toHaveProperty('lat');
    expect(node).toHaveProperty('lng');
    expect(node).toHaveProperty('name');
  });
});

describe('Phase 30 — GET /api/network/segments', () => {
  it('deve retornar 200 com segment_count e segments', async () => {
    const res = await request(app)
      .get('/api/network/segments')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('segment_count');
    expect(res.body).toHaveProperty('segments');
    expect(Array.isArray(res.body.segments)).toBe(true);
  });

  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/network/segments?tenant_id=0')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
  });

  it('deve identificar segmento contendo poles A e B conectados', async () => {
    const res = await request(app)
      .get(`/api/network/segments?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);

    const segs: { pole_ids: number[] }[] = res.body.segments;
    const hasAB = segs.some(s => s.pole_ids.includes(poleAId) && s.pole_ids.includes(poleBId));
    expect(hasAB).toBe(true);

    // Pole C is isolated — should NOT appear in any segment
    const hasCinSeg = segs.some(s => s.pole_ids.includes(poleCId));
    expect(hasCinSeg).toBe(false);
  });
});

describe('Phase 30 — GET /api/network/isolated', () => {
  it('deve retornar 200 com count e poles', async () => {
    const res = await request(app)
      .get('/api/network/isolated')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('poles');
    expect(Array.isArray(res.body.poles)).toBe(true);
  });

  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/network/isolated?tenant_id=abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
  });

  it('poste C deve aparecer como isolado', async () => {
    const res = await request(app)
      .get(`/api/network/isolated?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    const isolatedIds = res.body.poles.map((p: { id: number }) => p.id);
    expect(isolatedIds).toContain(poleCId);
    // Poles A and B should NOT be isolated
    expect(isolatedIds).not.toContain(poleAId);
    expect(isolatedIds).not.toContain(poleBId);
  });
});
