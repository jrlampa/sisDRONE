/**
 * adminOverview.test.ts — Phase 43: Dashboard Executivo Multi-Tenant
 * Tests for /api/admin/overview and /api/admin/tenants/stats
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('Phase 43 — GET /api/admin/overview', () => {
  it('deve retornar 403 para role ENGINEER', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/administrador/i);
  });

  it('deve retornar 403 para role VIEWER', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('x-user-role', 'VIEWER');
    expect(res.status).toBe(403);
  });

  it('deve retornar 200 com overview para ADMIN', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(typeof res.body.total_tenants).toBe('number');
    expect(typeof res.body.total_poles).toBe('number');
    expect(typeof res.body.total_open_orders).toBe('number');
    expect(Array.isArray(res.body.tenants)).toBe(true);
  });

  it('overview deve conter campos corretos por tenant', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.tenants.length).toBeGreaterThanOrEqual(1);
    const t = res.body.tenants[0];
    expect(t).toHaveProperty('id');
    expect(t).toHaveProperty('name');
    expect(t).toHaveProperty('total_poles');
    expect(t).toHaveProperty('avg_ahi');
    expect(t).toHaveProperty('critical_poles');
    expect(t).toHaveProperty('open_work_orders');
    expect(t).toHaveProperty('last_inspection');
  });
});

describe('Phase 43 — GET /api/admin/tenants/stats', () => {
  it('deve retornar 403 para ENGINEER', async () => {
    const res = await request(app)
      .get('/api/admin/tenants/stats')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(403);
  });

  it('deve retornar 200 com stats por tenant para ADMIN', async () => {
    const res = await request(app)
      .get('/api/admin/tenants/stats')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(typeof res.body.count).toBe('number');
    expect(Array.isArray(res.body.stats)).toBe(true);
    if (res.body.stats.length > 0) {
      const s = res.body.stats[0];
      expect(s).toHaveProperty('tenant_id');
      expect(s).toHaveProperty('tenant_name');
      expect(s).toHaveProperty('total_poles');
      expect(s).toHaveProperty('total_conductors');
      expect(s).toHaveProperty('avg_ahi');
      expect(s).toHaveProperty('open_work_orders');
    }
  });
});
