/**
 * offlineBundle.ts — Phase 48 (backend): Pacote Offline para Uso em Campo
 * GET /api/offline-bundle?tenant_id= — snapshot JSON comprimido (gzip) para uso sem conexão
 */
import { Router, Request, Response } from 'express';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
const gzipAsync = promisify(gzip);

const MAX_RECORDS = 5_000;

/**
 * GET /api/offline-bundle?tenant_id=
 * Retorna um snapshot comprimido (gzip) com postes, condutores e circuitos do tenant.
 * Projetado para cache offline inicial em campo (PWA).
 */
router.get('/', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  const rawTenantId = req.query.tenant_id;
  if (rawTenantId !== undefined) {
    const tenantId = parseInt(String(rawTenantId), 10);
    if (isNaN(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: 'tenant_id inválido' });
    }
  }

  const tenantId = rawTenantId !== undefined ? parseInt(String(rawTenantId), 10) : null;

  try {
    const db = await getDb();
    const whereClause = tenantId ? 'WHERE tenant_id = ?' : '';
    const baseParams = tenantId ? [tenantId] : [];

    const [poles, conductors, circuits] = await Promise.all([
      db.all(
        `SELECT * FROM poles ${whereClause} ORDER BY id LIMIT ?`,
        [...baseParams, MAX_RECORDS]
      ),
      db.all(
        `SELECT * FROM conductors ${tenantId ? 'WHERE tenant_id = ?' : ''} ORDER BY id LIMIT ?`,
        tenantId ? [tenantId, MAX_RECORDS] : [MAX_RECORDS]
      ),
      db.all(
        `SELECT * FROM circuits ${whereClause} ORDER BY id LIMIT ?`,
        [...baseParams, MAX_RECORDS]
      ),
    ]);

    const bundle = JSON.stringify({
      generated_at: new Date().toISOString(),
      tenant_id: tenantId,
      poles,
      conductors,
      circuits,
    });

    const compressed = await gzipAsync(Buffer.from(bundle, 'utf-8'));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="offline-bundle.json.gz"');
    res.end(compressed);
  } catch (err) {
    console.error('Erro ao gerar bundle offline:', err);
    res.status(500).json({ error: 'Erro ao gerar bundle offline' });
  }
});

export default router;
