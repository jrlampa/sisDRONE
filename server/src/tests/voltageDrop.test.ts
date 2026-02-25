/**
 * voltageDrop.test.ts — Phase 33: Queda de Tensão NBR 5410
 * Tests for /api/network/voltage-drop and voltageService pure functions
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';
import { calculateVoltageDrop, classifyVoltageDrop } from '../services/voltageService';

process.env.NODE_ENV = 'test';

let tenantId: number;
let poleAId: number;
let poleBId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Two poles ~500 m apart (realistic BT span)
  const rA = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'VD-Pole-A', -22.15018, -42.92185, 'good')`,
    [tenantId]
  );
  poleAId = rA.lastID!;

  const rB = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'VD-Pole-B', -22.15468, -42.92185, 'good')`,
    [tenantId]
  );
  poleBId = rB.lastID!;

  // One conductor with length (will have voltage drop)
  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, length_m, voltage_kv)
     VALUES (?, ?, ?, 'BT', 500, 0.22)`,
    [tenantId, poleAId, poleBId]
  );

  // One conductor without length (should be skipped)
  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type)
     VALUES (?, ?, ?, 'MT')`,
    [tenantId, poleAId, poleBId]
  );
});

describe('Phase 33 — voltageService unit tests', () => {
  it('classifyVoltageDrop: ok when ≤ 5%', () => {
    expect(classifyVoltageDrop(3.5)).toBe('ok');
    expect(classifyVoltageDrop(5)).toBe('ok');
  });

  it('classifyVoltageDrop: warning when > 5% and ≤ 10%', () => {
    expect(classifyVoltageDrop(5.1)).toBe('warning');
    expect(classifyVoltageDrop(10)).toBe('warning');
  });

  it('classifyVoltageDrop: critical when > 10%', () => {
    expect(classifyVoltageDrop(10.1)).toBe('critical');
    expect(classifyVoltageDrop(50)).toBe('critical');
  });

  it('calculateVoltageDrop: returns null when length is missing', () => {
    const row = {
      id: 1, pole_from: 1, pole_to: 2,
      from_name: 'A', to_name: 'B',
      network_type: 'BT',
      computed_length_m: null, length_m: null, voltage_kv: 0.22,
    };
    expect(calculateVoltageDrop(row)).toBeNull();
  });

  it('calculateVoltageDrop: computes correct fields for BT conductor', () => {
    const row = {
      id: 5, pole_from: 10, pole_to: 11,
      from_name: 'X', to_name: 'Y',
      network_type: 'BT',
      computed_length_m: 200, length_m: null, voltage_kv: null,
    };
    const result = calculateVoltageDrop(row);
    expect(result).not.toBeNull();
    expect(result!.conductor_id).toBe(5);
    expect(result!.delta_v_percent).toBeGreaterThan(0);
    expect(['ok', 'warning', 'critical']).toContain(result!.status);
    expect(result!.length_m).toBe(200);
    expect(result!.voltage_kv).toBe(0.22);
  });
});

describe('Phase 33 — GET /api/network/voltage-drop', () => {
  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/network/voltage-drop?tenant_id=abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve retornar 200 com total, summary e conductors', async () => {
    const res = await request(app)
      .get(`/api/network/voltage-drop?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('conductors');
    expect(typeof res.body.summary.critical).toBe('number');
    expect(typeof res.body.summary.warning).toBe('number');
    expect(typeof res.body.summary.ok).toBe('number');
  });

  it('deve excluir condutores sem comprimento', async () => {
    const res = await request(app)
      .get(`/api/network/voltage-drop?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    // Conductor with length=500m BT should be present; MT without length skipped
    const conductors: Array<{ network_type: string; length_m: number }> = res.body.conductors;
    const hasNoLength = conductors.some(c => c.length_m == null || c.length_m <= 0);
    expect(hasNoLength).toBe(false);
  });

  it('summary totals should match conductors array length', async () => {
    const res = await request(app)
      .get(`/api/network/voltage-drop?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    const { total, summary, conductors } = res.body;
    expect(conductors.length).toBe(total);
    expect(summary.critical + summary.warning + summary.ok).toBe(total);
  });
});
