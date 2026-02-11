import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all poles
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poles = await db.all('SELECT * FROM poles ORDER BY id DESC');
    res.json(poles);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// POST new pole
router.post('/', async (req: Request, res: Response) => {
  const { lat, lng, name, utm_x, utm_y } = req.body;
  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO poles (name, lat, lng, utm_x, utm_y) VALUES (?, ?, ?, ?, ?)',
      [name, lat, lng, utm_x, utm_y]
    );
    res.json({ id: result.lastID, name, lat, lng, utm_x, utm_y });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create pole' });
  }
});

// GET stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const polesCount = await db.get('SELECT COUNT(*) as count FROM poles');
    const inspectionsCount = await db.get('SELECT COUNT(*) as count FROM labels');
    res.json({
      totalPoles: polesCount.count,
      totalInspections: inspectionsCount.count,
      activeAlerts: Math.floor(inspectionsCount.count / 4),
      status: 'Operacional'
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats error' });
  }
});

export default router;
