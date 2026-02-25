import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { analyzeImage } from '../services/groqService';
import { rateLimit } from '../middleware/rateLimit';
import { broadcast } from '../services/notificationService';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// GET all inspection labels with optional pole_id, source filter and pagination
router.get('/', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const poleId = req.query.pole_id ? parseInt(String(req.query.pole_id), 10) : null;
    const source = req.query.source ? String(req.query.source) : null;
    const VALID_SOURCES = ['ai', 'user', 'manual'];
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (poleId && !isNaN(poleId) && poleId > 0) {
      conditions.push('l.pole_id = ?');
      params.push(poleId);
    }
    if (source && VALID_SOURCES.includes(source)) {
      conditions.push('l.source = ?');
      params.push(source);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseQuery = `
      SELECT l.*, i.file_path
      FROM labels l
      LEFT JOIN images i ON l.image_id = i.id
    `;

    const countRow = await db.get(
      `SELECT COUNT(*) as count FROM labels l ${whereClause}`,
      params
    );
    const total: number = countRow?.count ?? 0;
    const rows = await db.all(
      `${baseQuery} ${whereClause} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ inspections: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao buscar inspeções' });
  }
});

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

    // Notify all tenant clients if the inspection result is critical
    const condition = String(analysis.condition ?? '').toLowerCase();
    if (condition.includes('crítica') || condition.includes('critical')) {
      const pole = await db.get<{ tenant_id: number }>('SELECT tenant_id FROM poles WHERE id = ?', [safePoleId]);
      if (pole?.tenant_id) {
        broadcast({
          type: 'inspection_critical',
          title: 'Inspeção Crítica Detectada',
          message: `Poste ${safePoleId}: condição crítica identificada pela IA`,
          pole_id: safePoleId,
          tenant_id: pole.tenant_id,
          timestamp: Date.now(),
        });
      }
    }

    res.json({
      ...analysis,
      labelId: labelResult.lastID,
      imageId: imageId,
      imageUrl: `/uploads/${filename}`
    });
  } catch (err) {
    console.error('Erro de análise:', err);
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

// GET single inspection label by id
router.get('/:id', rateLimit(120, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de inspeção inválido' });
  }
  try {
    const db = await getDb();
    const inspection = await db.get(`
      SELECT l.*, i.file_path
      FROM labels l
      LEFT JOIN images i ON l.image_id = i.id
      WHERE l.id = ?
    `, [id]);
    if (!inspection) return res.status(404).json({ error: 'Inspeção não encontrada' });
    res.json(inspection);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar inspeção' });
  }
});

// PUT update inspection label/confidence by id
router.put('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de inspeção inválido' });
  }
  const { label, confidence, source } = req.body;
  const VALID_SOURCES = ['ai', 'user', 'manual'];

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (label !== undefined) {
    updates.push('label = ?');
    params.push(String(label).slice(0, 500));
  }
  if (confidence !== undefined) {
    const safeConf = parseFloat(String(confidence));
    if (isNaN(safeConf) || safeConf < 0 || safeConf > 1) {
      return res.status(400).json({ error: 'confidence deve ser um número entre 0 e 1' });
    }
    updates.push('confidence = ?');
    params.push(safeConf);
  }
  if (source !== undefined) {
    if (!VALID_SOURCES.includes(String(source))) {
      return res.status(400).json({ error: `source inválido. Use: ${VALID_SOURCES.join(', ')}` });
    }
    updates.push('source = ?');
    params.push(String(source));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  }

  try {
    const db = await getDb();
    const inspection = await db.get('SELECT id FROM labels WHERE id = ?', [id]);
    if (!inspection) return res.status(404).json({ error: 'Inspeção não encontrada' });
    params.push(id);
    await db.run(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await db.get(`
      SELECT l.*, i.file_path FROM labels l LEFT JOIN images i ON l.image_id = i.id WHERE l.id = ?
    `, [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar inspeção' });
  }
});

// DELETE single inspection label by id
router.delete('/:id', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de inspeção inválido' });
  }
  try {
    const db = await getDb();
    const inspection = await db.get('SELECT id FROM labels WHERE id = ?', [id]);
    if (!inspection) return res.status(404).json({ error: 'Inspeção não encontrada' });
    await db.run('DELETE FROM labels WHERE id = ?', [id]);
    res.json({ message: 'Inspeção removida com sucesso', id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover inspeção' });
  }
});

// POST structured manual inspection (source='manual') — Phase 59
router.post('/manual', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { pole_id, condition, notes, inspector_name, network_level, structure_config, phase_config, num_arms } = req.body;

  const VALID_CONDITIONS = ['bom', 'atenção', 'crítico', 'desconhecido'];
  const VALID_NETWORK_LEVELS = ['MT', 'BT', 'AT'];
  const VALID_STRUCTURE_CONFIGS = ['tangente', 'angulo', 'derivacao', 'seccionamento', 'terminal', 'passagem'];
  const VALID_PHASE_CONFIGS = ['M', 'B', 'T'];

  const safePoleId = parseInt(String(pole_id), 10);
  if (isNaN(safePoleId) || safePoleId <= 0) {
    return res.status(400).json({ error: 'pole_id inválido' });
  }
  if (!condition) {
    return res.status(400).json({ error: 'condition é obrigatório' });
  }
  if (!VALID_CONDITIONS.includes(String(condition))) {
    return res.status(400).json({ error: `condition inválido. Use: ${VALID_CONDITIONS.join(', ')}` });
  }
  if (network_level !== undefined && !VALID_NETWORK_LEVELS.includes(String(network_level))) {
    return res.status(400).json({ error: `network_level inválido. Use: ${VALID_NETWORK_LEVELS.join(', ')}` });
  }
  if (structure_config !== undefined && !VALID_STRUCTURE_CONFIGS.includes(String(structure_config))) {
    return res.status(400).json({ error: `structure_config inválido` });
  }
  if (phase_config !== undefined && !VALID_PHASE_CONFIGS.includes(String(phase_config))) {
    return res.status(400).json({ error: `phase_config inválido. Use: M, B, T` });
  }

  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [safePoleId]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    const safeNotes = notes ? String(notes).slice(0, 1000) : '';
    const safeInspector = inspector_name ? String(inspector_name).slice(0, 200) : 'campo';
    const labelText = `Inspeção manual por ${safeInspector}: ${condition}${safeNotes ? '. ' + safeNotes : ''}`;

    const result = await db.run(
      'INSERT INTO labels (pole_id, label, confidence, source) VALUES (?, ?, ?, ?)',
      [safePoleId, labelText, 1.0, 'manual']
    );

    // Update pole structural fields if provided
    const poleUpdates: string[] = [];
    const poleParams: (string | number)[] = [];
    if (network_level) { poleUpdates.push('network_level = ?'); poleParams.push(String(network_level)); }
    if (structure_config) { poleUpdates.push('structure_config = ?'); poleParams.push(String(structure_config)); }
    if (phase_config) { poleUpdates.push('phase_config = ?'); poleParams.push(String(phase_config)); }
    if (num_arms !== undefined) {
      const safeArms = parseInt(String(num_arms), 10);
      if (!isNaN(safeArms) && safeArms >= 0) {
        poleUpdates.push('num_arms = ?'); poleParams.push(safeArms);
      }
    }
    if (poleUpdates.length > 0) {
      poleParams.push(safePoleId);
      await db.run(`UPDATE poles SET ${poleUpdates.join(', ')} WHERE id = ?`, poleParams);
    }

    const label = await db.get('SELECT * FROM labels WHERE id = ?', [result.lastID]);
    res.status(201).json(label);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar inspeção manual' });
  }
});

// POST feedback
router.post('/feedback', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const { labelId, poleId, isCorrect, correction } = req.body;

  if (labelId === undefined || poleId === undefined || isCorrect === undefined) {
    return res.status(400).json({ error: 'labelId, poleId e isCorrect são obrigatórios' });
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
    res.json({ status: 'Feedback salvo' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar feedback' });
  }
});

export default router;
