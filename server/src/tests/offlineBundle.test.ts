/**
 * offlineBundle.test.ts — Phase 48 (backend): Pacote Offline Comprimido
 * Tests for GET /api/offline-bundle
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

let seededTenantId: number;

describe('Offline Bundle — GET /api/offline-bundle', () => {
  beforeAll(async () => {
    const db = await getDb();
    const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
    seededTenantId = tenant?.id ?? 1;

    // Ensure at least one pole in the test tenant
    await db.run(
      `INSERT OR IGNORE INTO poles (tenant_id, name, lat, lng, status)
       VALUES (?, 'OfflineBundle-Pole', -22.15020, -42.92200, 'good')`,
      [seededTenantId]
    );
  });

  it('deve retornar 400 para tenant_id inválido (string)', async () => {
    const res = await request(app).get('/api/offline-bundle?tenant_id=abc');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 para tenant_id = 0', async () => {
    const res = await request(app).get('/api/offline-bundle?tenant_id=0');
    expect(res.status).toBe(400);
  });

  it('deve retornar 200 com Content-Encoding gzip', async () => {
    const res = await request(app).get(`/api/offline-bundle?tenant_id=${seededTenantId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('deve retornar bundle com campos obrigatórios após descomprimir', async () => {
    // supertest/superagent auto-decompresses gzip, so res.body is already the JSON
    const res = await request(app).get(`/api/offline-bundle?tenant_id=${seededTenantId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('generated_at');
    expect(res.body).toHaveProperty('poles');
    expect(res.body).toHaveProperty('conductors');
    expect(res.body).toHaveProperty('circuits');
    expect(Array.isArray(res.body.poles)).toBe(true);
    expect(Array.isArray(res.body.conductors)).toBe(true);
    expect(Array.isArray(res.body.circuits)).toBe(true);
  });

  it('deve retornar bundle sem tenant_id (dados globais)', async () => {
    const res = await request(app).get('/api/offline-bundle');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tenant_id', null);
    expect(Array.isArray(res.body.poles)).toBe(true);
    expect(res.body.poles.length).toBeGreaterThan(0);
  });
});
