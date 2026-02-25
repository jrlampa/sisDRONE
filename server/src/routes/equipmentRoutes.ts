/**
 * Equipamentos por Poste — Phase 53
 *
 * Endpoints:
 *   GET    /api/equipment            – listar (filtros: pole_id, tenant_id, type, status)
 *   POST   /api/equipment            – cadastrar equipamento em um poste
 *   GET    /api/equipment/:id        – buscar por ID
 *   PUT    /api/equipment/:id        – atualizar campos
 *   DELETE /api/equipment/:id        – remover
 *
 * Tipos: transformer | fuse | recloser | lightning_rod | insulator |
 *        surge_arrester | capacitor_bank | voltage_regulator |
 *        disconnect_switch | meter | other
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const EQUIPMENT_TYPES = [
  'transformer', 'fuse', 'recloser', 'lightning_rod', 'insulator',
  'surge_arrester', 'capacitor_bank', 'voltage_regulator',
  'disconnect_switch', 'meter', 'other',
] as const;
type EquipmentType = typeof EQUIPMENT_TYPES[number];

const EQUIPMENT_STATUSES = ['active', 'inactive', 'defective', 'scheduled_maintenance'] as const;
type EquipmentStatus = typeof EQUIPMENT_STATUSES[number];

function isValidType(v: unknown): v is EquipmentType {
  return EQUIPMENT_TYPES.includes(v as EquipmentType);
}
function isValidStatus(v: unknown): v is EquipmentStatus {
  return EQUIPMENT_STATUSES.includes(v as EquipmentStatus);
}

/**
 * GET /api/equipment
 * Retorna equipamentos com filtros opcionais: pole_id, tenant_id, type, status
 */
router.get('/', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const poleId   = req.query.pole_id   ? parseInt(String(req.query.pole_id),   10) : null;
  const tenantId = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;
  const typeFilter   = req.query.type   ? String(req.query.type)   : null;
  const statusFilter = req.query.status ? String(req.query.status) : null;

  if (poleId !== null && (isNaN(poleId) || poleId <= 0)) {
    return res.status(400).json({ error: 'pole_id inválido' });
  }
  if (tenantId !== null && (isNaN(tenantId) || tenantId <= 0)) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }
  if (typeFilter && !isValidType(typeFilter)) {
    return res.status(400).json({ error: `type inválido. Use: ${EQUIPMENT_TYPES.join(', ')}` });
  }
  if (statusFilter && !isValidStatus(statusFilter)) {
    return res.status(400).json({ error: `status inválido. Use: ${EQUIPMENT_STATUSES.join(', ')}` });
  }

  try {
    const db = await getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (poleId)       { conditions.push('e.pole_id = ?');   params.push(poleId);   }
    if (tenantId)     { conditions.push('e.tenant_id = ?'); params.push(tenantId); }
    if (typeFilter)   { conditions.push('e.type = ?');      params.push(typeFilter); }
    if (statusFilter) { conditions.push('e.status = ?');    params.push(statusFilter); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.all(
      `SELECT e.*, p.name AS pole_name
       FROM equipment e
       LEFT JOIN poles p ON p.id = e.pole_id
       ${where}
       ORDER BY e.created_at DESC`,
      params
    );
    res.json({ count: rows.length, equipment: rows });
  } catch {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

/**
 * POST /api/equipment
 * Cadastra um equipamento em um poste.
 * Obrigatório: pole_id, tenant_id, type
 */
router.post('/', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { pole_id, tenant_id, type, brand, model, serial_number, installation_date, status, notes } = req.body;

  const safePoleId   = parseInt(String(pole_id),   10);
  const safeTenantId = parseInt(String(tenant_id || 1), 10);

  if (isNaN(safePoleId) || safePoleId <= 0) {
    return res.status(400).json({ error: 'pole_id é obrigatório e deve ser um número positivo' });
  }
  if (!type || !isValidType(type)) {
    return res.status(400).json({ error: `type é obrigatório. Use: ${EQUIPMENT_TYPES.join(', ')}` });
  }

  const safeStatus = (status && isValidStatus(status)) ? status : 'active';
  const safeBrand       = brand            ? String(brand).slice(0, 100)           : null;
  const safeModel       = model            ? String(model).slice(0, 100)           : null;
  const safeSerial      = serial_number    ? String(serial_number).slice(0, 100)   : null;
  const safeInstDate    = installation_date ? String(installation_date).slice(0, 10) : null;
  const safeNotes       = notes            ? String(notes).slice(0, 500)           : null;

  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [safePoleId]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    const result = await db.run(
      `INSERT INTO equipment
         (pole_id, tenant_id, type, brand, model, serial_number, installation_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [safePoleId, safeTenantId, type, safeBrand, safeModel, safeSerial, safeInstDate, safeStatus, safeNotes]
    );

    const created = await db.get('SELECT * FROM equipment WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: 'Erro ao cadastrar equipamento' });
  }
});

/**
 * GET /api/equipment/:id
 */
router.get('/:id', rateLimit(120, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  try {
    const db = await getDb();
    const row = await db.get(
      `SELECT e.*, p.name AS pole_name FROM equipment e
       LEFT JOIN poles p ON p.id = e.pole_id
       WHERE e.id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Equipamento não encontrado' });
    res.json(row);
  } catch {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

/**
 * PUT /api/equipment/:id
 * Atualiza campos do equipamento. Todos os campos são opcionais.
 */
router.put('/:id', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const { type, brand, model, serial_number, installation_date, status, notes } = req.body;

  if (type !== undefined && !isValidType(type)) {
    return res.status(400).json({ error: `type inválido. Use: ${EQUIPMENT_TYPES.join(', ')}` });
  }
  if (status !== undefined && !isValidStatus(status)) {
    return res.status(400).json({ error: `status inválido. Use: ${EQUIPMENT_STATUSES.join(', ')}` });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM equipment WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Equipamento não encontrado' });

    const updates: string[] = [];
    const params: unknown[] = [];

    if (type !== undefined)              { updates.push('type = ?');              params.push(type); }
    if (brand !== undefined)             { updates.push('brand = ?');             params.push(String(brand).slice(0, 100)); }
    if (model !== undefined)             { updates.push('model = ?');             params.push(String(model).slice(0, 100)); }
    if (serial_number !== undefined)     { updates.push('serial_number = ?');     params.push(String(serial_number).slice(0, 100)); }
    if (installation_date !== undefined) { updates.push('installation_date = ?'); params.push(String(installation_date).slice(0, 10)); }
    if (status !== undefined)            { updates.push('status = ?');            params.push(status); }
    if (notes !== undefined)             { updates.push('notes = ?');             params.push(String(notes).slice(0, 500)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    params.push(id);
    await db.run(`UPDATE equipment SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await db.get('SELECT * FROM equipment WHERE id = ?', [id]);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

/**
 * DELETE /api/equipment/:id
 */
router.delete('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM equipment WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Equipamento não encontrado' });
    await db.run('DELETE FROM equipment WHERE id = ?', [id]);
    res.json({ message: 'Equipamento removido com sucesso', id });
  } catch {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
