import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { analyzeImage } from '../services/groqService';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// POST analyze image
router.post('/analyze', async (req: Request, res: Response) => {
  const { poleId, image } = req.body;
  if (!poleId || !image) return res.status(400).json({ error: 'Pole ID and image required' });

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
      [poleId, `/uploads/${filename}`]
    );
    const imageId = imageResult.lastID;

    const labelResult = await db.run(
      'INSERT INTO labels (pole_id, image_id, label, confidence, source) VALUES (?, ?, ?, ?, ?)',
      [poleId, imageId, analysis.analysis_summary, analysis.confidence, 'ai']
    );

    res.json({
      ...analysis,
      labelId: labelResult.lastID,
      imageId: imageId,
      imageUrl: `/uploads/${filename}`
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'AI Analysis Failed' });
  }
});

// GET history for a pole
router.get('/:id/history', async (req: Request, res: Response) => {
  const { id } = req.params;
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
    res.status(500).json({ error: 'History error' });
  }
});

// POST feedback
router.post('/feedback', async (req: Request, res: Response) => {
  const { labelId, poleId, isCorrect, correction } = req.body;

  if (labelId === undefined || poleId === undefined || isCorrect === undefined) {
    return res.status(400).json({ error: 'labelId, poleId, and isCorrect are required' });
  }
  try {
    const db = await getDb();
    await db.run(
      'INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, ?, ?, ?)',
      [poleId, isCorrect ? 'Confirmado' : `Correção: ${correction}`, 1.0, 'user']
    );
    res.json({ status: 'Feedback saved' });
  } catch (err) {
    res.status(500).json({ error: 'Feedback error' });
  }
});

export default router;
