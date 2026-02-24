/**
 * Testes de integração — Condutores (/api/conductors)
 * Phase 29: spans elétricos entre postes (MT / BT / Ramal)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

let poleFromId: number;
let poleToId: number;
let conductorId: number;

beforeAll(async () => {
  const db = await getDb();

  // Garantir que há um tenant
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  const tenantId = tenant?.id ?? 1;

  // Criar dois postes para os testes
  const r1 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status)
     VALUES (?, 'Poste-Condutor-A', -22.150, -42.921, 'good')`,
    [tenantId]
  );
  poleFromId = r1.lastID!;

  const r2 = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status)
     VALUES (?, 'Poste-Condutor-B', -22.151, -42.922, 'good')`,
    [tenantId]
  );
  poleToId = r2.lastID!;
});

describe('Condutores — GET /api/conductors', () => {
  it('deve retornar 200 com lista vazia ou existente', async () => {
    const res = await request(app)
      .get('/api/conductors')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('conductors');
    expect(Array.isArray(res.body.conductors)).toBe(true);
  });

  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/conductors?tenant_id=abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tenant_id/);
  });

  it('deve retornar 400 para pole_id inválido', async () => {
    const res = await request(app)
      .get('/api/conductors?pole_id=0')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pole_id/);
  });
});

describe('Condutores — POST /api/conductors', () => {
  it('deve retornar 400 se pole_from inválido', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: 'abc', pole_to: poleToId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pole_from/);
  });

  it('deve retornar 400 se pole_to igual a pole_from', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: poleFromId, pole_to: poleFromId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/diferentes/);
  });

  it('deve retornar 400 se voltage_kv inválido', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: poleFromId, pole_to: poleToId, voltage_kv: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/voltage_kv/);
  });

  it('deve retornar 404 se poste de origem não existir', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: 999999, pole_to: poleToId });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/origem/);
  });

  it('deve criar condutor BT com sucesso e retornar 201', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({
        pole_from: poleFromId,
        pole_to: poleToId,
        network_type: 'BT',
        cable_type: 'XLPE 70mm²',
        voltage_kv: 0.22,
        length_m: 80,
        notes: 'Ramal residencial',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.network_type).toBe('BT');
    expect(res.body.cable_type).toBe('XLPE 70mm²');
    conductorId = res.body.id;
  });

  it('deve criar condutor MT com network_type "MT"', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: poleFromId, pole_to: poleToId, network_type: 'MT', voltage_kv: 13.8 });
    expect(res.status).toBe(201);
    expect(res.body.network_type).toBe('MT');
  });

  it('deve usar "BT" como network_type padrão se inválido', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: poleFromId, pole_to: poleToId, network_type: 'INVALID' });
    expect(res.status).toBe(201);
    expect(res.body.network_type).toBe('BT');
  });
});

describe('Condutores — GET /api/conductors/:id', () => {
  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app)
      .get('/api/conductors/abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para condutor inexistente', async () => {
    const res = await request(app)
      .get('/api/conductors/999999')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(404);
  });

  it('deve retornar condutor com coordenadas dos postes', async () => {
    const res = await request(app)
      .get(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('from_lat');
    expect(res.body).toHaveProperty('from_lng');
    expect(res.body).toHaveProperty('to_lat');
    expect(res.body).toHaveProperty('to_lng');
    expect(res.body.pole_from).toBe(poleFromId);
    expect(res.body.pole_to).toBe(poleToId);
  });
});

describe('Condutores — filtro por pole_id', () => {
  it('deve filtrar condutores pelo pole_id', async () => {
    const res = await request(app)
      .get(`/api/conductors?pole_id=${poleFromId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    const all = res.body.conductors as { pole_from: number; pole_to: number }[];
    expect(all.length).toBeGreaterThan(0);
    const valid = all.every(c => c.pole_from === poleFromId || c.pole_to === poleFromId);
    expect(valid).toBe(true);
  });
});

describe('Condutores — DELETE /api/conductors/:id', () => {
  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app)
      .delete('/api/conductors/0')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
  });

  it('deve retornar 404 para condutor inexistente', async () => {
    const res = await request(app)
      .delete('/api/conductors/999999')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(404);
  });

  it('deve remover condutor com sucesso', async () => {
    const res = await request(app)
      .delete(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(conductorId);

    // Verificar que foi removido
    const check = await request(app)
      .get(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ADMIN');
    expect(check.status).toBe(404);
  });
});
