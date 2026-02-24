/**
 * kpiRoutes.ts — KPIs Executivos da Rede Elétrica (Phase 49)
 *
 *   GET /api/kpis?tenant_id=&period_days=30
 *
 * Calcula e retorna indicadores de desempenho operacional:
 *   - MTTR (Mean Time to Repair) em horas
 *   - Taxa de inspeção (% de postes inspecionados no período)
 *   - Custo total de manutenção no período
 *   - AHI médio atual vs. período anterior (delta %)
 *   - Postes recuperados (AHI saiu de crítico para bom no período)
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { calculateKpis } from '../services/kpiService';

const router = Router();

function parseTenant(query: unknown): number | null {
  if (!query) return null;
  const n = parseInt(String(query), 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function parsePeriod(query: unknown): number {
  if (query === undefined || query === null || query === '') return 30;
  const n = parseInt(String(query), 10);
  return isNaN(n) ? 30 : n;
}

/**
 * GET /api/kpis
 * Query params:
 *   - tenant_id  (optional) — filtrar por tenant
 *   - period_days (optional, default 30, max 365)
 */
router.get('/', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const tenantId  = parseTenant(req.query.tenant_id);
  const periodDays = parsePeriod(req.query.period_days);

  // If tenant_id was provided but invalid, return 400
  if (
    req.query.tenant_id !== undefined &&
    req.query.tenant_id !== '' &&
    tenantId === null
  ) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  // If period_days was provided but out of range, return 400
  if (req.query.period_days !== undefined) {
    const raw = parseInt(String(req.query.period_days), 10);
    if (isNaN(raw) || raw <= 0 || raw > 365) {
      return res.status(400).json({ error: 'period_days deve ser um inteiro entre 1 e 365' });
    }
  }

  try {
    const db = await getDb();
    const kpis = await calculateKpis(db, tenantId, periodDays);
    res.json(kpis);
  } catch (err) {
    console.error('Erro ao calcular KPIs:', err);
    res.status(500).json({ error: 'Erro ao calcular KPIs' });
  }
});

export default router;
