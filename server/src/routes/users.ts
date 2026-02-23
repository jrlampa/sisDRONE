import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

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

export default router;
