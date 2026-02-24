/**
 * croqui.test.ts — Phase 31: Croqui Digital SVG (/api/report/croqui/:tenantId)
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

  // Ensure poles exist for the tenant
  const r1 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, status) VALUES (?, 'Croqui-A', -22.15020, -42.92190, 85, 'good')`,
    [tenantId]
  );
  pole1Id = r1.lastID!;

  const r2 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, status) VALUES (?, 'Croqui-B', -22.15100, -42.92100, 45, 'critical')`,
    [tenantId]
  );
  pole2Id = r2.lastID!;

  // Add a conductor between them
  await db.run(
    `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type) VALUES (?, ?, ?, 'BT')`,
    [tenantId, pole1Id, pole2Id]
  );
});

describe('Phase 31 — GET /api/report/croqui/:tenantId', () => {
  it('deve retornar 400 para tenantId inválido', async () => {
    const res = await request(app)
      .get('/api/report/croqui/abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenantId/);
  });

  it('deve retornar 400 para tenantId zero', async () => {
    const res = await request(app)
      .get('/api/report/croqui/0')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para concessionária inexistente', async () => {
    const res = await request(app)
      .get('/api/report/croqui/999999')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Concession/);
  });

  it('deve retornar SVG válido com content-type image/svg+xml', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(typeof res.text).toBe('string');
    expect(res.text).toContain('<svg');
    expect(res.text).toContain('</svg>');
  });

  it('o SVG deve conter referências aos postes criados', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Croqui-A');
    expect(res.text).toContain('Croqui-B');
  });

  it('o SVG deve conter a legenda e o título sisDRONE', async () => {
    const res = await request(app)
      .get(`/api/report/croqui/${tenantId}`)
      .set('x-user-role', 'ENGINEER');

    expect(res.status).toBe(200);
    expect(res.text).toContain('sisDRONE');
    expect(res.text).toContain('Legenda');
    expect(res.text).toContain('circle');
    expect(res.text).toContain('line');
  });
});
