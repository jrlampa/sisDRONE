/**
 * croquiAprimorado.test.ts — Phase 62: Croqui Digital Aprimorado
 * Testa os novos elementos visuais: seta Norte, barra de escala, símbolos
 * de equipamentos, labels MT/BT/AT e setas de direção em condutores.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;
let pole1Id: number;
let pole2Id: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  const r1 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, status, network_level)
     VALUES (?, 'CroquiEnh-A', -22.15030, -42.92185, 82, 'good', 'MT')`,
    [tenantId],
  );
  pole1Id = r1.lastID!;

  const r2 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, status, network_level)
     VALUES (?, 'CroquiEnh-B', -22.15120, -42.92080, 40, 'critical', 'BT')`,
    [tenantId],
  );
  pole2Id = r2.lastID!;

  // MT conductor (should have arrowhead marker)
  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, computed_length_m)
     VALUES (?, ?, ?, 'MT', 112.3)`,
    [tenantId, pole1Id, pole2Id],
  );

  // Equipment on pole 1
  await db.run(
    `INSERT INTO equipment (pole_id, tenant_id, type, status) VALUES (?, ?, 'transformador', 'ativo')`,
    [pole1Id, tenantId],
  );
});

describe('Phase 62 — Croqui Digital Aprimorado', () => {
  it('SVG deve conter seta Norte (marker N)', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    // North arrow: has the "N" text label
    expect(res.text).toContain('>N<');
  });

  it('SVG deve conter barra de escala (linha de escala visual)', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    // Scale bar uses " m" suffix in text element
    expect(res.text).toMatch(/ m<\/text>/);
  });

  it('SVG deve conter arrowhead marker para condutores MT', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    // defs marker for MT arrows
    expect(res.text).toContain('marker-end="url(#arrow-mt)"');
    expect(res.text).toContain('id="arrow-mt"');
  });

  it('SVG deve exibir badge de network_level (MT) nos postes', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    // MT level badge text
    expect(res.text).toContain('>MT<');
  });

  it('SVG deve exibir símbolo de equipamento (badge amarelo) quando há equipamentos', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    // Equipment badge: small yellow circle with count
    expect(res.text).toContain('#fbbf24');
    expect(res.text).toContain('equip.');
  });
});
