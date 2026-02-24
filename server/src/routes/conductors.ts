/**
 * Condutores Elétricos — spans entre postes (MT / BT / Ramal)
 *
 * Endpoints:
 *   GET    /api/conductors           – listar (filtros: tenant_id, pole_id)
 *   POST   /api/conductors           – criar span
 *   GET    /api/conductors/:id       – buscar por ID
 *   DELETE /api/conductors/:id       – excluir span
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const VALID_NETWORK_TYPES = ['MT', 'BT', 'ramal'] as const;
type NetworkType = typeof VALID_NETWORK_TYPES[number];

function isValidNetworkType(v: unknown): v is NetworkType {
  return VALID_NETWORK_TYPES.includes(v as NetworkType);
}

/**
 * GET /api/conductors
 * Retorna lista de condutores com coordenadas dos postes origem/destino.
 * Filtros: tenant_id, pole_id (from ou to)
 */
router.get('/', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const tenantId = req.query.tenant_id ? parseInt(req.query.tenant_id as string, 10) : null;
  const poleId = req.query.pole_id ? parseInt(req.query.pole_id as string, 10) : null;

  if (req.query.tenant_id && (isNaN(tenantId!) || tenantId! <= 0)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }
  if (req.query.pole_id && (isNaN(poleId!) || poleId! <= 0)) {
    return res.status(400).json({ error: 'pole_id inválido' });
  }

  try {
    const db = await getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (tenantId) { conditions.push('c.tenant_id = ?'); params.push(tenantId); }
    if (poleId) { conditions.push('(c.pole_from = ? OR c.pole_to = ?)'); params.push(poleId, poleId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const conductors = await db.all(`
      SELECT
        c.id, c.tenant_id, c.pole_from, c.pole_to,
        c.network_type, c.cable_type, c.voltage_kv, c.length_m, c.notes, c.created_at,
        pf.lat AS from_lat, pf.lng AS from_lng, pf.name AS from_name,
        pt.lat AS to_lat, pt.lng AS to_lng, pt.name AS to_name
      FROM conductors c
      JOIN poles pf ON pf.id = c.pole_from
      JOIN poles pt ON pt.id = c.pole_to
      ${where}
      ORDER BY c.created_at DESC
    `, params);

    res.json({ count: conductors.length, conductors });
  } catch (err) {
    console.error('Erro ao listar condutores:', err);
    res.status(500).json({ error: 'Erro ao listar condutores' });
  }
});

/**
 * POST /api/conductors
 * Cria novo span elétrico entre dois postes.
 * Body: { pole_from, pole_to, network_type?, cable_type?, voltage_kv?, length_m?, notes?, tenant_id? }
 */
router.post('/', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { pole_from, pole_to, network_type, cable_type, voltage_kv, length_m, notes, tenant_id } = req.body;

  const fromId = parseInt(String(pole_from), 10);
  const toId = parseInt(String(pole_to), 10);

  if (isNaN(fromId) || fromId <= 0) return res.status(400).json({ error: 'pole_from inválido' });
  if (isNaN(toId) || toId <= 0) return res.status(400).json({ error: 'pole_to inválido' });
  if (fromId === toId) return res.status(400).json({ error: 'pole_from e pole_to devem ser diferentes' });

  const netType: NetworkType = isValidNetworkType(network_type) ? network_type : 'BT';

  const vKv = voltage_kv !== undefined ? parseFloat(String(voltage_kv)) : null;
  if (voltage_kv !== undefined && (isNaN(vKv!) || vKv! < 0 || vKv! > 500)) {
    return res.status(400).json({ error: 'voltage_kv deve ser entre 0 e 500' });
  }

  const lenM = length_m !== undefined ? parseFloat(String(length_m)) : null;
  if (length_m !== undefined && (isNaN(lenM!) || lenM! < 0 || lenM! > 100_000)) {
    return res.status(400).json({ error: 'length_m deve ser entre 0 e 100000' });
  }

  const sanitizedCableType = cable_type ? String(cable_type).slice(0, 100) : null;
  const sanitizedNotes = notes ? String(notes).slice(0, 1000) : null;
  const tidVal = tenant_id ? parseInt(String(tenant_id), 10) : 1;

  try {
    const db = await getDb();
    const poleFrom = await db.get('SELECT id FROM poles WHERE id = ?', [fromId]);
    if (!poleFrom) return res.status(404).json({ error: `Poste de origem (${fromId}) não encontrado` });

    const poleTo = await db.get('SELECT id FROM poles WHERE id = ?', [toId]);
    if (!poleTo) return res.status(404).json({ error: `Poste de destino (${toId}) não encontrado` });

    const result = await db.run(
      `INSERT INTO conductors (tenant_id, pole_from, pole_to, network_type, cable_type, voltage_kv, length_m, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tidVal, fromId, toId, netType, sanitizedCableType, vKv, lenM, sanitizedNotes]
    );

    const created = await db.get('SELECT * FROM conductors WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    console.error('Erro ao criar condutor:', err);
    res.status(500).json({ error: 'Erro ao criar condutor' });
  }
});

/**
 * GET /api/conductors/:id
 * Retorna dados de um condutor específico.
 */
router.get('/:id', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'id inválido' });

  try {
    const db = await getDb();
    const conductor = await db.get(`
      SELECT
        c.id, c.tenant_id, c.pole_from, c.pole_to,
        c.network_type, c.cable_type, c.voltage_kv, c.length_m, c.notes, c.created_at,
        pf.lat AS from_lat, pf.lng AS from_lng, pf.name AS from_name,
        pt.lat AS to_lat, pt.lng AS to_lng, pt.name AS to_name
      FROM conductors c
      JOIN poles pf ON pf.id = c.pole_from
      JOIN poles pt ON pt.id = c.pole_to
      WHERE c.id = ?
    `, [id]);

    if (!conductor) return res.status(404).json({ error: 'Condutor não encontrado' });
    res.json(conductor);
  } catch (err) {
    console.error('Erro ao buscar condutor:', err);
    res.status(500).json({ error: 'Erro ao buscar condutor' });
  }
});

/**
 * DELETE /api/conductors/:id
 * Remove um span elétrico.
 */
router.delete('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'id inválido' });

  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM conductors WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Condutor não encontrado' });

    await db.run('DELETE FROM conductors WHERE id = ?', [id]);
    res.json({ message: 'Condutor removido com sucesso', id });
  } catch (err) {
    console.error('Erro ao remover condutor:', err);
    res.status(500).json({ error: 'Erro ao remover condutor' });
  }
});

export default router;
