/**
 * cache.ts — Cache In-Memory com TTL (Phase 40)
 *
 * Cache simples baseado em Map para reduzir carga no SQLite em
 * endpoints de alta leitura (stats, heatmap, grafo de rede).
 *
 * API:
 *   cache.get(key)                    → valor ou null (miss)
 *   cache.set(key, value, ttlMs)      → armazena com expiração
 *   cache.invalidate(prefix)          → remove todas as entradas com key.startsWith(prefix)
 *   cache.clear()                     → limpa tudo
 *   cache.stats()                     → { size, hits, misses }
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private hitCount = 0;
  private missCount = 0;

  /**
   * Retrieve a cached value. Returns null on miss or expired entry.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.missCount++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missCount++;
      return null;
    }
    this.hitCount++;
    return entry.value;
  }

  /**
   * Store a value with a TTL in milliseconds.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Remove all keys that start with the given prefix.
   */
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /**
   * Remove all entries from the cache.
   */
  clear(): void {
    this.store.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Return current cache diagnostics.
   */
  stats(): { size: number; hits: number; misses: number } {
    return { size: this.store.size, hits: this.hitCount, misses: this.missCount };
  }
}

/** Singleton cache instance shared across the process */
export const cache = new InMemoryCache();
