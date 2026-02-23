import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const VALID_ROLES = new Set(['ADMIN', 'ENGINEER', 'VIEWER']);

// GET all users (for assignment selects, etc.)
router.get('/', rateLimit(60, 60_000), async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT id, username, role, tenant_id, created_at FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao buscar usuários' });
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

export default router;
