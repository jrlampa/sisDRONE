import { Router } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// Get all users (for mock switcher)
router.get('/', rateLimit(60, 60_000), async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT id, username, role, tenant_id, created_at FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao buscar usuários' });
  }
});

export default router;
