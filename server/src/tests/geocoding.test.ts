/**
 * geocoding.test.ts — Phase 46: Geocodificação Reversa via Nominatim
 * Tests: unit tests for geocodeService + HTTP tests for cached address endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

import { reverseGeocode, _resetThrottleForTest } from '../services/geocodeService';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

// ─── Unit tests: geocodeService.reverseGeocode ────────────────────────────────
describe('geocodeService — reverseGeocode (unit)', () => {
  beforeEach(() => {
    _resetThrottleForTest();
    vi.clearAllMocks();
  });

  it('retorna GeoAddress com todos os campos quando Nominatim responde', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        display_name: 'Rua das Palmeiras, Nova Friburgo, RJ, Brasil',
        address: {
          road: 'Rua das Palmeiras',
          city: 'Nova Friburgo',
          state: 'Rio de Janeiro',
          postcode: '28600-000',
          country: 'Brasil',
        },
      },
    });

    const result = await reverseGeocode(-22.15018, -42.92185);

    expect(result.display_name).toBe('Rua das Palmeiras, Nova Friburgo, RJ, Brasil');
    expect(result.road).toBe('Rua das Palmeiras');
    expect(result.city).toBe('Nova Friburgo');
    expect(result.state).toBe('Rio de Janeiro');
    expect(result.postcode).toBe('28600-000');
    expect(result.country).toBe('Brasil');
  });

  it('retorna GeoAddress com campos opcionais undefined quando ausentes', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        display_name: 'Ponto Remoto, RJ',
        address: {},
      },
    });

    const result = await reverseGeocode(-22.5, -43.0);

    expect(result.display_name).toBe('Ponto Remoto, RJ');
    expect(result.road).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.state).toBeUndefined();
  });

  it('lança erro quando Nominatim retorna resposta sem display_name', async () => {
    // Mock fails all attempts (MAX_RETRIES = 2 → 3 total calls)
    vi.mocked(axios.get).mockResolvedValue({ data: {} });

    await expect(reverseGeocode(-22.15, -42.92)).rejects.toThrow('Resposta Nominatim inválida');
  }, 15_000);
});

// ─── HTTP integration tests: GET /api/poles/:id/address ───────────────────────
describe('Poles Address — GET /api/poles/:id/address', () => {
  beforeEach(() => {
    _resetThrottleForTest();
    vi.clearAllMocks();
  });

  it('deve retornar 400 para id não numérico', async () => {
    const res = await request(app).get('/api/poles/abc/address');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 404 para poste inexistente', async () => {
    const res = await request(app).get('/api/poles/999998/address');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 200 com endereço em cache sem chamar Nominatim', async () => {
    const db = await getDb();
    const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
    const tenantId = tenant?.id ?? 1;

    const cachedAddress = JSON.stringify({
      display_name: 'Rua Cached, Nova Friburgo, RJ',
      city: 'Nova Friburgo',
      state: 'Rio de Janeiro',
    });

    const r = await db.run(
      `INSERT INTO poles (tenant_id, name, lat, lng, status, address_cache)
       VALUES (?, 'Geocode-Cache-Test', -22.15030, -42.92200, 'good', ?)`,
      [tenantId, cachedAddress]
    );
    const poleId = r.lastID!;

    const res = await request(app).get(`/api/poles/${poleId}/address`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pole_id', poleId);
    expect(res.body).toHaveProperty('cached', true);
    expect(res.body.address).toHaveProperty('display_name', 'Rua Cached, Nova Friburgo, RJ');
    expect(res.body.address).toHaveProperty('city', 'Nova Friburgo');
    // axios.get should NOT have been called (cache hit)
    expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
  });
});
