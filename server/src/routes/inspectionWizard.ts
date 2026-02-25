/**
 * inspectionWizard.ts — Wizard de Levantamento em Campo (Phase 63)
 *
 * Endpoint único que cria poste + equipamentos + label de inspeção em uma
 * única transação atômica. Projetado para uso em campo via mobile — reduz
 * o número de chamadas de rede e garante consistência dos dados.
 *
 * Smart Backend: toda validação e transação no servidor; cliente envia
 * um único payload estruturado.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const VALID_CONDITIONS = ['bom', 'atenção', 'crítico', 'desconhecido'] as const;
const VALID_MATERIALS = ['concreto', 'madeira', 'aço', 'fibra', 'outro'] as const;
const VALID_NETWORK_LEVELS = ['MT', 'BT', 'AT'] as const;
const VALID_STRUCTURE_CONFIGS = [
  'tangente', 'angulo', 'derivacao', 'seccionamento', 'terminal', 'passagem',
] as const;
const VALID_PHASE_CONFIGS = ['M', 'B', 'T'] as const;
const VALID_EQUIPMENT_TYPES = [
  'transformador', 'chave_fusivel', 'chave_seccionadora', 'para-raios',
  'capacitor', 'religador', 'medidor', 'luminaria', 'caixa_de_passagem',
  'conector', 'outro',
] as const;
/** Maximum number of equipment items allowed in one wizard call */
const MAX_EQUIPMENT = 10;
/** Max equipment type string length */
const MAX_TYPE_LEN = 40;

interface WizardEquipmentItem {
  type: string;
  brand?: string;
  model?: string;
  serial_number?: string;
}

/**
 * POST /api/inspection/wizard
 * Creates a pole + equipment[] + inspection label in a single atomic transaction.
 *
 * Body:
 *   tenant_id     (required, integer > 0)
 *   lat           (required, number −90..90)
 *   lng           (required, number −180..180)
 *   name          (optional, string)
 *   material      (optional, enum VALID_MATERIALS)
 *   network_level (optional, enum MT/BT/AT)
 *   structure_config (optional)
 *   phase_config  (optional)
 *   num_arms      (optional, integer 0–20)
 *   height        (optional, number)
 *   condition     (required, enum VALID_CONDITIONS)
 *   notes         (optional, string, max 2000)
 *   inspector_name (optional, string, max 100)
 *   equipment     (optional, array, max MAX_EQUIPMENT items)
 */
router.post('/', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const {
    tenant_id, lat, lng, name, material, network_level,
    structure_config, phase_config, num_arms, height,
    condition, notes, inspector_name, equipment,
  } = req.body ?? {};

  // ── Validation ──
  const tenantId = parseInt(String(tenant_id ?? ''), 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  const latNum = parseFloat(String(lat ?? ''));
  const lngNum = parseFloat(String(lng ?? ''));
  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return res.status(400).json({ error: 'lat inválido (−90 a 90)' });
  }
  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: 'lng inválido (−180 a 180)' });
  }

  if (!condition || !(VALID_CONDITIONS as readonly string[]).includes(condition)) {
    return res.status(400).json({ error: `condition inválido. Use: ${VALID_CONDITIONS.join(', ')}` });
  }

  if (material && !(VALID_MATERIALS as readonly string[]).includes(material)) {
    return res.status(400).json({ error: `material inválido. Use: ${VALID_MATERIALS.join(', ')}` });
  }

  if (network_level && !(VALID_NETWORK_LEVELS as readonly string[]).includes(network_level)) {
    return res.status(400).json({ error: `network_level inválido. Use: ${VALID_NETWORK_LEVELS.join(', ')}` });
  }

  if (structure_config && !(VALID_STRUCTURE_CONFIGS as readonly string[]).includes(structure_config)) {
    return res.status(400).json({ error: `structure_config inválido. Use: ${VALID_STRUCTURE_CONFIGS.join(', ')}` });
  }

  if (phase_config && !(VALID_PHASE_CONFIGS as readonly string[]).includes(phase_config)) {
    return res.status(400).json({ error: `phase_config inválido. Use: ${VALID_PHASE_CONFIGS.join(', ')}` });
  }

  const numArmsInt = num_arms !== undefined ? parseInt(String(num_arms), 10) : undefined;
  if (numArmsInt !== undefined && (isNaN(numArmsInt) || numArmsInt < 0 || numArmsInt > 20)) {
    return res.status(400).json({ error: 'num_arms inválido (0–20)' });
  }

  // Validate equipment array
  const eqItems: WizardEquipmentItem[] = [];
  if (equipment !== undefined) {
    if (!Array.isArray(equipment)) {
      return res.status(400).json({ error: 'equipment deve ser um array' });
    }
    if (equipment.length > MAX_EQUIPMENT) {
      return res.status(400).json({ error: `Máximo de ${MAX_EQUIPMENT} equipamentos por chamada` });
    }
    for (const item of equipment) {
      if (!item.type || !(VALID_EQUIPMENT_TYPES as readonly string[]).includes(item.type)) {
        return res.status(400).json({ error: `Tipo de equipamento inválido: ${String(item.type).slice(0, MAX_TYPE_LEN)}` });
      }
      eqItems.push({
        type: item.type,
        brand: item.brand ? String(item.brand).slice(0, 100) : undefined,
        model: item.model ? String(item.model).slice(0, 100) : undefined,
        serial_number: item.serial_number ? String(item.serial_number).slice(0, 100) : undefined,
      });
    }
  }

  try {
    const db = await getDb();

    // Verify tenant exists
    const tenant = await db.get('SELECT id FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Concessionária não encontrada' });

    // ── Atomic transaction ──
    await db.exec('BEGIN');
    try {
      // 1. Insert pole
      const safeName = name ? String(name).slice(0, 100) : null;
      const safeNotes = notes ? String(notes).slice(0, 2000) : null;
      const heightNum = height !== undefined ? parseFloat(String(height)) : null;
      const safeHeight = heightNum !== null && !isNaN(heightNum) ? heightNum : null;

      const poleResult = await db.run(
        `INSERT INTO poles
           (tenant_id, name, lat, lng, material, network_level, structure_config,
            phase_config, num_arms, height, status, ahi_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 100)`,
        [
          tenantId, safeName, latNum, lngNum,
          material ?? null,
          network_level ?? 'BT',
          structure_config ?? null,
          phase_config ?? null,
          numArmsInt ?? 0,
          safeHeight,
        ],
      );
      const poleId = poleResult.lastID!;

      // 2. Insert inspection label (source='manual')
      const safeInspector = inspector_name ? String(inspector_name).slice(0, 100) : null;
      const labelText = [
        condition,
        network_level ? `Nível: ${network_level}` : null,
        structure_config ? `Config: ${structure_config}` : null,
        safeInspector ? `Inspetor: ${safeInspector}` : null,
        safeNotes ? safeNotes.slice(0, 200) : null,
      ].filter(Boolean).join(' | ');

      const labelResult = await db.run(
        `INSERT INTO labels (pole_id, label, confidence, source, created_at)
         VALUES (?, ?, 1.0, 'manual', CURRENT_TIMESTAMP)`,
        [poleId, labelText],
      );
      const labelId = labelResult.lastID!;

      // 3. Insert equipment items
      const equipmentIds: number[] = [];
      for (const item of eqItems) {
        const eqResult = await db.run(
          `INSERT INTO equipment (pole_id, tenant_id, type, brand, model, serial_number, status)
           VALUES (?, ?, ?, ?, ?, ?, 'ativo')`,
          [poleId, tenantId, item.type, item.brand ?? null, item.model ?? null, item.serial_number ?? null],
        );
        equipmentIds.push(eqResult.lastID!);
      }

      await db.exec('COMMIT');

      return res.status(201).json({
        pole_id: poleId,
        label_id: labelId,
        equipment_ids: equipmentIds,
        message: 'Levantamento registrado com sucesso',
      });
    } catch (innerErr) {
      await db.exec('ROLLBACK');
      throw innerErr;
    }
  } catch (err) {
    console.error('Erro no wizard de inspeção:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao registrar levantamento' });
  }
});

export default router;
