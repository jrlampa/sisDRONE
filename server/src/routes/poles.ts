import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { haversineMeters } from '../utils/geo';
import { cache } from '../utils/cache';
import { reverseGeocode } from '../services/geocodeService';

const router = Router();

const VALID_SORT_MAP: Record<string, string> = {
  name_asc: 'name ASC',
  name_desc: 'name DESC',
  ahi_asc: 'ahi_score ASC',
  ahi_desc: 'ahi_score DESC',
  created_asc: 'id ASC',
  created_desc: 'id DESC',
};

// GET all poles (optionally filtered by tenant_id, ahi_min, ahi_max, status, with pagination + sort)
router.get('/', rateLimit(100, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tenantId = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;
    const ahiMin = req.query.ahi_min !== undefined ? parseFloat(String(req.query.ahi_min)) : null;
    const ahiMax = req.query.ahi_max !== undefined ? parseFloat(String(req.query.ahi_max)) : null;
    const statusFilter = req.query.status ? String(req.query.status) : null;
    const sortKey = String(req.query.sort || 'created_desc');
    const orderBy = VALID_SORT_MAP[sortKey] ?? 'id DESC';

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (tenantId && !isNaN(tenantId) && tenantId > 0) {
      conditions.push('tenant_id = ?');
      params.push(tenantId);
    }
    if (ahiMin !== null && !isNaN(ahiMin)) {
      conditions.push('ahi_score >= ?');
      params.push(ahiMin);
    }
    if (ahiMax !== null && !isNaN(ahiMax)) {
      conditions.push('ahi_score <= ?');
      params.push(ahiMax);
    }
    if (statusFilter) {
      conditions.push('status = ?');
      params.push(statusFilter);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = await db.get(`SELECT COUNT(*) as count FROM poles ${whereClause}`, params);
    const total: number = countRow?.count ?? 0;
    const poles = await db.all(
      `SELECT * FROM poles ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

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
    cache.invalidate('poles.'); // invalidate stats & heatmap cache
    res.json({ id: result.lastID, name: safeName, lat, lng, utm_x, utm_y, tenant_id: safeTenantId });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao criar poste' });
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
// GET images for a pole (must be before /:id to avoid shadowing)
router.get('/:id/images', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });
    const images = await db.all(
      'SELECT id, file_path, captured_at FROM images WHERE pole_id = ? ORDER BY captured_at DESC',
      [id]
    );
    res.json({ pole_id: id, count: images.length, images });
  } catch (err) {
    console.error('Erro ao buscar imagens do poste:', err);
    res.status(500).json({ error: 'Erro ao buscar imagens do poste' });
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

// GET AHI history (série temporal) for a pole — Phase 34
router.get('/:id/ahi-history', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  const limit = Math.min(parseInt(String(req.query.limit ?? '30'), 10) || 30, 100);

  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    const history = await db.all(
      `SELECT id, pole_id, ahi_score, recorded_at
       FROM ahi_history
       WHERE pole_id = ?
       ORDER BY recorded_at DESC
       LIMIT ?`,
      [id, limit]
    );
    res.json({ pole_id: id, count: history.length, history });
  } catch (err) {
    console.error('Erro ao buscar histórico AHI:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico AHI' });
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
    console.error('Erro de resumo:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo do poste' });
  }
});

// GET work orders for a pole (convenience endpoint)
router.get('/:id/work-orders', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });
    const workOrders = await db.all(
      `SELECT w.*, u.username as assignee_name
       FROM work_orders w
       LEFT JOIN users u ON w.assignee_id = u.id
       WHERE w.pole_id = ? ORDER BY w.created_at DESC`,
      [id]
    );
    res.json({ pole_id: id, count: workOrders.length, work_orders: workOrders });
  } catch (err) {
    console.error('Erro ao buscar ordens de serviço do poste:', err);
    res.status(500).json({ error: 'Erro ao buscar ordens de serviço do poste' });
  }
});

// GET timeline of events for a pole (Phase 45 — inspections + AHI snapshots, sorted by date DESC)
router.get('/:id/timeline', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    const inspections = await db.all(
      `SELECT l.id, 'inspection' as type, l.label, l.confidence, l.source,
              l.created_at as date, i.file_path
       FROM labels l LEFT JOIN images i ON l.image_id = i.id
       WHERE l.pole_id = ? ORDER BY l.created_at DESC`,
      [id]
    );

    const ahiRows = await db.all(
      `SELECT id, ahi_score, recorded_at as date
       FROM ahi_history WHERE pole_id = ? ORDER BY recorded_at DESC`,
      [id]
    );

    // Compute delta_ahi = current - previous (positive = improvement)
    const ahiEntries = ahiRows.map((row, idx) => {
      const older = ahiRows[idx + 1];
      return {
        type: 'ahi_snapshot' as const,
        date: row.date,
        id: row.id,
        ahi_score: row.ahi_score,
        delta_ahi: older != null ? (row.ahi_score - older.ahi_score) : null,
      };
    });

    const timeline = [...inspections, ...ahiEntries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ pole_id: id, count: timeline.length, timeline });
  } catch (err) {
    console.error('Erro ao buscar timeline do poste:', err);
    res.status(500).json({ error: 'Erro ao buscar timeline do poste' });
  }
});

// GET reverse-geocoded address for a pole (Phase 46 — Nominatim, cached in address_cache)
router.get('/:id/address', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT id, lat, lng, address_cache FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    if (pole.address_cache) {
      return res.json({ pole_id: id, address: JSON.parse(pole.address_cache), cached: true });
    }

    const address = await reverseGeocode(pole.lat, pole.lng);
    await db.run('UPDATE poles SET address_cache = ? WHERE id = ?', [JSON.stringify(address), id]);
    res.json({ pole_id: id, address, cached: false });
  } catch (err) {
    console.error('Erro ao geocodificar poste:', err);
    res.status(502).json({ error: 'Erro ao buscar endereço: serviço externo indisponível' });
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
    cache.invalidate('poles.'); // invalidate stats & heatmap cache
    const updated = await db.get('SELECT * FROM poles WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// DELETE pole by id (ADMIN only) — cascades to labels, images, maintenance_plans, work_orders, video_sessions
router.delete('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [id]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });
    // Cascade delete related records before removing the pole
    await db.run('DELETE FROM labels WHERE pole_id = ?', [id]);
    await db.run('DELETE FROM images WHERE pole_id = ?', [id]);
    await db.run('DELETE FROM maintenance_plans WHERE pole_id = ?', [id]);
    await db.run('DELETE FROM work_orders WHERE pole_id = ?', [id]);
    await db.run('DELETE FROM video_sessions WHERE pole_id = ?', [id]);
    await db.run('DELETE FROM poles WHERE id = ?', [id]);
    cache.invalidate('poles.'); // invalidate stats & heatmap cache
    res.json({ message: 'Poste removido com sucesso', id });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
