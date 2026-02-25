/**
 * bomReport.test.ts — Testes da API de Relação de Materiais (BOM) — Phase 64
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

let tenantId: number;
let circuitId: number;

beforeAll(async () => {
  const db = await getDb();

  // Tenant
  const t = await db.run('INSERT INTO tenants (name) VALUES (?)', ['BOM Tenant']);
  tenantId = t.lastID!;

  // Circuit
  const c = await db.run(
    'INSERT INTO circuits (tenant_id, name, color) VALUES (?, ?, ?)',
    [tenantId, 'Circuito BOM', '#ff0000']
  );
  circuitId = c.lastID!;

  // Poles
  const p1 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, network_level, structure_config, circuit_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, 'P-BOM-1', -22.15, -42.92, 'Concreto', 'MT', 'tangente', circuitId]
  );
  const p2 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, network_level, circuit_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, 'P-BOM-2', -22.16, -42.93, 'Madeira', 'BT', circuitId]
  );

  // Conductor
  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, cable_type, circuit_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, p1.lastID, p2.lastID, 'MT', 'ACSR', circuitId]
  );

  // Equipment
  await db.run(
    `INSERT INTO equipment (tenant_id, pole_id, type, status) VALUES (?, ?, ?, ?)`,
    [tenantId, p1.lastID, 'transformador', 'ativo']
  );
});

describe('GET /api/report/bom', () => {
  it('retorna BOM JSON com campos obrigatórios', async () => {
    const res = await request(app).get(`/api/report/bom?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('poles');
    expect(res.body).toHaveProperty('conductors');
    expect(res.body).toHaveProperty('equipment');
    expect(res.body.poles).toHaveProperty('by_material');
    expect(res.body.poles).toHaveProperty('by_network_level');
    expect(res.body.poles.total).toBe(2);
  });

  it('retorna quantitativos corretos por material', async () => {
    const res = await request(app).get(`/api/report/bom?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    const mat = res.body.poles.by_material;
    expect(mat['Concreto']).toBe(1);
    expect(mat['Madeira']).toBe(1);
  });

  it('filtra por circuit_id', async () => {
    const res = await request(app).get(`/api/report/bom?tenant_id=${tenantId}&circuit_id=${circuitId}`);
    expect(res.status).toBe(200);
    expect(res.body.conductors.by_network_type).toHaveProperty('MT');
    expect(res.body.equipment.by_type).toHaveProperty('transformador');
  });

  it('retorna CSV com BOM UTF-8 quando format=csv', async () => {
    const res = await request(app).get(`/api/report/bom?tenant_id=${tenantId}&format=csv`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/relacao_materiais\.csv/);
    const body = res.text;
    expect(body).toMatch(/Categoria,Subcategoria,Tipo,Quantidade/);
    expect(body).toMatch(/Postes,Material/);
  });

  it('retorna 400 para tenant_id inválido', async () => {
    const res = await request(app).get('/api/report/bom?tenant_id=abc');
    expect(res.status).toBe(400);
  });

  it('retorna 400 para circuit_id inválido', async () => {
    const res = await request(app).get(`/api/report/bom?tenant_id=${tenantId}&circuit_id=xyz`);
    expect(res.status).toBe(400);
  });

  it('retorna 400 para format inválido', async () => {
    const res = await request(app).get(`/api/report/bom?tenant_id=${tenantId}&format=xml`);
    expect(res.status).toBe(400);
  });

  it('funciona sem filtros (global BOM)', async () => {
    const res = await request(app).get('/api/report/bom');
    expect(res.status).toBe(200);
    expect(res.body.poles).toHaveProperty('total');
  });
});
