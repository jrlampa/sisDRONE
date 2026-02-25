/**
 * circuitHealth.ts — Relatório de Saúde por Circuito (Phase 65)
 *
 *   GET /api/circuits/:id/health
 *
 * Consolida em uma única chamada:
 *   - KPIs do circuito (AHI médio, postes críticos, extensão)
 *   - Distribuição de AHI por faixa
 *   - Queda de tensão (NBR 5410) — condutores do circuito
 *   - Validação topológica (loops, dead_ends, isolated, duplicate_spans)
 *   - Equipamentos por tipo
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { calculateVoltageDrop, type RawConductorRow } from '../services/voltageService';
import { validateTopology, type ValidationNode, type ValidationEdge } from '../services/topologyValidator';

const router = Router({ mergeParams: true });

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw), 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function ahiBand(score: number | null): string {
  if (score == null) return 'sem_dados';
  if (score < 20)   return '0-20';
  if (score < 40)   return '21-40';
  if (score < 60)   return '41-60';
  if (score < 80)   return '61-80';
  return '81-100';
}

/**
 * GET /api/circuits/:id/health
 */
router.get('/:id/health', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de circuito inválido' });

  try {
    const db = await getDb();

    const circuit = await db.get('SELECT * FROM circuits WHERE id = ?', [id]);
    if (!circuit) return res.status(404).json({ error: 'Circuito não encontrado' });

    // All queries in parallel
    const [poles, conductorRows, equipRows] = await Promise.all([
      db.all(
        `SELECT id, name, ahi_score FROM poles WHERE circuit_id = ?`,
        [id]
      ),
      db.all<RawConductorRow[]>(
        `SELECT c.id, c.pole_from, c.pole_to, c.network_type,
                c.computed_length_m, c.length_m, c.voltage_kv,
                pf.name AS from_name, pt.name AS to_name
         FROM conductors c
         JOIN poles pf ON pf.id = c.pole_from
         JOIN poles pt ON pt.id = c.pole_to
         WHERE c.circuit_id = ?`,
        [id]
      ),
      db.all(
        `SELECT e.type, COUNT(*) AS count
         FROM equipment e
         JOIN poles p ON p.id = e.pole_id
         WHERE p.circuit_id = ?
         GROUP BY e.type`,
        [id]
      ),
    ]);

    // AHI stats
    const ahiValues = poles.filter(p => p.ahi_score != null).map(p => p.ahi_score as number);
    const avgAhi = ahiValues.length > 0
      ? Math.round((ahiValues.reduce((s, v) => s + v, 0) / ahiValues.length) * 10) / 10
      : null;
    const criticalPoles = poles.filter(p => (p.ahi_score ?? 100) < 30).length;

    // AHI distribution
    const ahiDistribution: Record<string, number> = {};
    for (const p of poles) {
      const band = ahiBand(p.ahi_score);
      ahiDistribution[band] = (ahiDistribution[band] ?? 0) + 1;
    }

    // Voltage drop
    const vdResults = conductorRows
      .map(r => calculateVoltageDrop(r))
      .filter(Boolean);
    const vdSummary = {
      total:    vdResults.length,
      critical: vdResults.filter(r => r!.status === 'critical').length,
      warning:  vdResults.filter(r => r!.status === 'warning').length,
      ok:       vdResults.filter(r => r!.status === 'ok').length,
    };

    // Topology validation
    const validationNodes: ValidationNode[] = poles.map(p => ({ id: p.id, name: p.name }));
    const validationEdges: ValidationEdge[] = conductorRows.map(c => ({
      id: c.id, pole_from: c.pole_from, pole_to: c.pole_to,
    }));
    const topology = validateTopology(validationNodes, validationEdges);

    // Total length km
    const totalLengthKm = Math.round(
      conductorRows.reduce((s, c) => s + ((c.computed_length_m ?? c.length_m) ?? 0), 0) / 1000 * 100
    ) / 100;

    // Equipment summary
    const equipSummary: Record<string, number> = {};
    for (const row of equipRows) equipSummary[row.type ?? 'Não informado'] = row.count;

    res.json({
      circuit_id:   id,
      circuit_name: circuit.name,
      generated_at: new Date().toISOString(),
      summary: {
        total_poles:     poles.length,
        critical_poles:  criticalPoles,
        avg_ahi:         avgAhi,
        total_conductors: conductorRows.length,
        total_length_km: totalLengthKm,
        is_topology_valid: topology.is_valid,
      },
      ahi_distribution: ahiDistribution,
      voltage_drop:     vdSummary,
      topology: {
        loops_count:      topology.loops.length,
        dead_ends_count:  topology.dead_ends.length,
        isolated_count:   topology.isolated.length,
        duplicates_count: topology.duplicate_spans.length,
        is_valid:         topology.is_valid,
        loops:            topology.loops,
      },
      equipment: equipSummary,
    });
  } catch (err) {
    console.error('Erro ao gerar health do circuito:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório de saúde do circuito' });
  }
});

export default router;
