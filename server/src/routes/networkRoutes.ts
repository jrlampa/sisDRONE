/**
 * Rotas de Topologia de Rede Elétrica (Phase 30)
 *
 *   GET /api/network/graph?tenant_id=     — nós + arestas (JSON-Graph)
 *   GET /api/network/segments?tenant_id=  — segmentos contíguos (componentes conectados)
 *   GET /api/network/isolated?tenant_id=  — postes sem nenhum condutor
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { getNetworkGraph, getNetworkSegments, getIsolatedPoles } from '../services/networkService';

const router = Router();

function parseTenant(query: unknown): number | null {
  if (!query) return null;
  const n = parseInt(String(query), 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function invalidTenantId(query: unknown, parsed: number | null): boolean {
  return query !== undefined && query !== null && query !== '' && parsed === null;
}

/**
 * GET /api/network/graph
 * Retorna o grafo da rede: { nodes: Pole[], edges: Conductor[] }
 */
router.get('/graph', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const tid = parseTenant(req.query.tenant_id);
  if (invalidTenantId(req.query.tenant_id, tid)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();
    const graph = await getNetworkGraph(db, tid);
    res.json({
      node_count: graph.nodes.length,
      edge_count: graph.edges.length,
      nodes: graph.nodes,
      edges: graph.edges,
    });
  } catch (err) {
    console.error('Erro ao buscar grafo da rede:', err);
    res.status(500).json({ error: 'Erro ao buscar grafo da rede' });
  }
});

/**
 * GET /api/network/segments
 * Retorna componentes conectados (segmentos de rede).
 */
router.get('/segments', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const tid = parseTenant(req.query.tenant_id);
  if (invalidTenantId(req.query.tenant_id, tid)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();
    const segments = await getNetworkSegments(db, tid);
    res.json({ segment_count: segments.length, segments });
  } catch (err) {
    console.error('Erro ao calcular segmentos da rede:', err);
    res.status(500).json({ error: 'Erro ao calcular segmentos' });
  }
});

/**
 * GET /api/network/isolated
 * Retorna postes sem nenhum condutor conectado.
 */
router.get('/isolated', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const tid = parseTenant(req.query.tenant_id);
  if (invalidTenantId(req.query.tenant_id, tid)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();
    const isolated = await getIsolatedPoles(db, tid);
    res.json({ count: isolated.length, poles: isolated });
  } catch (err) {
    console.error('Erro ao buscar postes isolados:', err);
    res.status(500).json({ error: 'Erro ao buscar postes isolados' });
  }
});

export default router;
