/**
 * bomReport.ts — Relação de Materiais (BOM) (Phase 64)
 *
 *   GET /api/report/bom?tenant_id=&circuit_id=&format=json|csv
 *
 * Retorna quantitativos estruturados por:
 *   - Postes por material, nível de rede e configuração estrutural
 *   - Condutores por tipo de rede e tipo de cabo
 *   - Equipamentos por tipo
 * Útil para elaboração de planilhas de levantamento e pedidos de material.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

const BOM_UTF8_BOM = '\uFEFF';

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw), 10);
  return isNaN(n) || n <= 0 ? null : n;
}

interface PolesBreakdown {
  by_material: Record<string, number>;
  by_network_level: Record<string, number>;
  by_structure_config: Record<string, number>;
  total: number;
}

interface ConductorsBreakdown {
  by_network_type: Record<string, number>;
  by_cable_type: Record<string, number>;
  total_conductors: number;
  total_length_km: number;
}

interface EquipmentBreakdown {
  by_type: Record<string, number>;
  total: number;
}

interface BomResponse {
  tenant_id: number | null;
  circuit_id: number | null;
  generated_at: string;
  poles: PolesBreakdown;
  conductors: ConductorsBreakdown;
  equipment: EquipmentBreakdown;
}

function buildWhereClause(tenantId: number | null, circuitId: number | null): { where: string; params: number[] } {
  const conditions: string[] = [];
  const params: number[] = [];
  if (tenantId) { conditions.push('tenant_id = ?'); params.push(tenantId); }
  if (circuitId) { conditions.push('circuit_id = ?'); params.push(circuitId); }
  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

function groupBy(rows: { label: string; count: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.label ?? 'Não informado'] = r.count;
  return out;
}

function bomToCsv(bom: BomResponse): string {
  const lines: string[] = [
    'Categoria,Subcategoria,Tipo,Quantidade',
    ...Object.entries(bom.poles.by_material).map(
      ([k, v]) => `Postes,Material,${k},${v}`
    ),
    ...Object.entries(bom.poles.by_network_level).map(
      ([k, v]) => `Postes,Nível de Rede,${k},${v}`
    ),
    ...Object.entries(bom.poles.by_structure_config).map(
      ([k, v]) => `Postes,Config. Estrutural,${k},${v}`
    ),
    ...Object.entries(bom.conductors.by_network_type).map(
      ([k, v]) => `Condutores,Tipo de Rede,${k},${v}`
    ),
    ...Object.entries(bom.conductors.by_cable_type).map(
      ([k, v]) => `Condutores,Tipo de Cabo,${k},${v}`
    ),
    `Condutores,Comprimento Total (km),-,${bom.conductors.total_length_km}`,
    ...Object.entries(bom.equipment.by_type).map(
      ([k, v]) => `Equipamentos,Tipo,${k},${v}`
    ),
  ];
  return BOM_UTF8_BOM + lines.join('\r\n');
}

/**
 * GET /api/report/bom
 */
router.get('/', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const tenantId  = parseId(req.query.tenant_id);
  const circuitId = parseId(req.query.circuit_id);
  const format    = String(req.query.format ?? 'json').toLowerCase();

  if (req.query.tenant_id !== undefined && req.query.tenant_id !== '' && !tenantId) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }
  if (req.query.circuit_id !== undefined && req.query.circuit_id !== '' && !circuitId) {
    return res.status(400).json({ error: 'circuit_id inválido' });
  }
  if (!['json', 'csv'].includes(format)) {
    return res.status(400).json({ error: 'format deve ser json ou csv' });
  }

  try {
    const db = await getDb();
    const { where: pWhere, params: pParams } = buildWhereClause(tenantId, circuitId);

    // Poles breakdown
    const [byMaterial, byNetworkLevel, byStructureConfig, totalPoles] = await Promise.all([
      db.all<{ label: string; count: number }[]>(
        `SELECT COALESCE(material, 'Não informado') AS label, COUNT(*) AS count FROM poles ${pWhere} GROUP BY label ORDER BY count DESC`,
        pParams
      ),
      db.all<{ label: string; count: number }[]>(
        `SELECT COALESCE(network_level, 'Não informado') AS label, COUNT(*) AS count FROM poles ${pWhere} GROUP BY label ORDER BY count DESC`,
        pParams
      ),
      db.all<{ label: string; count: number }[]>(
        `SELECT COALESCE(structure_config, 'Não informado') AS label, COUNT(*) AS count FROM poles ${pWhere} GROUP BY label ORDER BY count DESC`,
        pParams
      ),
      db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM poles ${pWhere}`, pParams),
    ]);

    // Conductors breakdown — must use circuit_id from poles via JOIN when circuitId is set
    const cBase = circuitId
      ? 'FROM conductors WHERE circuit_id = ?' + (tenantId ? ' AND tenant_id = ?' : '')
      : tenantId
        ? 'FROM conductors WHERE tenant_id = ?'
        : 'FROM conductors';
    const cParams: number[] = circuitId
      ? tenantId ? [circuitId, tenantId] : [circuitId]
      : tenantId ? [tenantId] : [];

    const [byNetworkType, byCableType, totalConductors] = await Promise.all([
      db.all<{ label: string; count: number }[]>(
        `SELECT COALESCE(network_type, 'Não informado') AS label, COUNT(*) AS count ${cBase} GROUP BY label ORDER BY count DESC`,
        cParams
      ),
      db.all<{ label: string; count: number }[]>(
        `SELECT COALESCE(cable_type, 'Não informado') AS label, COUNT(*) AS count ${cBase} GROUP BY label ORDER BY count DESC`,
        cParams
      ),
      db.get<{ count: number; total_length_km: number }>(
        `SELECT COUNT(*) AS count, COALESCE(SUM(COALESCE(computed_length_m, length_m, 0)), 0) / 1000.0 AS total_length_km ${cBase}`,
        cParams
      ),
    ]);

    // Equipment breakdown — joins via poles to filter by circuit/tenant
    const eWhere = circuitId
      ? 'JOIN poles p ON p.id = e.pole_id WHERE p.circuit_id = ?' + (tenantId ? ' AND e.tenant_id = ?' : '')
      : tenantId
        ? 'WHERE e.tenant_id = ?'
        : '';
    const eParams: number[] = circuitId
      ? tenantId ? [circuitId, tenantId] : [circuitId]
      : tenantId ? [tenantId] : [];

    const [byEquipType, totalEquip] = await Promise.all([
      db.all<{ label: string; count: number }[]>(
        `SELECT COALESCE(e.type, 'Não informado') AS label, COUNT(*) AS count FROM equipment e ${eWhere} GROUP BY label ORDER BY count DESC`,
        eParams
      ),
      db.get<{ count: number }>(
        `SELECT COUNT(*) AS count FROM equipment e ${eWhere}`,
        eParams
      ),
    ]);

    const bom: BomResponse = {
      tenant_id:    tenantId,
      circuit_id:   circuitId,
      generated_at: new Date().toISOString(),
      poles: {
        by_material:        groupBy(byMaterial),
        by_network_level:   groupBy(byNetworkLevel),
        by_structure_config: groupBy(byStructureConfig),
        total: totalPoles?.count ?? 0,
      },
      conductors: {
        by_network_type:  groupBy(byNetworkType),
        by_cable_type:    groupBy(byCableType),
        total_conductors: totalConductors?.count ?? 0,
        total_length_km:  Math.round((totalConductors?.total_length_km ?? 0) * 100) / 100,
      },
      equipment: {
        by_type: groupBy(byEquipType),
        total:   totalEquip?.count ?? 0,
      },
    };

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="relacao_materiais.csv"');
      return res.send(bomToCsv(bom));
    }

    res.json(bom);
  } catch (err) {
    console.error('Erro ao gerar BOM:', err);
    res.status(500).json({ error: 'Erro ao gerar Relação de Materiais' });
  }
});

export default router;
