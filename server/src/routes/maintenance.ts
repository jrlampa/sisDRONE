import { Router } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { generatePreventivePlans, getPreventiveSchedule } from '../services/preventiveService';

const VALID_PLAN_STATUSES = ['PENDING', 'APPROVED', 'COMPLETED'] as const;

const router = Router();

// ── Phase 38: Manutenção Preventiva Automática ──────────────────────────────

/**
 * POST /api/maintenance/generate-preventive?tenant_id=
 * Gera planos de manutenção preventiva para postes com AHI < 50 sem plano PENDING.
 */
router.post('/generate-preventive', rateLimit(10, 60_000), async (req, res) => {
  const tenantId = parseInt(String(req.query.tenant_id || '1'), 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }
  try {
    const result = await generatePreventivePlans(tenantId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Falha ao gerar planos preventivos:', error);
    res.status(500).json({ error: 'Falha ao gerar planos preventivos' });
  }
});

/**
 * GET /api/maintenance/preventive-schedule?tenant_id=
 * Retorna agenda de manutenção preventiva dos próximos 90 dias.
 */
router.get('/preventive-schedule', rateLimit(30, 60_000), async (req, res) => {
  const tenantId = parseInt(String(req.query.tenant_id || '1'), 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }
  try {
    const schedule = await getPreventiveSchedule(tenantId);
    res.json({ schedule, total: schedule.length });
  } catch (error) {
    console.error('Falha ao buscar agenda preventiva:', error);
    res.status(500).json({ error: 'Falha ao buscar agenda preventiva' });
  }
});

// GET /api/maintenance/plan/:planId — single plan by ID
router.get('/plan/:planId', rateLimit(60, 60_000), async (req, res) => {
  const planId = parseInt(req.params.planId, 10);
  if (isNaN(planId) || planId <= 0) {
    return res.status(400).json({ error: 'planId inválido' });
  }
  try {
    const db = await getDb();
    const plan = await db.get('SELECT * FROM maintenance_plans WHERE id = ?', [planId]);
    if (!plan) return res.status(404).json({ error: 'Plano de manutenção não encontrado' });
    res.json(plan);
  } catch (error) {
    console.error('Falha ao buscar plano de manutenção:', error);
    res.status(500).json({ error: 'Falha ao buscar plano de manutenção' });
  }
});

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
    console.error('Falha ao buscar planos de manutenção:', error);
    res.status(500).json({ error: 'Falha ao buscar planos de manutenção' });
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
    const plan = await db.get('SELECT id FROM maintenance_plans WHERE id = ?', [planId]);
    if (!plan) return res.status(404).json({ error: 'Plano de manutenção não encontrado' });
    await db.run('UPDATE maintenance_plans SET status = ? WHERE id = ?', [status, planId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Falha ao atualizar status do plano:', error);
    res.status(500).json({ error: 'Falha ao atualizar status do plano' });
  }
});

// DELETE /api/maintenance/:planId — remove a maintenance plan (ADMIN/ENGINEER)
router.delete('/:planId', rateLimit(10, 60_000), async (req, res) => {
  const planId = parseInt(req.params.planId, 10);
  if (isNaN(planId) || planId <= 0) {
    return res.status(400).json({ error: 'planId inválido' });
  }
  try {
    const db = await getDb();
    const plan = await db.get('SELECT id FROM maintenance_plans WHERE id = ?', [planId]);
    if (!plan) return res.status(404).json({ error: 'Plano de manutenção não encontrado' });
    await db.run('DELETE FROM maintenance_plans WHERE id = ?', [planId]);
    res.json({ message: 'Plano de manutenção removido com sucesso', id: planId });
  } catch (error) {
    console.error('Falha ao remover plano de manutenção:', error);
    res.status(500).json({ error: 'Falha ao remover plano de manutenção' });
  }
});

export default router;
