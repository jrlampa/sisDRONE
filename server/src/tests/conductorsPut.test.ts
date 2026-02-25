/**
 * conductorsPut.test.ts — Phase 32: PUT /api/conductors/:id + computed_length_m auto-fill
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

let poleAId: number;
let poleBId: number;
let conductorId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  const tid = tenant?.id ?? 1;

  // Postes com coordenadas reais (Nova Friburgo)
  const rA = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Poste-PUT-A', -22.15018, -42.92185, 'good')`,
    [tid]
  );
  poleAId = rA.lastID!;

  // ~100 m de distância (aprox)
  const rB = await db.run(
    `INSERT INTO poles (tenant_id, name, lat, lng, status) VALUES (?, 'Poste-PUT-B', -22.15108, -42.92185, 'good')`,
    [tid]
  );
  poleBId = rB.lastID!;
});

describe('Phase 32 — computed_length_m automático no POST', () => {
  it('deve preencher computed_length_m ao criar condutor com postes que têm coordenadas', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: poleAId, pole_to: poleBId, network_type: 'BT' });

    expect(res.status).toBe(201);
    expect(res.body.computed_length_m).not.toBeNull();
    expect(typeof res.body.computed_length_m).toBe('number');
    // ~100 m entre lat -22.15018 e -22.15108 (≈ 100.1 m Haversine)
    expect(res.body.computed_length_m).toBeGreaterThan(50);
    expect(res.body.computed_length_m).toBeLessThan(200);
    conductorId = res.body.id;
  });

  it('computed_length_m e length_m são independentes', async () => {
    const res = await request(app)
      .post('/api/conductors')
      .set('x-user-role', 'ENGINEER')
      .send({ pole_from: poleAId, pole_to: poleBId, length_m: 80 });

    expect(res.status).toBe(201);
    expect(res.body.length_m).toBe(80);        // campo manual
    expect(res.body.computed_length_m).toBeGreaterThan(50); // campo automático
  });
});

describe('Phase 32 — PUT /api/conductors/:id', () => {
  it('deve retornar 400 para id inválido', async () => {
    const res = await request(app)
      .put('/api/conductors/abc')
      .set('x-user-role', 'ENGINEER')
      .send({ cable_type: 'XLPE' });
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 sem campos válidos no body', async () => {
    const res = await request(app)
      .put(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ENGINEER')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/campo/i);
  });

  it('deve retornar 400 para network_type inválido', async () => {
    const res = await request(app)
      .put(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ENGINEER')
      .send({ network_type: 'INVALIDO' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/network_type/);
  });

  it('deve retornar 404 para condutor inexistente', async () => {
    const res = await request(app)
      .put('/api/conductors/999999')
      .set('x-user-role', 'ENGINEER')
      .send({ cable_type: 'XLPE' });
    expect(res.status).toBe(404);
  });

  it('deve atualizar cable_type e network_type com sucesso', async () => {
    const res = await request(app)
      .put(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ENGINEER')
      .send({ cable_type: 'XLPE 95mm²', network_type: 'MT', voltage_kv: 13.8 });

    expect(res.status).toBe(200);
    expect(res.body.cable_type).toBe('XLPE 95mm²');
    expect(res.body.network_type).toBe('MT');
    expect(res.body.voltage_kv).toBe(13.8);
    // computed_length_m deve permanecer intacto
    expect(res.body.computed_length_m).toBeGreaterThan(50);
  });

  it('deve atualizar apenas notes sem afetar outros campos', async () => {
    const res = await request(app)
      .put(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ENGINEER')
      .send({ notes: 'Trecho revisado em campo' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Trecho revisado em campo');
    expect(res.body.network_type).toBe('MT'); // preservado do teste anterior
  });

  it('deve retornar o condutor atualizado com coordenadas dos postes', async () => {
    const res = await request(app)
      .put(`/api/conductors/${conductorId}`)
      .set('x-user-role', 'ENGINEER')
      .send({ length_m: 105 });

    expect(res.status).toBe(200);
    expect(res.body.from_lat).toBeDefined();
    expect(res.body.to_lat).toBeDefined();
    expect(res.body.length_m).toBe(105);
  });
});
