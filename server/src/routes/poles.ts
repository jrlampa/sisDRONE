import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { haversineMeters } from '../utils/geo';

const router = Router();

// GET all poles (optionally filtered by tenant_id, with pagination)
router.get('/', rateLimit(100, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tenantId = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
    const offset = (page - 1) * limit;

    let poles;
    let total: number;
    if (tenantId && !isNaN(tenantId) && tenantId > 0) {
      const countRow = await db.get('SELECT COUNT(*) as count FROM poles WHERE tenant_id = ?', [tenantId]);
      total = countRow?.count ?? 0;
      poles = await db.all('SELECT * FROM poles WHERE tenant_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [tenantId, limit, offset]);
    } else {
      const countRow = await db.get('SELECT COUNT(*) as count FROM poles');
      total = countRow?.count ?? 0;
      poles = await db.all('SELECT * FROM poles ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    }
    res.json({ poles, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST new pole
router.post('/', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { lat, lng, name, utm_x, utm_y, tenant_id } = req.body;

  // Input validation
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat e lng são obrigatórios e devem ser números' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Coordenadas fora do intervalo válido' });
  }

  const safeName = String(name || `Poste Sem Nome`).slice(0, 100);
  const safeTenantId = Number(tenant_id) || 1;

  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO poles (name, lat, lng, utm_x, utm_y, tenant_id) VALUES (?, ?, ?, ?, ?, ?)',
      [safeName, lat, lng, utm_x || null, utm_y || null, safeTenantId]
    );
    res.json({ id: result.lastID, name: safeName, lat, lng, utm_x, utm_y, tenant_id: safeTenantId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create pole' });
  }
});

// GET nearby poles within a radius (meters)
router.get('/nearby', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));
  const radius = parseFloat(String(req.query.radius));

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    return res.status(400).json({ error: 'lat, lng e radius são obrigatórios' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Coordenadas fora do intervalo válido' });
  }
  if (radius <= 0 || radius > 50000) {
    return res.status(400).json({ error: 'Raio deve estar entre 1 e 50000 metros' });
  }

  try {
    const db = await getDb();
    // Bounding box pre-filter to reduce Haversine comparisons
    // 1 degree latitude ≈ 111,000m; 1 degree longitude ≈ 111,000m * cos(lat)
    const latDelta = radius / 111000;
    const lngDelta = radius / (111000 * Math.cos((lat * Math.PI) / 180));
    const poles = await db.all(
      'SELECT * FROM poles WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?',
      [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]
    );
    const nearby = poles
      .map((p: any) => ({ ...p, distance_m: Math.round(haversineMeters(lat, lng, p.lat, p.lng)) }))
      .filter((p: any) => p.distance_m <= radius)
      .sort((a: any, b: any) => a.distance_m - b.distance_m);

    res.json({ lat, lng, radius_m: radius, count: nearby.length, poles: nearby });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});
// GET /api/poles/alerts — postes abaixo do limiar de falha (AHI < 30)
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

router.get('/stats', rateLimit(60, 60_000), async (req: Request, res: Response) => {
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

// GET export CSV  (must be before /:id to avoid shadowing)
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
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// GET inspection history for a pole (must be before /:id to avoid shadowing)
router.get('/:id/history', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const history = await db.all(`
      SELECT l.*, i.file_path
      FROM labels l
      LEFT JOIN images i ON l.image_id = i.id
      WHERE l.pole_id = ?
      ORDER BY l.created_at DESC
    `, [id]);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// GET condensed summary for a pole: AHI + last inspection + active maintenance plan
router.get('/:id/summary', rateLimit(120, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get(
      'SELECT id, name, ahi_score, status, material, installation_date, tenant_id FROM poles WHERE id = ?',
      [id]
    );
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    const lastInspection = await db.get(`
      SELECT l.label, l.confidence, l.source, l.created_at, i.file_path
      FROM labels l
      LEFT JOIN images i ON l.image_id = i.id
      WHERE l.pole_id = ?
      ORDER BY l.created_at DESC LIMIT 1
    `, [id]);

    const activePlan = await db.get(
      `SELECT id, status, estimated_cost, created_at FROM maintenance_plans
       WHERE pole_id = ? AND status IN ('PENDING','APPROVED')
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    const inspectionCountRow = await db.get(
      'SELECT COUNT(*) as count FROM labels WHERE pole_id = ?',
      [id]
    );

    res.json({
      pole,
      last_inspection: lastInspection ?? null,
      active_plan: activePlan ?? null,
      inspection_count: inspectionCountRow?.count ?? 0,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo do poste' });
  }
});

// GET single pole by id (must be after all named GET routes)
router.get('/:id', rateLimit(120, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT * FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });
    res.json(pole);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// PUT update pole by id (ENGINEER+)
router.put('/:id', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }
  const { name, material, height, structure_type, status } = req.body;
  const VALID_STATUSES = ['pending', 'inspected', 'maintenance', 'critical', 'ok'];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status inválido. Use: ${VALID_STATUSES.join(', ')}` });
  }
  const safeName = name ? String(name).slice(0, 100) : undefined;
  const safeMaterial = material ? String(material).slice(0, 50) : undefined;
  const safeHeight = height !== undefined ? Number(height) : undefined;
  const safeStructureType = structure_type ? String(structure_type).slice(0, 50) : undefined;
  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });
    const updates: string[] = [];
    const params: unknown[] = [];
    if (safeName !== undefined) { updates.push('name = ?'); params.push(safeName); }
    if (safeMaterial !== undefined) { updates.push('material = ?'); params.push(safeMaterial); }
    if (safeHeight !== undefined && !isNaN(safeHeight)) { updates.push('height = ?'); params.push(safeHeight); }
    if (safeStructureType !== undefined) { updates.push('structure_type = ?'); params.push(safeStructureType); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    params.push(id);
    await db.run(`UPDATE poles SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await db.get('SELECT * FROM poles WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// DELETE pole by id (ADMIN only)
router.delete('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });
    await db.run('DELETE FROM poles WHERE id = ?', [id]);
    res.json({ message: 'Poste removido com sucesso', id });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
