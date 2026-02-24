/**
 * Rotas de Topologia de Rede Elétrica (Phase 30 + Phase 33 + Phase 42)
 *
 *   GET /api/network/graph?tenant_id=         — nós + arestas (JSON-Graph)
 *   GET /api/network/segments?tenant_id=      — segmentos contíguos (componentes conectados)
 *   GET /api/network/isolated?tenant_id=      — postes sem nenhum condutor
 *   GET /api/network/voltage-drop?tenant_id=  — queda de tensão por condutor (NBR 5410)
 *   GET /api/network/validate?tenant_id=      — relatório de validação topológica (loops, dead_ends, duplicatas)
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { getNetworkGraph, getNetworkSegments, getIsolatedPoles } from '../services/networkService';
import { calculateVoltageDrop, type RawConductorRow } from '../services/voltageService';
import { validateTopology, type ValidationEdge, type ValidationNode } from '../services/topologyValidator';
import { simulatePoleFailure, simulateConductorFailure, type SimNode, type SimEdge } from '../services/failureSimulator';

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

/**
 * GET /api/network/voltage-drop  (Phase 33)
 * Calcula queda de tensão estimada para cada condutor com comprimento definido.
 * Usa fórmula simplificada NBR 5410. Condutores sem length são ignorados.
 */
router.get('/voltage-drop', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const tid = parseTenant(req.query.tenant_id);
  if (invalidTenantId(req.query.tenant_id, tid)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();
    const where = tid ? 'WHERE c.tenant_id = ?' : '';
    const params = tid ? [tid] : [];

    const rows: RawConductorRow[] = await db.all(
      `SELECT c.id, c.pole_from, c.pole_to, c.network_type,
              c.computed_length_m, c.length_m, c.voltage_kv,
              pf.name AS from_name, pt.name AS to_name
       FROM conductors c
       JOIN poles pf ON pf.id = c.pole_from
       JOIN poles pt ON pt.id = c.pole_to
       ${where}
       ORDER BY c.id`,
      params
    );

    const results = rows
      .map(r => calculateVoltageDrop(r))
      .filter(Boolean);

    const critical = results.filter(r => r!.status === 'critical').length;
    const warning  = results.filter(r => r!.status === 'warning').length;
    const ok       = results.filter(r => r!.status === 'ok').length;

    res.json({
      total: results.length,
      summary: { critical, warning, ok },
      conductors: results,
    });
  } catch (err) {
    console.error('Erro ao calcular queda de tensão:', err);
    res.status(500).json({ error: 'Erro ao calcular queda de tensão' });
  }
});

/**
 * GET /api/network/validate  (Phase 42)
 * Retorna relatório de validação topológica:
 *   - loops: ciclos detectados por DFS
 *   - dead_ends: postes com apenas 1 conexão
 *   - isolated: postes sem nenhuma conexão
 *   - duplicate_spans: condutores com mesmo par from/to
 *   - is_valid: true quando sem loops e sem duplicatas
 */
router.get('/validate', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const tid = parseTenant(req.query.tenant_id);
  if (invalidTenantId(req.query.tenant_id, tid)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();
    const where = tid ? 'WHERE tenant_id = ?' : '';
    const params = tid ? [tid] : [];

    const [poles, conductors] = await Promise.all([
      db.all<ValidationNode[]>(`SELECT id, name FROM poles ${where}`, params),
      db.all<ValidationEdge[]>(
        `SELECT id, pole_from, pole_to FROM conductors ${tid ? 'WHERE tenant_id = ?' : ''}`,
        params
      ),
    ]);

    const report = validateTopology(poles, conductors);

    res.json({
      node_count:       poles.length,
      edge_count:       conductors.length,
      loops_count:      report.loops.length,
      dead_ends_count:  report.dead_ends.length,
      isolated_count:   report.isolated.length,
      duplicates_count: report.duplicate_spans.length,
      is_valid:         report.is_valid,
      loops:            report.loops,
      dead_ends:        report.dead_ends,
      isolated:         report.isolated,
      duplicate_spans:  report.duplicate_spans,
    });
  } catch (err) {
    console.error('Erro ao validar topologia:', err);
    res.status(500).json({ error: 'Erro ao validar topologia' });
  }
});

/**
 * GET /api/network/simulate-failure  (Phase 47)
 * Simula a remoção de um poste (?pole_id=) ou condutor (?conductor_id=) e
 * retorna os postes afetados, número de partições e estimativa de clientes.
 */
router.get('/simulate-failure', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const tid = parseTenant(req.query.tenant_id);
  if (invalidTenantId(req.query.tenant_id, tid)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  const rawPoleId      = req.query.pole_id;
  const rawConductorId = req.query.conductor_id;

  if (!rawPoleId && !rawConductorId) {
    return res.status(400).json({ error: 'Informe pole_id ou conductor_id para simular a falha' });
  }
  if (rawPoleId && rawConductorId) {
    return res.status(400).json({ error: 'Informe apenas pole_id ou conductor_id, não ambos' });
  }

  const targetId = parseInt(String(rawPoleId ?? rawConductorId), 10);
  if (isNaN(targetId) || targetId <= 0) {
    return res.status(400).json({ error: 'ID inválido para simulação de falha' });
  }

  try {
    const db = await getDb();
    const graph = await getNetworkGraph(db, tid);

    const nodes: SimNode[] = graph.nodes.map(n => ({ id: n.id, name: n.name }));
    const edges: SimEdge[] = graph.edges.map(e => ({ id: e.id, pole_from: e.pole_from, pole_to: e.pole_to }));

    if (rawPoleId !== undefined) {
      const exists = nodes.some(n => n.id === targetId);
      if (!exists) return res.status(404).json({ error: 'Poste não encontrado' });
      const result = simulatePoleFailure(nodes, edges, targetId);
      return res.json(result);
    }

    // conductor_id
    const exists = edges.some(e => e.id === targetId);
    if (!exists) return res.status(404).json({ error: 'Condutor não encontrado' });
    const result = simulateConductorFailure(nodes, edges, targetId);
    return res.json(result);

  } catch (err) {
    console.error('Erro ao simular falha na rede:', err);
    res.status(500).json({ error: 'Erro ao simular falha na rede' });
  }
});

export default router;
