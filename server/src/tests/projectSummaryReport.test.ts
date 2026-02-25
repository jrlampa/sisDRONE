/**
 * projectSummaryReport.test.ts — Phase 57: Resumo Executivo do Projeto (PDF)
 *
 * Testa GET /api/report/project-summary?tenant_id=
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let tenantId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Garante pelo menos 1 poste para o tenant
  await db.run(
    'INSERT INTO poles (tenant_id, name, lat, lng, ahi_score, material, status, network_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [tenantId, 'PSR-Poste', -22.15018, -42.92185, 75, 'concreto', 'bom', 'BT'],
  );
});

describe('Phase 57 — Resumo Executivo do Projeto (PDF)', () => {
  it('retorna 400 para tenant_id inválido (string)', async () => {
    const res = await request(app).get('/api/report/project-summary?tenant_id=abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('retorna 400 para tenant_id = 0', async () => {
    const res = await request(app).get('/api/report/project-summary?tenant_id=0');
    expect(res.status).toBe(400);
  });

  it('retorna 404 para tenant_id inexistente', async () => {
    const res = await request(app).get('/api/report/project-summary?tenant_id=999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Concessionária/);
  });

  it('retorna 200 com Content-Type application/pdf', async () => {
    const res = await request(app).get(`/api/report/project-summary?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  it('Content-Disposition contém tenant_id no nome do arquivo', async () => {
    const res = await request(app).get(`/api/report/project-summary?tenant_id=${tenantId}`);
    expect(res.headers['content-disposition']).toMatch(`tenant${tenantId}`);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});
