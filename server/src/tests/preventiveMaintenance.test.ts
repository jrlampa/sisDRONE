/**
 * preventiveMaintenance.test.ts — Phase 38: Manutenção Preventiva Automática
 * Tests for POST /api/maintenance/generate-preventive and GET /api/maintenance/preventive-schedule
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';
import { getPriority, getActivities } from '../services/preventiveService';

process.env.NODE_ENV = 'test';

let tenantId: number;
let criticalPoleId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;

  // Insert a pole with AHI < 30 (critical) and no existing PENDING plan
  const r = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, ahi_score, status)
     VALUES (?, 'PrevPole-Crítico', -22.151, -42.922, 'concreto', 25, 'active')`,
    [tenantId]
  );
  criticalPoleId = r.lastID!;
  // Pole with AHI = 45 (in warning range)
  await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, ahi_score, status)
     VALUES (?, 'PrevPole-Atenção', -22.152, -42.923, 'madeira', 45, 'active')`,
    [tenantId]
  );
  // Pole with AHI = 80 (healthy — should NOT be included)
  await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, material, ahi_score, status)
     VALUES (?, 'PrevPole-Saudável', -22.153, -42.924, 'metal', 80, 'active')`,
    [tenantId]
  );
});

describe('Phase 38 — Unidade: preventiveService', () => {
  it('getPriority: AHI < 30 = ALTA', () => {
    expect(getPriority(25)).toBe('ALTA');
  });

  it('getPriority: AHI 30–39 = MÉDIA', () => {
    expect(getPriority(35)).toBe('MÉDIA');
    expect(getPriority(39)).toBe('MÉDIA');
  });

  it('getPriority: AHI 40–49 = BAIXA', () => {
    expect(getPriority(45)).toBe('BAIXA');
    expect(getPriority(49)).toBe('BAIXA');
  });

  it('getActivities: AHI < 30 inclui substituição urgente', () => {
    const acts = getActivities(20, 'concreto');
    expect(acts.some(a => a.includes('urgente'))).toBe(true);
  });

  it('getActivities: material concreto adiciona verificação de trincas', () => {
    const acts = getActivities(45, 'concreto');
    expect(acts.some(a => a.includes('trincas'))).toBe(true);
  });

  it('getActivities: material madeira adiciona tratamento preservativo', () => {
    const acts = getActivities(35, 'madeira');
    expect(acts.some(a => a.includes('preservativo'))).toBe(true);
  });
});

describe('Phase 38 — POST /api/maintenance/generate-preventive', () => {
  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app).post('/api/maintenance/generate-preventive?tenant_id=abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve gerar planos para postes com AHI < 50 sem plano PENDING', async () => {
    const res = await request(app)
      .post(`/api/maintenance/generate-preventive?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.generated).toBe('number');
    expect(res.body.generated).toBeGreaterThanOrEqual(2); // ≥ 2 postes (AHI 25 e 45)
    expect(Array.isArray(res.body.plans)).toBe(true);
  });

  it('cada plano deve ter pole_id, priority, activities, estimated_cost', async () => {
    const res = await request(app)
      .post(`/api/maintenance/generate-preventive?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    for (const plan of res.body.plans) {
      expect(plan).toHaveProperty('pole_id');
      expect(plan).toHaveProperty('priority');
      expect(['ALTA', 'MÉDIA', 'BAIXA']).toContain(plan.priority);
      expect(Array.isArray(plan.activities)).toBe(true);
      expect(typeof plan.estimated_cost).toBe('number');
      expect(plan.estimated_cost).toBeGreaterThan(0);
    }
  });

  it('poste saudável (AHI ≥ 50) NÃO deve aparecer nos planos', async () => {
    const res = await request(app)
      .post(`/api/maintenance/generate-preventive?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    const names = res.body.plans.map((p: { pole_name: string }) => p.pole_name);
    expect(names).not.toContain('PrevPole-Saudável');
  });

  it('segundo chamado NÃO gera duplicatas (plano PENDING já existe)', async () => {
    const res1 = await request(app)
      .post(`/api/maintenance/generate-preventive?tenant_id=${tenantId}`);
    const res2 = await request(app)
      .post(`/api/maintenance/generate-preventive?tenant_id=${tenantId}`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Segunda chamada deve gerar 0 planos (todos já têm PENDING)
    expect(res2.body.generated).toBe(0);
  });
});

describe('Phase 38 — GET /api/maintenance/preventive-schedule', () => {
  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app).get('/api/maintenance/preventive-schedule?tenant_id=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve retornar schedule e total', async () => {
    const res = await request(app)
      .get(`/api/maintenance/preventive-schedule?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.schedule)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('cada item do schedule deve ter pole_id, ahi_score, status e estimated_cost', async () => {
    const res = await request(app)
      .get(`/api/maintenance/preventive-schedule?tenant_id=${tenantId}`);
    expect(res.status).toBe(200);
    for (const item of res.body.schedule) {
      expect(item).toHaveProperty('pole_id');
      expect(item).toHaveProperty('ahi_score');
      expect(item.status).toBe('PENDING');
    }
  });
});
