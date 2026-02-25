/**
 * Testes de integração — Inspeção Manual (/api/inspections/manual)
 * Phase 59: formulário de campo estruturado para projetistas (source='manual', sem IA)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

let poleId: number;
let createdLabelId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  const tenantId = tenant?.id ?? 1;
  const r = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status)
     VALUES (?, 'Poste-ManualInsp', -22.15018, -42.92185, 'good')`,
    [tenantId]
  );
  poleId = r.lastID!;
});

describe('Inspeção Manual — POST /api/inspections/manual', () => {
  it('deve retornar 400 quando pole_id for string inválida', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: 'abc', condition: 'bom' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pole_id/i);
  });

  it('deve retornar 400 quando pole_id for zero', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: 0, condition: 'bom' });
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 quando condition estiver ausente', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: poleId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/condition/i);
  });

  it('deve retornar 400 quando condition for inválido', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: poleId, condition: 'excelente' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/condition/i);
  });

  it('deve retornar 400 quando network_level for inválido', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: poleId, condition: 'bom', network_level: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/network_level/i);
  });

  it('deve retornar 400 quando phase_config for inválido', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: poleId, condition: 'bom', phase_config: 'Q' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phase_config/i);
  });

  it('deve retornar 404 quando poste não existir', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: 999999, condition: 'bom' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/poste/i);
  });

  it('deve retornar 201 e criar registro com source=manual', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({
        pole_id: poleId,
        condition: 'atenção',
        notes: 'Poste com inclinação de 5 graus',
        inspector_name: 'João Engenheiro',
        network_level: 'MT',
        structure_config: 'tangente',
        phase_config: 'T',
        num_arms: 3,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.source).toBe('manual');
    expect(res.body.pole_id).toBe(poleId);
    createdLabelId = res.body.id;
  });

  it('deve registrar inspeção mínima (apenas condition)', async () => {
    const res = await request(app)
      .post('/api/inspections/manual')
      .send({ pole_id: poleId, condition: 'bom' });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('manual');
  });

  it('deve aparecer em GET /api/inspections com source=manual', async () => {
    if (!createdLabelId) return;
    const res = await request(app).get('/api/inspections?source=manual');
    expect(res.status).toBe(200);
    const found = res.body.inspections.find((i: { id: number }) => i.id === createdLabelId);
    expect(found).toBeDefined();
    expect(found.source).toBe('manual');
  });
});
