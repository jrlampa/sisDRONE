import { Router, Request, Response } from 'express';
import { getDb } from '../db';
// import { Parser } from 'json2csv'; // Dynamic import used in route to avoid top-level fail if not installed yet (though it is).

const router = Router();

// GET all poles
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poles = await db.all('SELECT * FROM poles ORDER BY id DESC');
    res.json(poles);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST new pole
router.post('/', async (req: Request, res: Response) => {
  const { lat, lng, name, utm_x, utm_y } = req.body;
  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO poles (name, lat, lng, utm_x, utm_y) VALUES (?, ?, ?, ?, ?)',
      [name, lat, lng, utm_x, utm_y]
    );
    res.json({ id: result.lastID, name, lat, lng, utm_x, utm_y });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create pole' });
  }
});

// GET stats (Enhanced for Analytics Dashboard)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = await getDb();

    // 1. Basic Counts
    const polesCount = await db.get('SELECT COUNT(*) as count FROM poles');
    const inspectionsCount = await db.get('SELECT COUNT(*) as count FROM labels');

    // 2. Status Distribution
    // Assuming 'status' column or inferring from AHI
    // Let's use AHI levels for "Condition" if status is generic
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

    // 3. Material Distribution
    const materialStats = await db.all(`
      SELECT material, COUNT(*) as count 
      FROM poles 
      WHERE material IS NOT NULL 
      GROUP BY material
    `);

    // 4. AHI Histogram (Buckets of 20)
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
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Stats error' });
  }
});

// GET export CSV
router.get('/export', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poles = await db.all('SELECT * FROM poles ORDER BY id ASC');

    const fields = [
      'id', 'name', 'lat', 'lng', 'utm_x', 'utm_y',
      'status', 'ahi_score', 'material', 'installation_date',
      'height', 'structure_type', 'tenant_id', 'created_at'
    ];

    // We need to require/import json2csv here or at top. 
    // Since we are in TS module, we should import at top, but for minimal diff let's try dynamic import or assume I'll add top-level import in next step.
    // Actually, I should add the import at the top first or use dynamic import.
    // Let's use dynamic import for cleaner diff or add import in a separate replace call.
    // Better: I will use a multi-replace to add import and route.
    const { Parser } = await import('json2csv');
    const parser = new Parser({ fields });
    const csv = parser.parse(poles);

    res.header('Content-Type', 'text/csv');
    res.attachment(`sisdrone_export_${Date.now()}.csv`);
    return res.send(csv);

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;
