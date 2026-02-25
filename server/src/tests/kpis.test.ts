/**
 * kpis.test.ts — Phase 49: KPIs Executivos e Indicadores de Confiabilidade
 * Tests for GET /api/kpis
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
});

describe('Phase 49 — GET /api/kpis', () => {
  it('deve retornar 200 com todos os campos KPI', async () => {
    const res = await request(app)
      .get('/api/kpis')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('period_days');
    expect(res.body).toHaveProperty('mttr_hours');
    expect(res.body).toHaveProperty('inspection_rate_pct');
    expect(res.body).toHaveProperty('maintenance_cost_total');
    expect(res.body).toHaveProperty('avg_ahi_current');
    expect(res.body).toHaveProperty('avg_ahi_previous');
    expect(res.body).toHaveProperty('avg_ahi_delta_pct');
    expect(res.body).toHaveProperty('recovered_poles');
    expect(res.body).toHaveProperty('inspected_poles');
    expect(res.body).toHaveProperty('total_poles');
  });

  it('period_days padrão deve ser 30', async () => {
    const res = await request(app)
      .get('/api/kpis')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.period_days).toBe(30);
  });

  it('deve aceitar period_days customizado', async () => {
    const res = await request(app)
      .get('/api/kpis?period_days=7')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.period_days).toBe(7);
  });

  it('deve retornar 400 para period_days inválido', async () => {
    const res = await request(app)
      .get('/api/kpis?period_days=999')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/period_days/);
  });

  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/kpis?tenant_id=abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve filtrar por tenant_id válido', async () => {
    const res = await request(app)
      .get(`/api/kpis?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.tenant_id).toBe(tenantId);
    expect(typeof res.body.total_poles).toBe('number');
  });

  it('total_poles deve ser >= 0', async () => {
    const res = await request(app)
      .get('/api/kpis')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.total_poles).toBeGreaterThanOrEqual(0);
    expect(res.body.maintenance_cost_total).toBeGreaterThanOrEqual(0);
    expect(res.body.recovered_poles).toBeGreaterThanOrEqual(0);
  });

  it('inspection_rate_pct deve estar entre 0 e 100', async () => {
    const res = await request(app)
      .get(`/api/kpis?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body.inspection_rate_pct).toBeGreaterThanOrEqual(0);
    expect(res.body.inspection_rate_pct).toBeLessThanOrEqual(100);
  });
});
