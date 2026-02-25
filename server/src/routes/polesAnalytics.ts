import express, { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { cache } from '../utils/cache';
import { clusterPoles, type ClusterPole } from '../services/clusterService';

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

/**
 * POST /api/poles/import/csv  (Phase 36)
 *
 * Aceita CSV com cabeçalho obrigatório: name,lat,lng
 * Colunas opcionais: material,status,height,tenant_id
 *   - Content-Type: text/csv  OU  text/plain
 *   - Max 1000 linhas por lote
 *   - Validação por linha (lat/lng numéricos, bounding box Brasil, material whitelist)
 *   - Inserção em transação atômica
 * Retorna: { imported: N, errors: [{ line, reason }] }
 */
const VALID_MATERIALS_IMPORT = new Set(['Concreto', 'Madeira', 'Metal', 'Aço', 'Fibra', 'Outro']);
const VALID_STATUSES_IMPORT  = new Set(['pending', 'inspected', 'maintenance', 'critical', 'ok']);
const LAT_MIN = -35, LAT_MAX = 6, LNG_MIN = -75, LNG_MAX = -28; // bounding box aproximado do Brasil

router.post(
  '/import/csv',
  rateLimit(20, 60_000),
  express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }),
  async (req: Request, res: Response) => {
    const body = req.body as string;
    if (!body || typeof body !== 'string') {
      return res.status(400).json({ error: 'CSV obrigatório no corpo da requisição (Content-Type: text/csv)' });
    }

    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV deve ter cabeçalho e pelo menos uma linha de dado' });
    }

    // Parse + validate header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['name', 'lat', 'lng'];
    const missingHeaders = required.filter(r => !header.includes(r));
    if (missingHeaders.length > 0) {
      return res.status(400).json({ error: `Cabeçalho CSV inválido. Colunas obrigatórias faltando: ${missingHeaders.join(', ')}` });
    }

    const dataLines = lines.slice(1);
    if (dataLines.length > 1000) {
      return res.status(400).json({ error: 'Máximo de 1000 linhas por lote' });
    }

    const idxOf = (col: string) => header.indexOf(col);
    const col = {
      name: idxOf('name'),
      lat:  idxOf('lat'),
      lng:  idxOf('lng'),
      material:   idxOf('material'),
      status:     idxOf('status'),
      height:     idxOf('height'),
      tenant_id:  idxOf('tenant_id'),
    };

    type ImportRow = {
      name: string; lat: number; lng: number;
      material: string | null; status: string | null;
      height: number | null; tenant_id: number;
    };

    const rows: ImportRow[] = [];
    const errors: { line: number; reason: string }[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const lineNum = i + 2; // 1-indexed, +1 for header
      const cells = dataLines[i].split(',').map(c => c.trim());

      const rawLat = parseFloat(cells[col.lat]);
      const rawLng = parseFloat(cells[col.lng]);

      if (isNaN(rawLat) || isNaN(rawLng)) {
        errors.push({ line: lineNum, reason: 'lat e lng devem ser números' });
        continue;
      }
      if (rawLat < LAT_MIN || rawLat > LAT_MAX || rawLng < LNG_MIN || rawLng > LNG_MAX) {
        errors.push({ line: lineNum, reason: 'Coordenadas fora do bounding box do Brasil' });
        continue;
      }

      const rawName = cells[col.name] || '';
      if (!rawName) {
        errors.push({ line: lineNum, reason: 'name é obrigatório' });
        continue;
      }

      const rawMaterial = col.material >= 0 ? (cells[col.material] || null) : null;
      if (rawMaterial && !VALID_MATERIALS_IMPORT.has(rawMaterial)) {
        errors.push({ line: lineNum, reason: `material inválido: ${rawMaterial}` });
        continue;
      }

      const rawStatus = col.status >= 0 ? (cells[col.status] || null) : null;
      if (rawStatus && !VALID_STATUSES_IMPORT.has(rawStatus)) {
        errors.push({ line: lineNum, reason: `status inválido: ${rawStatus}` });
        continue;
      }

      const rawHeight = col.height >= 0 ? parseFloat(cells[col.height]) : NaN;
      const rawTenantId = col.tenant_id >= 0 ? parseInt(cells[col.tenant_id], 10) : NaN;

      rows.push({
        name:      String(rawName).slice(0, 100),
        lat:       rawLat,
        lng:       rawLng,
        material:  rawMaterial,
        status:    rawStatus,
        height:    !isNaN(rawHeight) ? rawHeight : null,
        tenant_id: !isNaN(rawTenantId) && rawTenantId > 0 ? rawTenantId : 1,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha válida encontrada', errors });
    }

    try {
      const db = await getDb();
      await db.run('BEGIN');
      for (const row of rows) {
        await db.run(
          'INSERT INTO poles (name, lat, lng, material, status, height, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [row.name, row.lat, row.lng, row.material, row.status, row.height, row.tenant_id]
        );
      }
      await db.run('COMMIT');
      cache.invalidate('poles.');
      res.json({ imported: rows.length, errors });
    } catch (err) {
      await getDb().then(db => db.run('ROLLBACK')).catch(() => {});
      console.error('Erro ao importar CSV:', err);
      res.status(500).json({ error: 'Falha ao importar postes' });
    }
  }
);

/**
 * GET /api/poles/clusters?tenant_id=&radius_m=  (Phase 66)
 *
 * Agrupa postes próximos usando células de grade (O(n)).
 * Parâmetros:
 *   - tenant_id (opcional): filtro de tenant
 *   - radius_m  (obrigatório): raio de célula em metros (10–5000)
 * Resposta: { cluster_count, total_poles, radius_m, clusters[] }
 */
const MIN_RADIUS_M = 10;
const MAX_RADIUS_M = 5000;

router.get('/clusters', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const tenantId  = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;
  const radiusRaw = parseFloat(String(req.query.radius_m ?? ''));

  if (req.query.tenant_id !== undefined && req.query.tenant_id !== '' && (isNaN(tenantId!) || tenantId! <= 0)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }
  if (isNaN(radiusRaw) || radiusRaw < MIN_RADIUS_M || radiusRaw > MAX_RADIUS_M) {
    return res.status(400).json({ error: `radius_m é obrigatório e deve estar entre ${MIN_RADIUS_M} e ${MAX_RADIUS_M}` });
  }

  try {
    const db = await getDb();
    const where = tenantId && !isNaN(tenantId) && tenantId > 0 ? 'WHERE tenant_id = ?' : '';
    const params = tenantId && !isNaN(tenantId) && tenantId > 0 ? [tenantId] : [];

    const rows = await db.all<ClusterPole[]>(
      `SELECT id, lat, lng, ahi_score, network_level FROM poles ${where} ORDER BY id ASC`,
      params
    );

    const clusters = clusterPoles(rows, radiusRaw);

    res.json({
      cluster_count: clusters.length,
      total_poles:   rows.length,
      radius_m:      radiusRaw,
      clusters,
    });
  } catch (err) {
    console.error('Erro ao agrupar postes:', err);
    res.status(500).json({ error: 'Erro ao agrupar postes por proximidade' });
  }
});

export default router;
