import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const VALID_ROLES = new Set(['ADMIN', 'ENGINEER', 'VIEWER']);

// GET all users (optionally filtered by tenant_id)
router.get('/', rateLimit(60, 60_000), async (req, res) => {
  try {
    const db = await getDb();
    const tenantId = req.query.tenant_id ? parseInt(String(req.query.tenant_id), 10) : null;
    if (tenantId !== null && (isNaN(tenantId) || tenantId <= 0)) {
      return res.status(400).json({ error: 'tenant_id inválido' });
    }
    const whereClause = tenantId ? 'WHERE tenant_id = ?' : '';
    const params = tenantId ? [tenantId] : [];
    const users = await db.all(
      `SELECT id, username, role, tenant_id, created_at FROM users ${whereClause} ORDER BY id ASC`,
      params
    );
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao buscar usuários' });
  }
});

// GET single user by id
router.get('/:id', rateLimit(120, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de usuário inválido' });
  }
  try {
    const db = await getDb();
    const user = await db.get(
      'SELECT id, username, role, tenant_id, created_at FROM users WHERE id = ?',
      [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao buscar usuário' });
  }
});

// PUT update user by id (username and/or role)
router.put('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de usuário inválido' });
  }

  const { username, role } = req.body;
  if (!username && !role) {
    return res.status(400).json({ error: 'Forneça ao menos username ou role para atualizar' });
  }

  const safeUsername = username ? String(username).trim().slice(0, 100).replace(/[^a-zA-Z0-9_.-]/g, '') : undefined;
  if (username && (!safeUsername || safeUsername.length < 3)) {
    return res.status(400).json({ error: 'Username deve ter pelo menos 3 caracteres alfanuméricos' });
  }

  const safeRole = role ? String(role).toUpperCase() : undefined;
  if (safeRole && !VALID_ROLES.has(safeRole)) {
    return res.status(400).json({ error: `Role inválida. Use: ${[...VALID_ROLES].join(', ')}` });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    const fields: string[] = [];
    const values: unknown[] = [];
    if (safeUsername) { fields.push('username = ?'); values.push(safeUsername); }
    if (safeRole)     { fields.push('role = ?');     values.push(safeRole); }
    values.push(id);

    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await db.get(
      'SELECT id, username, role, tenant_id, created_at FROM users WHERE id = ?',
      [id]
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao atualizar usuário' });
  }
});

// DELETE user by id (must not delete yourself; use requester id from mock header or body)
router.delete('/:id', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de usuário inválido' });
  }

  // Prevent self-deletion via optional x-requester-id header
  const requesterId = req.headers['x-requester-id'];
  if (requesterId && parseInt(String(requesterId), 10) === id) {
    return res.status(403).json({ error: 'Não é possível excluir seu próprio usuário' });
  }

  try {
    const db = await getDb();
    const existing = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Usuário não encontrado' });

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Usuário excluído com sucesso', id });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao excluir usuário' });
  }
});

// ── Phase 37: RBAC Granular ────────────────────────────────────────────────

const VALID_RESOURCES = new Set(['poles', 'inspections', 'conductors', 'work_orders', 'circuits', 'network', 'report', 'maintenance', 'admin']);
const VALID_ACTIONS = new Set(['create', 'read', 'update', 'delete', 'admin']);

/**
 * GET /api/users/:id/permissions
 * Lista as permissões granulares atribuídas ao usuário (somente ADMIN).
 */
router.get('/:id/permissions', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de usuário inválido' });
  }
  // Role check — somente ADMIN
  const requesterRole = (req.headers['x-user-role'] as string) || (req as any).jwtUser?.role;
  if (requesterRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado: somente ADMIN pode gerenciar permissões' });
  }
  try {
    const db = await getDb();
    const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const perms = await db.all(
      'SELECT id, resource, action FROM permissions WHERE user_id = ? ORDER BY resource, action',
      [id]
    );
    res.json({ user_id: id, permissions: perms });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao buscar permissões' });
  }
});

/**
 * PUT /api/users/:id/permissions
 * Substitui as permissões granulares do usuário (somente ADMIN).
 * Body: { permissions: [{ resource: string, action: string }] }
 */
router.put('/:id/permissions', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de usuário inválido' });
  }
  // Role check — somente ADMIN
  const requesterRole = (req.headers['x-user-role'] as string) || (req as any).jwtUser?.role;
  if (requesterRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado: somente ADMIN pode gerenciar permissões' });
  }
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Campo permissions deve ser um array' });
  }
  // Validate each entry
  for (const p of permissions) {
    if (!p.resource || !p.action) {
      return res.status(400).json({ error: 'Cada permissão deve ter resource e action' });
    }
    if (!VALID_RESOURCES.has(String(p.resource))) {
      return res.status(400).json({ error: `resource inválido: ${p.resource}` });
    }
    if (!VALID_ACTIONS.has(String(p.action))) {
      return res.status(400).json({ error: `action inválida: ${p.action}` });
    }
  }
  try {
    const db = await getDb();
    const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    // Replace all permissions for this user
    await db.run('DELETE FROM permissions WHERE user_id = ?', [id]);
    for (const p of permissions) {
      await db.run(
        'INSERT OR IGNORE INTO permissions (user_id, resource, action) VALUES (?, ?, ?)',
        [id, String(p.resource), String(p.action)]
      );
    }
    const updated = await db.all(
      'SELECT id, resource, action FROM permissions WHERE user_id = ? ORDER BY resource, action',
      [id]
    );
    res.json({ user_id: id, permissions: updated });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao atualizar permissões' });
  }
});

export default router;
