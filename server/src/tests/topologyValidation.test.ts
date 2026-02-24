/**
 * topologyValidation.test.ts — Phase 42: Validação de Topologia da Rede
 * Tests for pure service functions + GET /api/network/validate
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';
import {
  validateTopology,
  findLoops,
  findDuplicateSpans,
  findDeadEnds,
  findIsolated,
} from '../services/topologyValidator';

process.env.NODE_ENV = 'test';

let tenantId: number;

beforeAll(async () => {
  const db = await getDb();
  const tenant = await db.get('SELECT id FROM tenants LIMIT 1');
  tenantId = tenant?.id ?? 1;
});

describe('Phase 42 — topologyValidator (pure functions)', () => {
  it('findIsolated: detecta postes sem nenhuma conexão', () => {
    const nodes = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
    const edges = [{ id: 10, pole_from: 1, pole_to: 2 }];
    expect(findIsolated(nodes, edges)).toEqual([3]);
  });

  it('findDeadEnds: detecta postes com grau 1', () => {
    const nodes = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
    const edges = [
      { id: 10, pole_from: 1, pole_to: 2 },
      { id: 11, pole_from: 2, pole_to: 3 },
    ];
    const deadEnds = findDeadEnds(nodes, edges);
    expect(deadEnds).toContain(1);
    expect(deadEnds).toContain(3);
    expect(deadEnds).not.toContain(2);
  });

  it('findDuplicateSpans: detecta condutores com mesmo par from/to', () => {
    const edges = [
      { id: 10, pole_from: 1, pole_to: 2 },
      { id: 11, pole_from: 2, pole_to: 1 }, // reversed — same pair
      { id: 12, pole_from: 2, pole_to: 3 },
    ];
    const dups = findDuplicateSpans(edges);
    expect(dups).toHaveLength(1);
    expect(dups[0].conductor_ids).toContain(10);
    expect(dups[0].conductor_ids).toContain(11);
  });

  it('findLoops: detecta ciclo simples A-B-C-A', () => {
    const nodes = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
    const edges = [
      { id: 10, pole_from: 1, pole_to: 2 },
      { id: 11, pole_from: 2, pole_to: 3 },
      { id: 12, pole_from: 3, pole_to: 1 },
    ];
    const loops = findLoops(nodes, edges);
    expect(loops.length).toBeGreaterThan(0);
  });

  it('findLoops: retorna vazio para grafo linear (sem ciclos)', () => {
    const nodes = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
    const edges = [
      { id: 10, pole_from: 1, pole_to: 2 },
      { id: 11, pole_from: 2, pole_to: 3 },
    ];
    const loops = findLoops(nodes, edges);
    expect(loops).toHaveLength(0);
  });

  it('validateTopology: is_valid=false quando há loop', () => {
    const nodes = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
    const edges = [
      { id: 10, pole_from: 1, pole_to: 2 },
      { id: 11, pole_from: 2, pole_to: 3 },
      { id: 12, pole_from: 3, pole_to: 1 },
    ];
    const result = validateTopology(nodes, edges);
    expect(result.is_valid).toBe(false);
    expect(result.loops.length).toBeGreaterThan(0);
  });

  it('validateTopology: is_valid=true para grafo linear limpo', () => {
    const nodes = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const edges = [{ id: 10, pole_from: 1, pole_to: 2 }];
    const result = validateTopology(nodes, edges);
    expect(result.is_valid).toBe(true);
    expect(result.loops).toHaveLength(0);
    expect(result.duplicate_spans).toHaveLength(0);
  });
});

describe('Phase 42 — GET /api/network/validate', () => {
  it('deve retornar 400 para tenant_id inválido', async () => {
    const res = await request(app)
      .get('/api/network/validate?tenant_id=abc')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(400);
  });

  it('deve retornar 200 com relatório de validação completo', async () => {
    const res = await request(app)
      .get(`/api/network/validate?tenant_id=${tenantId}`)
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('node_count');
    expect(res.body).toHaveProperty('edge_count');
    expect(res.body).toHaveProperty('is_valid');
    expect(res.body).toHaveProperty('loops');
    expect(res.body).toHaveProperty('dead_ends');
    expect(res.body).toHaveProperty('isolated');
    expect(res.body).toHaveProperty('duplicate_spans');
    expect(typeof res.body.is_valid).toBe('boolean');
  });
});
