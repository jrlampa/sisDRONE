/**
 * inspectionWizard.test.ts — Phase 63: Wizard de Levantamento em Campo
 * POST /api/inspection/wizard
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

describe('Phase 63 — POST /api/inspection/wizard', () => {
  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({ tenant_id: 'abc', lat: -22.15, lng: -42.92, condition: 'bom' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve retornar 400 para lat inválido', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({ tenant_id: tenantId, lat: 200, lng: -42.92, condition: 'bom' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lat/);
  });

  it('deve retornar 400 para lng inválido', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({ tenant_id: tenantId, lat: -22.15, lng: 999, condition: 'bom' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lng/);
  });

  it('deve retornar 400 para condition inválida', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({ tenant_id: tenantId, lat: -22.15, lng: -42.92, condition: 'perfeito' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/condition/);
  });

  it('deve retornar 400 para tipo de equipamento inválido', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({
        tenant_id: tenantId, lat: -22.15, lng: -42.92, condition: 'bom',
        equipment: [{ type: 'nao-existe' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Tipo de equipamento/);
  });

  it('deve retornar 404 para concessionária inexistente', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({ tenant_id: 999999, lat: -22.15, lng: -42.92, condition: 'bom' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Concession/);
  });

  it('deve criar poste + label em 1 chamada (sem equipamentos)', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({
        tenant_id: tenantId,
        lat: -22.15018,
        lng: -42.92185,
        name: 'Wizard-Pole-1',
        material: 'concreto',
        network_level: 'MT',
        condition: 'atenção',
        notes: 'Poste com inclinação leve',
        inspector_name: 'João Silva',
      });
    expect(res.status).toBe(201);
    expect(res.body.pole_id).toBeTypeOf('number');
    expect(res.body.label_id).toBeTypeOf('number');
    expect(res.body.equipment_ids).toEqual([]);
    expect(res.body.message).toMatch(/sucesso/i);

    // Verify pole was created in DB
    const db = await getDb();
    const pole = await db.get('SELECT * FROM poles WHERE id = ?', [res.body.pole_id]);
    expect(pole).toBeDefined();
    expect(pole.name).toBe('Wizard-Pole-1');
    expect(pole.network_level).toBe('MT');
    expect(pole.lat).toBeCloseTo(-22.15018, 4);
  });

  it('deve criar poste + equipamentos em transação atômica', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({
        tenant_id: tenantId,
        lat: -22.15025,
        lng: -42.92175,
        name: 'Wizard-Pole-2',
        material: 'madeira',
        network_level: 'BT',
        structure_config: 'tangente',
        phase_config: 'T',
        num_arms: 2,
        condition: 'crítico',
        equipment: [
          { type: 'transformador', brand: 'ABB', model: '50kVA' },
          { type: 'para-raios', brand: 'Pronext' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.equipment_ids).toHaveLength(2);
    expect(res.body.pole_id).toBeTypeOf('number');

    // Verify equipment in DB
    const db = await getDb();
    const eqs = await db.all('SELECT * FROM equipment WHERE pole_id = ?', [res.body.pole_id]);
    expect(eqs).toHaveLength(2);
    expect(eqs.map((e: { type: string }) => e.type)).toContain('transformador');
    expect(eqs.map((e: { type: string }) => e.type)).toContain('para-raios');
  });

  it('a label criada deve ter source=manual e incluir condition', async () => {
    const res = await request(app)
      .post('/api/inspection/wizard')
      .set('x-user-role', 'ENGINEER')
      .send({
        tenant_id: tenantId,
        lat: -22.15035,
        lng: -42.92165,
        name: 'Wizard-Label-Test',
        condition: 'bom',
        inspector_name: 'Maria Oliveira',
      });
    expect(res.status).toBe(201);

    const db = await getDb();
    const label = await db.get('SELECT * FROM labels WHERE id = ?', [res.body.label_id]);
    expect(label).toBeDefined();
    expect(label.source).toBe('manual');
    expect(label.label).toContain('bom');
    expect(label.label).toContain('Inspetor: Maria Oliveira');
    expect(label.confidence).toBe(1.0);
  });
});
