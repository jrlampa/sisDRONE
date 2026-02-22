import { Router } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// Get all tenants
router.get('/', rateLimit(60, 60_000), async (req, res) => {
  try {
    const db = await getDb();
    const tenants = await db.all('SELECT * FROM tenants');
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get specific tenant branding
router.get('/:id', rateLimit(60, 60_000), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de tenant inválido' });
  }
  try {
    const db = await getDb();
    const tenant = await db.get('SELECT * FROM tenants WHERE id = ?', id);
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

export default router;
