/**
 * adminRoutes.ts — Dashboard Executivo Multi-Tenant (Phase 43)
 *
 * Endpoints de visão consolidada cross-tenant para administradores globais.
 * Requer header x-user-role: ADMIN.
 *
 *   GET /api/admin/overview        — dados agregados por tenant (ADMIN only)
 *   GET /api/admin/tenants/stats   — tabela comparativa entre tenants (ADMIN only)
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

/** Validates the x-user-role header and rejects non-ADMIN requests. */
function requireAdmin(req: Request, res: Response): boolean {
  const role = req.headers['x-user-role'];
  if (role !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso restrito a administradores' });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/overview
 * Retorna dados agregados de todos os tenants para o painel executivo.
 * Resposta: { tenants: TenantOverview[], total_tenants, total_poles, total_open_orders }
 */
router.get('/overview', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const db = await getDb();

    const tenants = await db.all(
      `SELECT t.id, t.name,
              COUNT(DISTINCT p.id)          AS total_poles,
              AVG(p.ahi_score)              AS avg_ahi,
              SUM(CASE WHEN p.ahi_score < 30 THEN 1 ELSE 0 END) AS critical_poles,
              COUNT(DISTINCT wo.id)         AS open_work_orders,
              MAX(l.created_at)             AS last_inspection
         FROM tenants t
         LEFT JOIN poles p  ON p.tenant_id = t.id
         LEFT JOIN work_orders wo ON wo.pole_id = p.id AND wo.status = 'OPEN'
         LEFT JOIN labels l ON l.pole_id = p.id
        GROUP BY t.id, t.name
        ORDER BY t.name`
    );

    const totalPoles      = tenants.reduce((s: number, r: Record<string, unknown>) => s + ((r.total_poles as number) ?? 0), 0);
    const totalOpenOrders = tenants.reduce((s: number, r: Record<string, unknown>) => s + ((r.open_work_orders as number) ?? 0), 0);

    res.json({
      total_tenants: tenants.length,
      total_poles: totalPoles,
      total_open_orders: totalOpenOrders,
      tenants: tenants.map((t: Record<string, unknown>) => ({
        id:               t.id,
        name:             t.name,
        total_poles:      t.total_poles ?? 0,
        avg_ahi:          t.avg_ahi != null ? Math.round((t.avg_ahi as number) * 10) / 10 : null,
        critical_poles:   t.critical_poles ?? 0,
        open_work_orders: t.open_work_orders ?? 0,
        last_inspection:  t.last_inspection ?? null,
      })),
    });
  } catch (err) {
    console.error('Erro ao gerar overview executivo:', err);
    res.status(500).json({ error: 'Erro ao gerar overview executivo' });
  }
});

/**
 * GET /api/admin/tenants/stats
 * Tabela comparativa por tenant: postes, condutores, OS, AHI.
 */
router.get('/tenants/stats', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const db = await getDb();

    const rows = await db.all(
      `SELECT t.id, t.name,
              COUNT(DISTINCT p.id)  AS total_poles,
              COUNT(DISTINCT c.id)  AS total_conductors,
              AVG(p.ahi_score)      AS avg_ahi,
              SUM(CASE WHEN p.status = 'critical' THEN 1 ELSE 0 END) AS critical_poles,
              COUNT(DISTINCT wo.id) AS total_work_orders,
              SUM(CASE WHEN wo.status = 'OPEN' THEN 1 ELSE 0 END)    AS open_work_orders
         FROM tenants t
         LEFT JOIN poles p       ON p.tenant_id  = t.id
         LEFT JOIN conductors c  ON c.tenant_id  = t.id
         LEFT JOIN work_orders wo ON wo.pole_id  = p.id
        GROUP BY t.id, t.name
        ORDER BY t.name`
    );

    res.json({
      count: rows.length,
      stats: rows.map((r: Record<string, unknown>) => ({
        tenant_id:          r.id,
        tenant_name:        r.name,
        total_poles:        r.total_poles ?? 0,
        total_conductors:   r.total_conductors ?? 0,
        avg_ahi:            r.avg_ahi != null ? Math.round((r.avg_ahi as number) * 10) / 10 : null,
        critical_poles:     r.critical_poles ?? 0,
        total_work_orders:  r.total_work_orders ?? 0,
        open_work_orders:   r.open_work_orders ?? 0,
      })),
    });
  } catch (err) {
    console.error('Erro ao gerar estatísticas por tenant:', err);
    res.status(500).json({ error: 'Erro ao gerar estatísticas por tenant' });
  }
});

export default router;
