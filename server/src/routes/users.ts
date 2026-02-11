import { Router } from 'express';
import { getDb } from '../db';

const router = Router();

// Get all users (for mock switcher)
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.all('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
