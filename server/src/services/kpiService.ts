/**
 * kpiService.ts — KPIs Executivos e Indicadores de Confiabilidade (Phase 49)
 *
 * Calcula indicadores de desempenho operacional da rede para um tenant:
 *   - MTTR (Mean Time to Repair): média em horas entre criação e conclusão de OS
 *   - Taxa de inspeção: % de postes inspecionados nos últimos N dias
 *   - Custo total de manutenção: soma de estimated_cost no período
 *   - AHI médio da rede: valor atual vs. período anterior (delta %)
 *   - Postes recuperados: AHI saiu de crítico (<30) para atenção/bom (≥30) no período
 */
import { Database } from 'sqlite';

export interface KpiResult {
  tenant_id: number | null;
  period_days: number;
  mttr_hours: number | null;
  inspection_rate_pct: number;
  maintenance_cost_total: number;
  avg_ahi_current: number | null;
  avg_ahi_previous: number | null;
  avg_ahi_delta_pct: number | null;
  recovered_poles: number;
  inspected_poles: number;
  total_poles: number;
}

/**
 * Calculates all KPIs for a given tenant and time period.
 */
export async function calculateKpis(
  db: Database,
  tenantId: number | null,
  periodDays: number
): Promise<KpiResult> {
  const tenantFilter = tenantId ? 'AND p.tenant_id = ?' : '';
  const tenantParam = tenantId ? [tenantId] : [];

  // Current period start (ISO string compatible with SQLite's DATETIME)
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const periodStartStr   = periodStart.toISOString();
  const previousStartStr = previousStart.toISOString();

  // ── MTTR (Mean Time to Repair in hours) ──────────────────────────────────
  // Only OS completed (status=DONE) in the current period, filtered via pole join
  const mttrWhere = tenantId
    ? 'AND wo.pole_id IN (SELECT id FROM poles WHERE tenant_id = ?)'
    : '';
  const mttrRow = await db.get(
    `SELECT AVG(
       CAST((julianday(updated_at) - julianday(created_at)) * 24 AS REAL)
     ) AS mttr_hours
     FROM work_orders wo
     WHERE wo.status = 'DONE'
       AND wo.updated_at >= ?
       ${mttrWhere}`,
    tenantId ? [periodStartStr, tenantId] : [periodStartStr]
  );

  // ── Inspection rate ───────────────────────────────────────────────────────
  const totalPolesRow = await db.get(
    `SELECT COUNT(*) as count FROM poles WHERE 1=1 ${tenantFilter.replace('AND p.tenant_id', 'AND tenant_id')}`,
    tenantParam
  );
  const totalPoles = totalPolesRow?.count ?? 0;

  const inspectedRow = await db.get(
    `SELECT COUNT(DISTINCT p.id) as count
     FROM poles p
     INNER JOIN labels l ON l.pole_id = p.id
     WHERE l.created_at >= ?
       ${tenantFilter}`,
    [periodStartStr, ...tenantParam]
  );
  const inspectedPoles = inspectedRow?.count ?? 0;
  const inspectionRate = totalPoles > 0 ? Math.round((inspectedPoles / totalPoles) * 1000) / 10 : 0;

  // ── Maintenance cost ──────────────────────────────────────────────────────
  const costRow = await db.get(
    `SELECT COALESCE(SUM(m.estimated_cost), 0) as total
     FROM maintenance_plans m
     INNER JOIN poles p ON p.id = m.pole_id
     WHERE m.created_at >= ?
       ${tenantFilter}`,
    [periodStartStr, ...tenantParam]
  );

  // ── AHI médio atual vs. período anterior ─────────────────────────────────
  const ahiCurrentRow = await db.get(
    `SELECT AVG(ahi_score) as avg_ahi
     FROM poles
     WHERE ahi_score IS NOT NULL
       ${tenantFilter.replace('AND p.tenant_id', 'AND tenant_id')}`,
    tenantParam
  );

  // Previous period AHI from ahi_history snapshots
  const ahiPreviousRow = await db.get(
    `SELECT AVG(h.ahi_score) as avg_ahi
     FROM ahi_history h
     INNER JOIN poles p ON p.id = h.pole_id
     WHERE h.recorded_at >= ? AND h.recorded_at < ?
       ${tenantFilter}`,
    [previousStartStr, periodStartStr, ...tenantParam]
  );

  const ahiCurrent  = ahiCurrentRow?.avg_ahi  != null ? Math.round(ahiCurrentRow.avg_ahi  * 10) / 10 : null;
  const ahiPrevious = ahiPreviousRow?.avg_ahi != null ? Math.round(ahiPreviousRow.avg_ahi * 10) / 10 : null;
  let ahiDelta: number | null = null;
  if (ahiCurrent != null && ahiPrevious != null && ahiPrevious !== 0) {
    ahiDelta = Math.round(((ahiCurrent - ahiPrevious) / ahiPrevious) * 1000) / 10;
  }

  // ── Recovered poles (AHI was <30 before period, is ≥30 now) ─────────────
  const recoveredRow = await db.get(
    `SELECT COUNT(DISTINCT p.id) as count
     FROM poles p
     INNER JOIN (
       SELECT pole_id
       FROM ahi_history
       WHERE recorded_at >= ? AND recorded_at < ?
       GROUP BY pole_id
       HAVING MIN(ahi_score) < 30
     ) h_prev ON h_prev.pole_id = p.id
     WHERE p.ahi_score >= 30
       ${tenantFilter}`,
    [previousStartStr, periodStartStr, ...tenantParam]
  );

  return {
    tenant_id: tenantId,
    period_days: periodDays,
    mttr_hours: mttrRow?.mttr_hours != null ? Math.round(mttrRow.mttr_hours * 10) / 10 : null,
    inspection_rate_pct: inspectionRate,
    maintenance_cost_total: Math.round((costRow?.total ?? 0) * 100) / 100,
    avg_ahi_current:  ahiCurrent,
    avg_ahi_previous: ahiPrevious,
    avg_ahi_delta_pct: ahiDelta,
    recovered_poles: recoveredRow?.count ?? 0,
    inspected_poles: inspectedPoles,
    total_poles: totalPoles,
  };
}
