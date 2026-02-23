import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { analyzeImage } from '../services/groqService';
import { rateLimit } from '../middleware/rateLimit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// POST analyze image
router.post('/analyze', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const { poleId, image } = req.body;
  if (!poleId || !image) return res.status(400).json({ error: 'pole_id e imagem são obrigatórios' });

  const safePoleId = parseInt(String(poleId), 10);
  if (isNaN(safePoleId) || safePoleId <= 0) {
    return res.status(400).json({ error: 'poleId inválido' });
  }
  if (typeof image !== 'string' || image.length > 10_000_000) {
    return res.status(400).json({ error: 'Imagem inválida ou muito grande' });
  }

  try {
    const analysis = await analyzeImage(image);
    const db = await getDb();

    // Save image to disk
    const filename = `inspection_${Date.now()}.jpg`;
    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, Buffer.from(image, 'base64'));

    const imageResult = await db.run(
      'INSERT INTO images (pole_id, file_path) VALUES (?, ?)',
      [safePoleId, `/uploads/${filename}`]
    );
    const imageId = imageResult.lastID;

    const labelResult = await db.run(
      'INSERT INTO labels (pole_id, image_id, label, confidence, source) VALUES (?, ?, ?, ?, ?)',
      [safePoleId, imageId, analysis.analysis_summary, analysis.confidence, 'ai']
    );

    res.json({
      ...analysis,
      labelId: labelResult.lastID,
      imageId: imageId,
      imageUrl: `/uploads/${filename}`
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Falha na análise de imagem pela IA' });
  }
});

// GET history for a pole
router.get('/:id/history', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }
  try {
    const db = await getDb();
    const history = await db.all(`
      SELECT l.*, i.file_path 
      FROM labels l 
      LEFT JOIN images i ON l.image_id = i.id 
      WHERE l.pole_id = ? 
      ORDER BY l.created_at DESC
    `, [id]);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico de inspeções' });
  }
});

// POST feedback
router.post('/feedback', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { labelId, poleId, isCorrect, correction } = req.body;

  if (labelId === undefined || poleId === undefined || isCorrect === undefined) {
    return res.status(400).json({ error: 'labelId, poleId, and isCorrect are required' });
  }

  const safePoleId = parseInt(String(poleId), 10);
  const safeLabelId = parseInt(String(labelId), 10);
  if (isNaN(safePoleId) || isNaN(safeLabelId)) {
    return res.status(400).json({ error: 'IDs inválidos' });
  }
  const safeCorrection = correction ? String(correction).slice(0, 500) : '';

  try {
    const db = await getDb();
    await db.run(
      'INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, ?, ?, ?)',
      [safePoleId, isCorrect ? 'Confirmado' : `Correção: ${safeCorrection}`, 1.0, 'user']
    );
    res.json({ status: 'Feedback saved' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar feedback' });
  }
});

export default router;
