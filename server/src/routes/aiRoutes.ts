import { Router } from 'express';
import { getDb } from '../db';
import { generateMaintenancePlan } from '../services/groqService';
import { calculatePlanCost } from '../services/costService';
import { chatWithData } from '../services/chatService';
import { calculateAHI } from '../services/healthService';
import { predictLifespan } from '../services/predictionService';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.get('/predict/:id', rateLimit(30, 60_000), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const pole = await db.get('SELECT * FROM poles WHERE id = ?', [id]);

    if (!pole) {
      return res.status(404).json({ error: 'Poste não encontrado' });
    }

    const prediction = predictLifespan(pole);
    res.json(prediction);
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Falha ao gerar previsão' });
  }
});

router.post('/plan', rateLimit(10, 60_000), async (req, res) => {
  try {
    const { analysis, poleId } = req.body;

    if (!analysis) {
      return res.status(400).json({ error: 'Analysis data is required' });
    }

    const safePoleId = poleId !== undefined ? parseInt(String(poleId), 10) : NaN;
    if (poleId !== undefined && (isNaN(safePoleId) || safePoleId <= 0)) {
      return res.status(400).json({ error: 'poleId inválido' });
    }

    console.log(`[AI] Generating maintenance plan for Pole ${poleId}...`);
    const planText = await generateMaintenancePlan(analysis);
    const estimatedCost = await calculatePlanCost(planText);

    const db = await getDb();

    // Calculate AHI
    const pole = await db.get('SELECT * FROM poles WHERE id = ?', [safePoleId]);
    const ahi = calculateAHI(pole, analysis);
    await db.run('UPDATE poles SET ahi_score = ? WHERE id = ?', [ahi, safePoleId]);

    const result = await db.run(
      'INSERT INTO maintenance_plans (pole_id, plan_text, status, estimated_cost) VALUES (?, ?, ?, ?)',
      [safePoleId, planText, 'PENDING', estimatedCost]
    );

    res.json({ plan: planText, planId: result.lastID, estimatedCost });
  } catch (error) {
    console.error('Failed to generate plan:', error);
    res.status(500).json({ error: 'Failed to generate maintenance plan' });
  }
});

router.post('/chat', rateLimit(20, 60_000), async (req, res) => {
  const { message, context } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message é obrigatório' });
  }
  const safeMessage = message.slice(0, 2000);
  try {
    const response = await chatWithData(safeMessage, context);
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
