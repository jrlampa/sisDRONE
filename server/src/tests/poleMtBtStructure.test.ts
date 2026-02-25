/**
 * poleMtBtStructure.test.ts — Phase 54: Estruturas MT/BT
 * Testes para campos network_level, structure_config, phase_config, num_arms
 * em POST e PUT /api/poles
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

let poleId: number;

describe('Phase 54 — POST /api/poles com campos MT/BT', () => {
  it('cria poste MT tangente trifásico com sucesso', async () => {
    const res = await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({
        name: 'MTBT-Test-Pole',
        lat: -22.15018,
        lng: -42.92185,
        tenant_id: 1,
        network_level: 'MT',
        structure_config: 'tangente',
        phase_config: 'T',
        num_arms: 2,
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.network_level).toBe('MT');
    expect(res.body.structure_config).toBe('tangente');
    expect(res.body.phase_config).toBe('T');
    expect(res.body.num_arms).toBe(2);
    poleId = res.body.id;
  });

  it('cria poste BT sem campos opcionais (padrão)', async () => {
    const res = await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'BT-Plain', lat: -22.15, lng: -42.92, tenant_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.network_level).toBe('BT');
  });

  it('retorna 400 para network_level inválido', async () => {
    const res = await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'Bad-Level', lat: -22.15, lng: -42.92, network_level: 'ULTRA' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/network_level/i);
  });

  it('retorna 400 para structure_config inválido', async () => {
    const res = await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'Bad-Cfg', lat: -22.15, lng: -42.92, structure_config: 'curva' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/structure_config/i);
  });

  it('retorna 400 para phase_config inválido', async () => {
    const res = await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'Bad-Phase', lat: -22.15, lng: -42.92, phase_config: 'Q' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phase_config/i);
  });
});

describe('Phase 54 — PUT /api/poles/:id com campos MT/BT', () => {
  it('atualiza network_level e structure_config com sucesso', async () => {
    const res = await request(app)
      .put(`/api/poles/${poleId}`)
      .set('x-user-role', 'ADMIN')
      .send({ network_level: 'BT', structure_config: 'derivacao', phase_config: 'M', num_arms: 1 });
    expect(res.status).toBe(200);
    expect(res.body.network_level).toBe('BT');
    expect(res.body.structure_config).toBe('derivacao');
    expect(res.body.phase_config).toBe('M');
    expect(res.body.num_arms).toBe(1);
  });

  it('aceita todos os structure_config válidos', async () => {
    const configs = ['tangente', 'angulo', 'derivacao', 'seccionamento', 'terminal', 'passagem'];
    for (const cfg of configs) {
      const res = await request(app)
        .put(`/api/poles/${poleId}`)
        .set('x-user-role', 'ADMIN')
        .send({ structure_config: cfg });
      expect(res.status).toBe(200);
      expect(res.body.structure_config).toBe(cfg);
    }
  });

  it('retorna 400 para network_level inválido no PUT', async () => {
    const res = await request(app)
      .put(`/api/poles/${poleId}`)
      .set('x-user-role', 'ADMIN')
      .send({ network_level: 'LT' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/network_level/i);
  });
});
