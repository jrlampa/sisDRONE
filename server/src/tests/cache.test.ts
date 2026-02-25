/**
 * cache.test.ts — Phase 40: Cache In-Memory TTL (utils/cache.ts)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { cache } from '../utils/cache';

beforeEach(() => {
  cache.clear();
});

describe('Phase 40 — InMemoryCache', () => {
  it('deve retornar null em cache miss', () => {
    expect(cache.get('inexistente')).toBeNull();
  });

  it('deve armazenar e recuperar um valor', () => {
    cache.set('key1', { total: 42 }, 5_000);
    const result = cache.get<{ total: number }>('key1');
    expect(result).not.toBeNull();
    expect(result!.total).toBe(42);
  });

  it('deve retornar null após TTL expirar', async () => {
    cache.set('expiring', 'hello', 50); // 50ms TTL
    await new Promise(r => setTimeout(r, 100));
    expect(cache.get('expiring')).toBeNull();
  });

  it('invalidate(prefix) remove apenas entradas com o prefixo', () => {
    cache.set('poles.stats', { total: 10 }, 5_000);
    cache.set('poles.heatmap.1', [1, 2], 5_000);
    cache.set('network.graph', { nodes: [] }, 5_000);

    cache.invalidate('poles.');

    expect(cache.get('poles.stats')).toBeNull();
    expect(cache.get('poles.heatmap.1')).toBeNull();
    expect(cache.get('network.graph')).not.toBeNull(); // não afetado
  });

  it('clear() remove todas as entradas', () => {
    cache.set('a', 1, 5_000);
    cache.set('b', 2, 5_000);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.stats().size).toBe(0);
  });

  it('stats() retorna hits e misses corretos', () => {
    cache.set('x', 99, 5_000);
    cache.get('x');         // hit
    cache.get('inexistente'); // miss
    const s = cache.stats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(1);
    expect(s.size).toBe(1);
  });
});
