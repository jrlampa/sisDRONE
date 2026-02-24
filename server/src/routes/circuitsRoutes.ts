/**
 * circuitsRoutes.ts — Circuitos Elétricos / Alimentadores (Phase 41)
 *
 *   GET    /api/circuits?tenant_id=       — lista circuitos do tenant
 *   POST   /api/circuits                  — cria circuito
 *   GET    /api/circuits/:id              — detalhe do circuito
 *   PUT    /api/circuits/:id              — atualiza circuito
 *   DELETE /api/circuits/:id              — remove circuito (desassocia poles + conductors)
 *   GET    /api/circuits/:id/stats        — AHI médio, postes, condutores, extensão km, custo
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw), 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// GET /api/circuits
router.get('/', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const tenantId = parseId(req.query.tenant_id);
  try {
    const db = await getDb();
    const where = tenantId ? 'WHERE tenant_id = ?' : '';
    const params = tenantId ? [tenantId] : [];
    const rows = await db.all(
      `SELECT id, tenant_id, name, description, color, created_at FROM circuits ${where} ORDER BY name`,
      params
    );
    res.json({ count: rows.length, circuits: rows });
  } catch (err) {
    console.error('Erro ao listar circuitos:', err);
    res.status(500).json({ error: 'Erro ao listar circuitos' });
  }
});

// POST /api/circuits
router.post('/', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { name, description, color, tenant_id } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name é obrigatório' });
  }
  const safeName        = name.trim().slice(0, 100);
  const safeDescription = description ? String(description).slice(0, 500) : null;
  const safeColor       = color ? String(color).slice(0, 20) : '#6366f1';
  const safeTenantId    = parseId(tenant_id) ?? 1;

  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO circuits (tenant_id, name, description, color) VALUES (?, ?, ?, ?)',
      [safeTenantId, safeName, safeDescription, safeColor]
    );
    const circuit = await db.get('SELECT * FROM circuits WHERE id = ?', [result.lastID]);
    res.status(201).json(circuit);
  } catch (err) {
    console.error('Erro ao criar circuito:', err);
    res.status(500).json({ error: 'Erro ao criar circuito' });
  }
});

// GET /api/circuits/:id
router.get('/:id', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de circuito inválido' });
  try {
    const db = await getDb();
    const circuit = await db.get('SELECT * FROM circuits WHERE id = ?', [id]);
    if (!circuit) return res.status(404).json({ error: 'Circuito não encontrado' });
    res.json(circuit);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar circuito' });
  }
});

// GET /api/circuits/:id/stats
router.get('/:id/stats', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de circuito inválido' });
  try {
    const db = await getDb();
    const circuit = await db.get('SELECT * FROM circuits WHERE id = ?', [id]);
    if (!circuit) return res.status(404).json({ error: 'Circuito não encontrado' });

    const [poleStats, conductorStats] = await Promise.all([
      db.get(
        `SELECT COUNT(*) as total_poles,
                AVG(ahi_score) as avg_ahi,
                SUM(CASE WHEN ahi_score < 30 THEN 1 ELSE 0 END) as critical_poles
         FROM poles WHERE circuit_id = ?`,
        [id]
      ),
      db.get(
        `SELECT COUNT(*) as total_conductors,
                SUM(COALESCE(computed_length_m, length_m, 0)) / 1000.0 as total_length_km
         FROM conductors WHERE circuit_id = ?`,
        [id]
      ),
    ]);

    res.json({
      circuit_id: id,
      name: circuit.name,
      total_poles:       poleStats?.total_poles ?? 0,
      avg_ahi:           poleStats?.avg_ahi != null ? Math.round(poleStats.avg_ahi * 10) / 10 : null,
      critical_poles:    poleStats?.critical_poles ?? 0,
      total_conductors:  conductorStats?.total_conductors ?? 0,
      total_length_km:   conductorStats?.total_length_km != null
        ? Math.round(conductorStats.total_length_km * 100) / 100
        : 0,
    });
  } catch (err) {
    console.error('Erro ao calcular stats de circuito:', err);
    res.status(500).json({ error: 'Erro ao calcular estatísticas do circuito' });
  }
});

// PUT /api/circuits/:id
router.put('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de circuito inválido' });

  const { name, description, color } = req.body;
  const updates: string[] = [];
  const params: unknown[] = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name deve ser uma string não vazia' });
    }
    updates.push('name = ?');
    params.push(name.trim().slice(0, 100));
  }
  if (description !== undefined) { updates.push('description = ?'); params.push(String(description).slice(0, 500)); }
  if (color !== undefined)       { updates.push('color = ?');       params.push(String(color).slice(0, 20)); }

  if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM circuits WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Circuito não encontrado' });

    params.push(id);
    await db.run(`UPDATE circuits SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await db.get('SELECT * FROM circuits WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar circuito' });
  }
});

// DELETE /api/circuits/:id — desassocia poles + conductors antes de remover
router.delete('/:id', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID de circuito inválido' });
  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM circuits WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Circuito não encontrado' });

    await db.run('UPDATE poles SET circuit_id = NULL WHERE circuit_id = ?', [id]);
    await db.run('UPDATE conductors SET circuit_id = NULL WHERE circuit_id = ?', [id]);
    await db.run('DELETE FROM circuits WHERE id = ?', [id]);
    res.json({ message: 'Circuito removido com sucesso', id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover circuito' });
  }
});

export default router;
