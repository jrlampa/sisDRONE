/**
 * polesImportCSV.test.ts — Phase 36: Importação em Massa de Postes via CSV
 * Tests for POST /api/poles/import/csv
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  await getDb(); // ensure DB is initialized
});

// Valid CSV string with coordinates inside Brazil bounding box (Nova Friburgo/RJ area)
const VALID_CSV = [
  'name,lat,lng,material,status',
  'Poste CSV-001,-22.15018,-42.92185,Concreto,ok',
  'Poste CSV-002,-22.15100,-42.92000,Madeira,pending',
  'Poste CSV-003,-22.15200,-42.91900,Metal,inspected',
].join('\n');

describe('Phase 36 — POST /api/poles/import/csv', () => {
  it('deve retornar 400 quando nenhum corpo é enviado', async () => {
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/csv')
      .set('x-user-role', 'ENGINEER')
      .send('');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CSV obrigatório/);
  });

  it('deve retornar 400 quando o cabeçalho está errado (faltando lat)', async () => {
    const csv = 'name,lng\nPoste X,-42.92185';
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/csv')
      .set('x-user-role', 'ENGINEER')
      .send(csv);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lat/);
  });

  it('deve retornar 400 para CSV com apenas cabeçalho (sem dados)', async () => {
    const csv = 'name,lat,lng';
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/csv')
      .set('x-user-role', 'ENGINEER')
      .send(csv);
    expect(res.status).toBe(400);
  });

  it('deve importar CSV válido e retornar contagem correta', async () => {
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/csv')
      .set('x-user-role', 'ENGINEER')
      .send(VALID_CSV);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(3);
    expect(res.body.errors).toHaveLength(0);
  });

  it('deve rejeitar linhas com lat/lng inválidos mas importar as válidas', async () => {
    const csv = [
      'name,lat,lng',
      'OK,-22.15018,-42.92185',
      'Bad,abc,def',
      'OutsideBrasil,10,10',
    ].join('\n');
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/csv')
      .set('x-user-role', 'ENGINEER')
      .send(csv);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.errors).toHaveLength(2);
  });

  it('deve rejeitar material inválido na linha mas importar resto', async () => {
    const csv = [
      'name,lat,lng,material',
      'ValidPole,-22.15018,-42.92185,Concreto',
      'BadMaterial,-22.15100,-42.92000,Kryptonita',
    ].join('\n');
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/csv')
      .set('x-user-role', 'ENGINEER')
      .send(csv);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.errors[0].reason).toMatch(/material/);
  });

  it('deve retornar 400 quando mais de 1000 linhas de dados', async () => {
    const rows = Array.from({ length: 1002 }, (_, i) =>
      `Poste-${i},-22.15018,-42.92185`
    );
    const csv = ['name,lat,lng', ...rows].join('\n');
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/csv')
      .set('x-user-role', 'ENGINEER')
      .send(csv);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1000/);
  });

  it('deve aceitar Content-Type: text/plain além de text/csv', async () => {
    const res = await request(app)
      .post('/api/poles/import/csv')
      .set('Content-Type', 'text/plain')
      .set('x-user-role', 'ENGINEER')
      .send('name,lat,lng\nPlainPoste,-22.15018,-42.92185');
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
  });
});
