/**
 * ANEEL OpenData Proxy
 *
 * Consulta a API pública do ANEEL (CKAN) para obter dados de agentes
 * de distribuição de energia elétrica. Zero custo — API governamental gratuita.
 *
 * Referência: https://dadosabertos.aneel.gov.br
 */
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const ANEEL_API_BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';

// Simple in-memory cache to avoid hammering the ANEEL API
interface CacheEntry<T> { data: T; expiresAt: number }
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}
function toCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const VALID_UF = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]);

/**
 * GET /api/aneel/agents
 * Returns list of electricity distribution agents from ANEEL Open Data.
 * Query params: ?uf=RJ&limit=100
 */
router.get('/agents', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const rawUf = req.query.uf ? String(req.query.uf).toUpperCase().trim() : '';
  const uf = rawUf && VALID_UF.has(rawUf) ? rawUf : '';
  if (rawUf && !uf) {
    return res.status(400).json({ error: `UF inválida. Use um dos 27 estados brasileiros (ex: RJ, SP).` });
  }
  const rawLimit = parseInt(String(req.query.limit || '100'), 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 100 : rawLimit), 500);

  const cacheKey = `agents_${uf}_${limit}`;
  const cached = fromCache<unknown[]>(cacheKey);
  if (cached) {
    return res.json({ source: 'cache', count: cached.length, agents: cached });
  }

  try {
    // ANEEL's CKAN API: Agentes do Setor Elétrico – Tipo: Distribuidora
    const url = `${ANEEL_API_BASE}/datastore_search`;
    const params: Record<string, string | number> = {
      resource_id: 'b1bd71e7-d0ad-4214-9053-cbd58e9564a7',
      limit,
      fields: 'SigAgente,NomAgente,NomMunicipio,SigUFPrincipal,SigSegmentoEmpresas',
    };
    if (uf) params.q = JSON.stringify({ SigUFPrincipal: uf });

    const response = await axios.get(url, { params, timeout: 8000 });
    const records: any[] = (response.data as any)?.result?.records ?? [];

    const agents = records.map((r: any) => ({
      sigla: r.SigAgente ?? '',
      nome: r.NomAgente ?? '',
      municipio: r.NomMunicipio ?? '',
      uf: r.SigUFPrincipal ?? '',
      segmento: r.SigSegmentoEmpresas ?? '',
    }));

    toCache(cacheKey, agents);
    return res.json({ source: 'aneel', count: agents.length, agents });
  } catch (err: any) {
    console.error('[ANEEL] Erro na API:', err.message);
    return res.status(502).json({ error: 'Falha ao consultar ANEEL OpenData. Tente novamente.' });
  }
});

/**
 * GET /api/aneel/datasets
 * Returns list of available ANEEL datasets (CKAN package list).
 */
router.get('/datasets', rateLimit(10, 60_000), async (_req: Request, res: Response) => {
  const cacheKey = 'datasets';
  const cached = fromCache<string[]>(cacheKey);
  if (cached) return res.json({ source: 'cache', datasets: cached });

  try {
    const response = await axios.get(`${ANEEL_API_BASE}/package_list`, { timeout: 8000 });
    const datasets: string[] = (response.data as any)?.result ?? [];
    toCache(cacheKey, datasets);
    return res.json({ source: 'aneel', datasets });
  } catch (err: any) {
    console.error('[ANEEL] Erro nos datasets:', err.message);
    return res.status(502).json({ error: 'Falha ao consultar datasets do ANEEL.' });
  }
});

export default router;
