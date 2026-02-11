import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDb } from './db.js';
import { analyzeImage } from './services/groqService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all poles
app.get('/api/poles', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poles = await db.all('SELECT * FROM poles ORDER BY created_at DESC');
    res.json(poles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch poles' });
  }
});

// POST new pole
app.post('/api/poles', async (req: Request, res: Response) => {
  const { lat, lng, utm_x, utm_y, name } = req.body;
  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO poles (external_id, lat, lng, utm_x, utm_y) VALUES (?, ?, ?, ?, ?)',
      [name, lat, lng, utm_x, utm_y]
    );
    res.status(201).json({ id: result.lastID, lat, lng, name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pole' });
  }
});

// POST analyze image
app.post('/api/analyze', async (req: Request, res: Response) => {
  const { poleId, image } = req.body; // image is base64
  try {
    const analysisStr = await analyzeImage(image);
    const analysis = JSON.parse(analysisStr as string);

    const db = await getDb();
    await db.run(
      'INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, ?, ?, ?)',
      [poleId, analysis.analysis_summary, analysis.confidence, 'ai']
    );

    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

app.listen(port, () => {
  console.log(`sisDRONE backend running on http://localhost:${port}`);
});
