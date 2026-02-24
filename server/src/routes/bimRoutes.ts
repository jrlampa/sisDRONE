/**
 * BIM Half-Way — Estrutura de Postes (IFC-lite)
 *
 * Gerencia dados de estrutura BIM dos postes em formato JSON simplificado
 * inspirado no padrão IFC (Industry Foundation Classes) para infraestrutura.
 *
 * Schema IFC-lite:
 * {
 *   ifc_class: string       // "IfcTelecomDevice" ou "IfcColumn"
 *   height_m: number
 *   material: string
 *   cross_arm_count: number  // cruzetas
 *   transformer: boolean
 *   insulator_count: number  // isoladores
 *   conductor_lines: number  // ramais/fios
 *   ground_wire: boolean     // cabo guarda
 *   elevation_m: number      // altitude do terreno
 *   notes: string
 * }
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const ALLOWED_IFC_CLASSES = ['IfcTelecomDevice', 'IfcColumn', 'IfcPile'];

function validateStructureData(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { valid: false, error: 'structure_data deve ser um objeto JSON' };

  const s = data as Record<string, unknown>;

  if (s.ifc_class && !ALLOWED_IFC_CLASSES.includes(String(s.ifc_class))) {
    return { valid: false, error: `ifc_class inválida. Use: ${ALLOWED_IFC_CLASSES.join(', ')}` };
  }
  if (s.height_m !== undefined) {
    const h = Number(s.height_m);
    if (isNaN(h) || h < 0 || h > 100) return { valid: false, error: 'height_m deve ser entre 0 e 100m' };
  }
  if (s.cross_arm_count !== undefined) {
    const c = Number(s.cross_arm_count);
    if (!Number.isInteger(c) || c < 0 || c > 20) return { valid: false, error: 'cross_arm_count inválido (0-20)' };
  }
  if (s.insulator_count !== undefined) {
    const i = Number(s.insulator_count);
    if (!Number.isInteger(i) || i < 0 || i > 100) return { valid: false, error: 'insulator_count inválido (0-100)' };
  }
  if (s.conductor_lines !== undefined) {
    const l = Number(s.conductor_lines);
    if (!Number.isInteger(l) || l < 0 || l > 20) return { valid: false, error: 'conductor_lines inválido (0-20)' };
  }
  if (s.elevation_m !== undefined) {
    const e = Number(s.elevation_m);
    if (isNaN(e) || e < -500 || e > 9000) return { valid: false, error: 'elevation_m deve ser entre -500 e 9000m' };
  }
  if (s.notes && typeof s.notes === 'string' && s.notes.length > 1000) {
    return { valid: false, error: 'notes deve ter no máximo 1000 caracteres' };
  }
  return { valid: true };
}

/**
 * GET /api/bim/:poleId
 * Returns the IFC-lite structure data for a pole.
 */
router.get('/:poleId', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const poleId = parseInt(req.params.poleId, 10);
  if (isNaN(poleId) || poleId <= 0) {
    return res.status(400).json({ error: 'poleId inválido' });
  }

  try {
    const db = await getDb();
    const pole = await db.get('SELECT id, name, material, height, structure_data FROM poles WHERE id = ?', [poleId]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    let structure = null;
    if (pole.structure_data) {
      try { structure = JSON.parse(pole.structure_data); } catch { structure = null; }
    }

    // Default IFC-lite structure if none stored
    if (!structure) {
      structure = {
        ifc_class: 'IfcTelecomDevice',
        height_m: pole.height || 11,
        material: pole.material || 'concreto',
        cross_arm_count: 1,
        transformer: false,
        insulator_count: 3,
        conductor_lines: 3,
        ground_wire: false,
        elevation_m: 0,
        notes: '',
      };
    }

    res.json({ poleId, pole_name: pole.name, structure });
  } catch (err) {
    console.error('Erro ao buscar dados BIM:', err);
    res.status(500).json({ error: 'Erro ao buscar estrutura BIM' });
  }
});

/**
 * PUT /api/bim/:poleId
 * Updates the IFC-lite structure data for a pole.
 * Body: { structure_data: object }
 */
router.put('/:poleId', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const poleId = parseInt(req.params.poleId, 10);
  if (isNaN(poleId) || poleId <= 0) {
    return res.status(400).json({ error: 'poleId inválido' });
  }

  const { structure_data } = req.body;
  if (!structure_data) {
    return res.status(400).json({ error: 'structure_data é obrigatório' });
  }

  const validation = validateStructureData(structure_data);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Sanitize: only allow known fields
  const allowed = ['ifc_class', 'height_m', 'material', 'cross_arm_count', 'transformer',
    'insulator_count', 'conductor_lines', 'ground_wire', 'elevation_m', 'notes'];
  const sanitized: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in (structure_data as object)) sanitized[key] = (structure_data as any)[key];
  }

  try {
    const db = await getDb();
    const pole = await db.get('SELECT id FROM poles WHERE id = ?', [poleId]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    await db.run('UPDATE poles SET structure_data = ? WHERE id = ?', [JSON.stringify(sanitized), poleId]);
    res.json({ poleId, structure: sanitized, message: 'Estrutura BIM atualizada com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar dados BIM:', err);
    res.status(500).json({ error: 'Erro ao salvar estrutura BIM' });
  }
});

export default router;
