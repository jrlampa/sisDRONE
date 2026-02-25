/**
 * failureSimulation.test.ts — Phase 47: Simulação de Falha na Rede
 * Tests for /api/network/simulate-failure and the pure failureSimulator service
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';
import { simulatePoleFailure, simulateConductorFailure } from '../services/failureSimulator';

process.env.NODE_ENV = 'test';

let tenantId: number;
let poleAId: number;
let poleBId: number;
let poleCId: number;  // connected to B (so A–B–C chain)
let poleDId: number;  // isolated
let condABId: number;
let condBCId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Create chain: A — B — C   and D (isolated)
  const rA = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Fail-A', -22.1500, -42.9200, 'good')`,
    [tenantId]
  );
  poleAId = rA.lastID!;

  const rB = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Fail-B', -22.1510, -42.9210, 'good')`,
    [tenantId]
  );
  poleBId = rB.lastID!;

  const rC = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Fail-C', -22.1520, -42.9220, 'good')`,
    [tenantId]
  );
  poleCId = rC.lastID!;

  const rD = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Fail-D-Isolated', -22.2000, -42.9500, 'good')`,
    [tenantId]
  );
  poleDId = rD.lastID!;

  const rAB = await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type) VALUES (?, ?, ?, 'BT')`,
    [tenantId, poleAId, poleBId]
  );
  condABId = rAB.lastID!;

  const rBC = await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type) VALUES (?, ?, ?, 'BT')`,
    [tenantId, poleBId, poleCId]
  );
  condBCId = rBC.lastID!;
});

// ─── Unit tests for pure functions ───────────────────────────────────────────

describe('Phase 47 — failureSimulator (unit)', () => {
  const nodes = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
    { id: 4, name: 'D-isolated' },
  ];
  const edges = [
    { id: 10, pole_from: 1, pole_to: 2 },
    { id: 11, pole_from: 2, pole_to: 3 },
  ];

  it('simulatePoleFailure: remover nó folha (C) não afeta A ou B', () => {
    const result = simulatePoleFailure(nodes, edges, 3);
    expect(result.type).toBe('pole');
    expect(result.removed_id).toBe(3);
    expect(result.affected_count).toBe(0); // C is a leaf — removing it doesn't disconnect anyone
    expect(result.affected_poles).toEqual([]);
  });

  it('simulatePoleFailure: remover nó central (B) afeta C', () => {
    const result = simulatePoleFailure(nodes, edges, 2);
    expect(result.type).toBe('pole');
    expect(result.removed_id).toBe(2);
    // C is no longer reachable from A (the main component without B)
    expect(result.affected_count).toBeGreaterThanOrEqual(1);
    expect(result.affected_poles).toContain(3);
  });

  it('simulatePoleFailure: remover nó isolado (D) não tem impacto', () => {
    const result = simulatePoleFailure(nodes, edges, 4);
    expect(result.affected_count).toBe(0);
  });

  it('simulateConductorFailure: remover condutor AB + partição C', () => {
    const result = simulateConductorFailure(nodes, edges, 10); // edge A-B
    expect(result.type).toBe('conductor');
    expect(result.removed_id).toBe(10);
    expect(result.partitions_after).toBeGreaterThan(result.partitions_before);
  });

  it('simulateConductorFailure: estimated_affected_customers = 3 × affected_count', () => {
    const result = simulateConductorFailure(nodes, edges, 10);
    expect(result.estimated_affected_customers).toBe(result.affected_count * 3);
  });
});

// ─── Integration tests for /api/network/simulate-failure ─────────────────────

describe('Phase 47 — GET /api/network/simulate-failure (integration)', () => {
  it('deve retornar 400 sem pole_id nem conductor_id', async () => {
    const res = await request(app)
      .get('/api/network/simulate-failure')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pole_id|conductor_id/);
  });

  it('deve retornar 400 com ambos pole_id e conductor_id', async () => {
    const res = await request(app)
      .get(`/api/network/simulate-failure?pole_id=${poleAId}&conductor_id=${condABId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/apenas/i);
  });

  it('deve retornar 404 para pole_id inexistente', async () => {
    const res = await request(app)
      .get('/api/network/simulate-failure?pole_id=999999')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(404);
  });

  it('deve retornar resultado ao simular falha no poste B (condutor central)', async () => {
    const res = await request(app)
      .get(`/api/network/simulate-failure?pole_id=${poleBId}&tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('pole');
    expect(res.body.removed_id).toBe(poleBId);
    expect(typeof res.body.affected_count).toBe('number');
    expect(typeof res.body.estimated_affected_customers).toBe('number');
    expect(res.body).toHaveProperty('partitions_before');
    expect(res.body).toHaveProperty('partitions_after');
  });

  it('deve retornar resultado ao simular falha no condutor AB', async () => {
    const res = await request(app)
      .get(`/api/network/simulate-failure?conductor_id=${condABId}&tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('conductor');
    expect(res.body.removed_id).toBe(condABId);
    expect(Array.isArray(res.body.affected_poles)).toBe(true);
  });
});
