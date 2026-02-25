/**
 * levantamento.test.ts — Phase 61: Exportação de Levantamento CSV
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;
let poleId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  const r = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, network_level, structure_config,
      phase_config, num_arms, ahi_score, status)
     VALUES (?, 'Levant-Pole-A', -22.15050, -42.92200, 'concreto', 'MT', 'tangente', 'T', 3, 75, 'inspected')`,
    [tenantId],
  );
  poleId = r.lastID!;

  // Add equipment for this pole
  await db.run(
    `INSERT INTO equipment (pole_id, tenant_id, type, status) VALUES (?, ?, 'transformador', 'ativo')`,
    [poleId, tenantId],
  );

  // Add a conductor from this pole
  const r2 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score) VALUES (?, 'Levant-Pole-B', -22.15080, -42.92180, 90)`,
    [tenantId],
  );
  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, computed_length_m) VALUES (?, ?, ?, 'MT', 45.5)`,
    [tenantId, poleId, r2.lastID!],
  );
});

describe('Phase 61 — GET /api/report/levantamento', () => {
  it('deve retornar 400 para tenant_id inválido (string)', async () => {
    const res = await request(app)
      .get('/api/report/levantamento?tenant_id=abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve retornar 400 para tenant_id zero', async () => {
    const res = await request(app)
      .get('/api/report/levantamento?tenant_id=0')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 para circuit_id inválido', async () => {
    const res = await request(app)
      .get(`/api/report/levantamento?tenant_id=${tenantId}&circuit_id=xyz`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/circuit_id/);
  });

  it('deve retornar 404 para concessionária inexistente', async () => {
    const res = await request(app)
      .get('/api/report/levantamento?tenant_id=999999')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Concession/);
  });

  it('deve retornar CSV com Content-Type text/csv e BOM', async () => {
    const res = await request(app)
      .get(`/api/report/levantamento?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/levantamento_/);
    // BOM presente
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);
  });

  it('CSV deve conter cabeçalho e dados do poste inserido', async () => {
    const res = await request(app)
      .get(`/api/report/levantamento?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    const lines = res.text.trim().split('\r\n');
    // First line (after BOM strip) is header
    const header = lines[0].replace('\uFEFF', '');
    expect(header).toContain('ID');
    expect(header).toContain('Nome');
    expect(header).toContain('Nível_Rede');
    expect(header).toContain('Qtd_Equipamentos');
    expect(header).toContain('Qtd_Condutores');
    expect(header).toContain('Comprimento_Total_m');
    // Data rows exist
    expect(lines.length).toBeGreaterThan(1);
    // Find row for our pole
    const poleRow = lines.find(l => l.includes('Levant-Pole-A'));
    expect(poleRow).toBeDefined();
    // Equipment count should be 1
    expect(poleRow).toContain('1');
    // network_level MT
    expect(poleRow).toContain('MT');
  });
});
