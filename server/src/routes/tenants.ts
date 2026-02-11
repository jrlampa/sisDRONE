import { Router } from 'express';
import { getDb } from '../db';

const router = Router();

// Get all tenants
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const tenants = await db.all('SELECT * FROM tenants');
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get specific tenant branding
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    // Fixing variable name error (database -> db)
    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

export default router;
