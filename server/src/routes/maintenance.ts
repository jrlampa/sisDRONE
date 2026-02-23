import { Router } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const VALID_PLAN_STATUSES = ['PENDING', 'APPROVED', 'COMPLETED'] as const;

const router = Router();

router.get('/:poleId', rateLimit(60, 60_000), async (req, res) => {
  const poleId = parseInt(req.params.poleId, 10);
  if (isNaN(poleId) || poleId <= 0) {
    return res.status(400).json({ error: 'poleId inválido' });
  }
  try {
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

router.patch('/:planId/status', rateLimit(30, 60_000), async (req, res) => {
  const planId = parseInt(req.params.planId, 10);
  if (isNaN(planId) || planId <= 0) {
    return res.status(400).json({ error: 'planId inválido' });
  }

  const { status } = req.body;
  if (!status || !VALID_PLAN_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Use: ${VALID_PLAN_STATUSES.join(', ')}` });
  }

  try {
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
