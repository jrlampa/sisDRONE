import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

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

    let points;
    if (tenantId && !isNaN(tenantId) && tenantId > 0) {
      points = await db.all(
        'SELECT id, lat, lng, ahi_score, name FROM poles WHERE tenant_id = ? ORDER BY id ASC',
        [tenantId]
      );
    } else {
      points = await db.all('SELECT id, lat, lng, ahi_score, name FROM poles ORDER BY id ASC');
    }
    res.json({ count: points.length, points });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// GET /api/poles/stats — aggregate statistics dashboard
router.get('/stats', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();

    const polesCount = await db.get('SELECT COUNT(*) as count FROM poles');
    const inspectionsCount = await db.get('SELECT COUNT(*) as count FROM labels');

    const conditionStats = await db.all(`
      SELECT
        CASE
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

    res.json({
      totalPoles: polesCount.count,
      totalInspections: inspectionsCount.count,
      conditionStats,
      materialStats,
      ahiHistogram
    });
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
