import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { cache } from '../utils/cache';

const router = Router();

const CACHE_TTL_HEATMAP = 60_000;  // 60 s
const CACHE_TTL_STATS   = 30_000;  // 30 s

// GET /api/poles/alerts — poles below failure threshold (AHI < 30)
router.get('/alerts', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tenantId = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;
    const threshold = 30;

    let poles;
    if (tenantId && !isNaN(tenantId) && tenantId > 0) {
      poles = await db.all(
        'SELECT * FROM poles WHERE ahi_score < ? AND tenant_id = ? ORDER BY ahi_score ASC',
        [threshold, tenantId]
      );
    } else {
      poles = await db.all(
        'SELECT * FROM poles WHERE ahi_score < ? ORDER BY ahi_score ASC',
        [threshold]
      );
    }
    res.json({ threshold, count: poles.length, poles });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// GET /api/poles/heatmap — lightweight endpoint for heatmap layer
router.get('/heatmap', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tenantId = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;
    const cacheKey = `poles.heatmap.${tenantId ?? 'all'}`;
    const cached = cache.get<{ count: number; points: unknown[] }>(cacheKey);
    if (cached) return res.json(cached);

    let points;
    if (tenantId && !isNaN(tenantId) && tenantId > 0) {
      points = await db.all(
        'SELECT id, lat, lng, ahi_score, name FROM poles WHERE tenant_id = ? ORDER BY id ASC',
        [tenantId]
      );
    } else {
      points = await db.all('SELECT id, lat, lng, ahi_score, name FROM poles ORDER BY id ASC');
    }
    const payload = { count: points.length, points };
    cache.set(cacheKey, payload, CACHE_TTL_HEATMAP);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// GET /api/poles/stats — aggregate statistics dashboard
router.get('/stats', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const cacheKey = 'poles.stats';
    const cached = cache.get<Record<string, unknown>>(cacheKey);
    if (cached) return res.json(cached);

    const polesCount = await db.get('SELECT COUNT(*) as count FROM poles');
    const inspectionsCount = await db.get('SELECT COUNT(*) as count FROM labels');

    // NULL ahi_score → 'Sem Dados' (not 'Saudável') to avoid misleading healthy count
    const conditionStats = await db.all(`
      SELECT
        CASE
          WHEN ahi_score IS NULL THEN 'Sem Dados'
          WHEN ahi_score < 50 THEN 'Crítico'
          WHEN ahi_score < 80 THEN 'Atenção'
          ELSE 'Saudável'
        END as condition,
        COUNT(*) as count
      FROM poles
      GROUP BY condition
    `);

    const materialStats = await db.all(`
      SELECT material, COUNT(*) as count
      FROM poles
      WHERE material IS NOT NULL
      GROUP BY material
    `);

    const ahiHistogram = await db.all(`
      SELECT
        CASE
          WHEN ahi_score IS NULL THEN 'Sem Dados'
          WHEN ahi_score BETWEEN 0 AND 20 THEN '0-20'
          WHEN ahi_score BETWEEN 21 AND 40 THEN '21-40'
          WHEN ahi_score BETWEEN 41 AND 60 THEN '41-60'
          WHEN ahi_score BETWEEN 61 AND 80 THEN '61-80'
          ELSE '81-100'
        END as range,
        COUNT(*) as count
      FROM poles
      GROUP BY range
    `);

    const avgRow = await db.get('SELECT AVG(ahi_score) as avg FROM poles WHERE ahi_score IS NOT NULL');

    // Direct count fields for simpler consumption by clients
    const critical = conditionStats.find((c: { condition: string }) => c.condition === 'Crítico')?.count ?? 0;
    const warning  = conditionStats.find((c: { condition: string }) => c.condition === 'Atenção')?.count ?? 0;
    const healthy  = conditionStats.find((c: { condition: string }) => c.condition === 'Saudável')?.count ?? 0;
    const unknown  = conditionStats.find((c: { condition: string }) => c.condition === 'Sem Dados')?.count ?? 0;
    const averageAhi = avgRow?.avg !== null && avgRow?.avg !== undefined
      ? Math.round(avgRow.avg * 10) / 10
      : null;

    const payload = {
      totalPoles: polesCount.count,
      totalInspections: inspectionsCount.count,
      healthy,
      warning,
      critical,
      unknown,
      averageAhi,
      conditionStats,
      materialStats,
      ahiHistogram
    };
    cache.set(cacheKey, payload, CACHE_TTL_STATS);
    res.json(payload);
  } catch (err) {
    console.error('Erro de estatísticas:', err);
    res.status(500).json({ error: 'Erro interno nas estatísticas' });
  }
});

// GET /api/poles/export — export all poles as CSV
router.get('/export', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poles = await db.all('SELECT * FROM poles ORDER BY id ASC');

    const fields = [
      'id', 'name', 'lat', 'lng', 'utm_x', 'utm_y',
      'status', 'ahi_score', 'material', 'installation_date',
      'height', 'structure_type', 'tenant_id', 'created_at'
    ];

    const { Parser } = await import('json2csv');
    const parser = new Parser({ fields });
    const csv = parser.parse(poles);

    res.header('Content-Type', 'text/csv');
    res.attachment(`sisdrone_export_${Date.now()}.csv`);
    return res.send(csv);

  } catch (err) {
    console.error('Erro de exportação:', err);
    res.status(500).json({ error: 'Falha ao exportar CSV' });
  }
});

export default router;
