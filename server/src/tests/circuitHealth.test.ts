/**
 * circuitHealth.test.ts — Testes da API de Saúde de Circuito (Phase 65)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

let tenantId: number;
let circuitId: number;
let poleId1: number;
let poleId2: number;

beforeAll(async () => {
  const db = await getDb();

  const t = await db.run('INSERT INTO tenants (name) VALUES (?)', ['Health Tenant']);
  tenantId = t.lastID!;

  const c = await db.run(
    'INSERT INTO circuits (tenant_id, name, color) VALUES (?, ?, ?)',
    [tenantId, 'Circuito Saúde', '#00ff00']
  );
  circuitId = c.lastID!;

  const p1 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, circuit_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, 'PS-1', -22.15018, -42.92185, 25, circuitId]
  );
  poleId1 = p1.lastID!;

  const p2 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, circuit_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, 'PS-2', -22.151, -42.922, 75, circuitId]
  );
  poleId2 = p2.lastID!;

  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, circuit_id)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, poleId1, poleId2, 'MT', circuitId]
  );

  await db.run(
    `INSERT INTO equipment (tenant_id, pole_id, type, status) VALUES (?, ?, ?, ?)`,
    [tenantId, poleId1, 'chave_faca', 'ativo']
  );
});

describe('GET /api/circuits/:id/health', () => {
  it('retorna 400 para ID de circuito inválido', async () => {
    const res = await request(app).get('/api/circuits/abc/health');
    expect(res.status).toBe(400);
  });

  it('retorna 404 para circuito inexistente', async () => {
    const res = await request(app).get('/api/circuits/999999/health');
    expect(res.status).toBe(404);
  });

  it('retorna health report com campos obrigatórios', async () => {
    const res = await request(app).get(`/api/circuits/${circuitId}/health`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('circuit_id', circuitId);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('ahi_distribution');
    expect(res.body).toHaveProperty('voltage_drop');
    expect(res.body).toHaveProperty('topology');
    expect(res.body).toHaveProperty('equipment');
  });

  it('summary contém estatísticas corretas', async () => {
    const res = await request(app).get(`/api/circuits/${circuitId}/health`);
    expect(res.status).toBe(200);
    const s = res.body.summary;
    expect(s.total_poles).toBe(2);
    expect(s.critical_poles).toBe(1); // AHI=25 < 30
    expect(typeof s.avg_ahi).toBe('number');
    expect(s.total_conductors).toBe(1);
  });

  it('topology.loops_count é número', async () => {
    const res = await request(app).get(`/api/circuits/${circuitId}/health`);
    expect(res.status).toBe(200);
    expect(typeof res.body.topology.loops_count).toBe('number');
  });

  it('equipment lista tipo de equipamento do circuito', async () => {
    const res = await request(app).get(`/api/circuits/${circuitId}/health`);
    expect(res.status).toBe(200);
    expect(res.body.equipment).toHaveProperty('chave_faca');
  });
});
