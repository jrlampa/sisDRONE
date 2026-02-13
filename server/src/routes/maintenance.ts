import { Router } from 'express';
import { getDb } from '../db';

const router = Router();

router.get('/:poleId', async (req, res) => {
  try {
    const { poleId } = req.params;
    const db = await getDb();
    const plans = await db.all(
      'SELECT * FROM maintenance_plans WHERE pole_id = ? ORDER BY created_at DESC',
      [poleId]
    );
    res.json(plans);
  } catch (error) {
    console.error('Failed to fetch maintenance plans:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance plans' });
  }
});

router.patch('/:planId/status', async (req, res) => {
  try {
    const { planId } = req.params;
    const { status } = req.body;
    const db = await getDb();
    await db.run(
      'UPDATE maintenance_plans SET status = ? WHERE id = ?',
      [status, planId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update plan status:', error);
    res.status(500).json({ error: 'Failed to update plan status' });
  }
});

export default router;
