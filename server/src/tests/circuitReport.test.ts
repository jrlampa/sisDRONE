/**
 * circuitReport.test.ts — Phase 44: Relatório de Circuito (PDF Completo)
 * Tests for GET /api/report/circuit/:circuitId
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;
let circuitId: number;
let poleAId: number;
let poleBId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Create a circuit
  const circuit = await db.run(
    `INSERT INTO circuits (tenant_id, name, description, color)
     VALUES (?, 'Circuito-Relat-PDF', 'Alimentador teste PDF', '#6366f1')`,
    [tenantId]
  );
  circuitId = circuit.lastID!;

  // Create poles in the circuit
  const pa = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, ahi_score, status, circuit_id)
     VALUES (?, 'RelPDF-A', -22.150, -42.921, 'concreto', 35, 'active', ?)`,
    [tenantId, circuitId]
  );
  poleAId = pa.lastID!;

  const pb = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, ahi_score, status, circuit_id)
     VALUES (?, 'RelPDF-B', -22.151, -42.922, 'madeira', 80, 'active', ?)`,
    [tenantId, circuitId]
  );
  poleBId = pb.lastID!;

  // Create a conductor in the circuit
  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, voltage_kv, length_m, circuit_id)
     VALUES (?, ?, ?, 'BT', 0.22, 120.0, ?)`,
    [tenantId, poleAId, poleBId, circuitId]
  );

  // Create a maintenance plan for poleA
  await db.run(
    `INSERT INTO maintenance_plans (pole_id, plan_text, estimated_cost, status)
     VALUES (?, 'Substituição urgente RelPDF-A', 2500.00, 'PENDING')`,
    [poleAId]
  );
});

describe('Phase 44 — GET /api/report/circuit/:circuitId', () => {
  it('deve retornar 400 para circuitId inválido', async () => {
    const res = await request(app).get('/api/report/circuit/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/);
  });

  it('deve retornar 400 para circuitId = 0', async () => {
    const res = await request(app).get('/api/report/circuit/0');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para circuito inexistente', async () => {
    const res = await request(app).get('/api/report/circuit/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/não encontrado/);
  });

  it('deve retornar PDF com content-type application/pdf', async () => {
    const res = await request(app).get(`/api/report/circuit/${circuitId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  it('deve retornar content-disposition com filename do circuito', async () => {
    const res = await request(app).get(`/api/report/circuit/${circuitId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(new RegExp(`circuito_${circuitId}`));
  });
});
