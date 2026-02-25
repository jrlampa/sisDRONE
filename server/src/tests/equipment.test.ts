/**
 * equipment.test.ts — Phase 53: Equipamentos por Poste
 * Testes de integração para CRUD /api/equipment
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let poleId: number;
let equipmentId: number;

beforeAll(async () => {
  const db = await getDb();
  const res = await db.run(
    `INSERT INTO poles (name, lat, lng, tenant_id) VALUES ('Equip-Test-Pole', -22.15, -42.92, 1)`
  );
  poleId = res.lastID as number;
});

describe('Phase 53 — GET /api/equipment', () => {
  it('retorna 200 com lista vazia quando não há equipamentos', async () => {
    const res = await request(app)
      .get(`/api/equipment?pole_id=${poleId}`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.equipment)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  it('retorna 400 para pole_id inválido', async () => {
    const res = await request(app)
      .get('/api/equipment?pole_id=abc')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
  });

  it('retorna 400 para type inválido', async () => {
    const res = await request(app)
      .get('/api/equipment?type=invalid_type')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type inválido/i);
  });
});

describe('Phase 53 — POST /api/equipment', () => {
  it('retorna 404 para pole_id inexistente', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('x-user-role', 'ADMIN')
      .send({ pole_id: 999999, tenant_id: 1, type: 'transformer' });
    expect(res.status).toBe(404);
  });

  it('retorna 400 quando type está ausente', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('x-user-role', 'ADMIN')
      .send({ pole_id: poleId, tenant_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it('retorna 400 para type inválido', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('x-user-role', 'ADMIN')
      .send({ pole_id: poleId, type: 'jetpack' });
    expect(res.status).toBe(400);
  });

  it('cria equipamento com sucesso e retorna 201', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('x-user-role', 'ADMIN')
      .send({
        pole_id: poleId,
        tenant_id: 1,
        type: 'transformer',
        brand: 'Eletrobras',
        model: 'TR-15kVA',
        serial_number: 'SN-001',
        notes: 'Transformador principal',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.type).toBe('transformer');
    expect(res.body.brand).toBe('Eletrobras');
    expect(res.body.pole_id).toBe(poleId);
    equipmentId = res.body.id;
  });

  it('cria equipamento minimal (somente obrigatórios)', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set('x-user-role', 'ADMIN')
      .send({ pole_id: poleId, type: 'fuse' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('fuse');
    expect(res.body.status).toBe('active');
  });
});

describe('Phase 53 — GET /api/equipment/:id', () => {
  it('retorna 400 para id inválido', async () => {
    const res = await request(app)
      .get('/api/equipment/abc')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
  });

  it('retorna 404 para equipamento inexistente', async () => {
    const res = await request(app)
      .get('/api/equipment/999999')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(404);
  });

  it('retorna equipamento com campos obrigatórios', async () => {
    const res = await request(app)
      .get(`/api/equipment/${equipmentId}`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(equipmentId);
    expect(res.body.type).toBe('transformer');
    expect(res.body.pole_name).toBeDefined();
  });
});

describe('Phase 53 — PUT /api/equipment/:id', () => {
  it('retorna 400 para id inválido', async () => {
    const res = await request(app)
      .put('/api/equipment/abc')
      .set('x-user-role', 'ADMIN')
      .send({ status: 'inactive' });
    expect(res.status).toBe(400);
  });

  it('retorna 404 para equipamento inexistente', async () => {
    const res = await request(app)
      .put('/api/equipment/999999')
      .set('x-user-role', 'ADMIN')
      .send({ status: 'inactive' });
    expect(res.status).toBe(404);
  });

  it('retorna 400 para status inválido', async () => {
    const res = await request(app)
      .put(`/api/equipment/${equipmentId}`)
      .set('x-user-role', 'ADMIN')
      .send({ status: 'broken' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status inválido/i);
  });

  it('atualiza status para defective com sucesso', async () => {
    const res = await request(app)
      .put(`/api/equipment/${equipmentId}`)
      .set('x-user-role', 'ADMIN')
      .send({ status: 'defective', notes: 'Defeito no isolamento' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('defective');
    expect(res.body.notes).toBe('Defeito no isolamento');
  });

  it('retorna 400 quando nenhum campo é fornecido', async () => {
    const res = await request(app)
      .put(`/api/equipment/${equipmentId}`)
      .set('x-user-role', 'ADMIN')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nenhum campo/i);
  });
});

describe('Phase 53 — DELETE /api/equipment/:id', () => {
  it('retorna 400 para id inválido', async () => {
    const res = await request(app)
      .delete('/api/equipment/abc')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
  });

  it('retorna 404 para equipamento inexistente', async () => {
    const res = await request(app)
      .delete('/api/equipment/999999')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(404);
  });

  it('remove equipamento com sucesso', async () => {
    const res = await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(equipmentId);

    // Confirma remoção
    const check = await request(app)
      .get(`/api/equipment/${equipmentId}`)
      .set('x-user-role', 'ADMIN');
    expect(check.status).toBe(404);
  });
});

describe('Phase 53 — GET /api/equipment (filtros)', () => {
  it('filtra por type corretamente', async () => {
    await request(app)
      .post('/api/equipment')
      .set('x-user-role', 'ADMIN')
      .send({ pole_id: poleId, type: 'lightning_rod' });

    const res = await request(app)
      .get(`/api/equipment?pole_id=${poleId}&type=lightning_rod`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    res.body.equipment.forEach((e: { type: string }) => {
      expect(e.type).toBe('lightning_rod');
    });
  });
});
