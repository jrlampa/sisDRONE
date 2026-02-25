/**
 * levantamento.ts — Exportação de Levantamento de Campo (CSV) (Phase 61)
 *
 * Gera CSV estruturado com todos os dados de campo de postes, equipamentos
 * e condutores para uso pelo projetista em campo — ferramenta central do sisDRONE.
 *
 * Smart Backend: toda lógica de agregação no servidor; cliente recebe CSV pronto.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

/** Escape and quote a CSV field if necessary */
function toCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(toCsvField).join(',');
}

const LEVANTAMENTO_HEADERS = [
  'ID', 'Nome', 'Latitude', 'Longitude', 'UTM_X', 'UTM_Y',
  'Altura_m', 'Material', 'Tipo_Estrutura', 'Nível_Rede',
  'Config_Estrutural', 'Fase', 'Braços', 'AHI', 'Status',
  'Data_Instalação', 'Qtd_Equipamentos', 'Tipos_Equipamentos',
  'Qtd_Condutores', 'Tipos_Condutores', 'Comprimento_Total_m',
];

/**
 * GET /api/report/levantamento?tenant_id=&circuit_id=
 * Gera CSV de levantamento de campo com todos os dados de postes,
 * equipamentos agregados por poste e condutores conectados.
 */
router.get('/', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const tenantId = parseInt(String(req.query.tenant_id ?? ''), 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  const rawCircuit = req.query.circuit_id;
  const circuitId = rawCircuit !== undefined
    ? parseInt(String(rawCircuit), 10)
    : null;

  if (circuitId !== null && (isNaN(circuitId) || circuitId <= 0)) {
    return res.status(400).json({ error: 'circuit_id inválido' });
  }

  try {
    const db = await getDb();

    const tenant = await db.get('SELECT name FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Concessionária não encontrada' });

    // Build poles query
    let polesQuery = 'SELECT * FROM poles WHERE tenant_id = ?';
    const polesArgs: unknown[] = [tenantId];
    if (circuitId !== null) {
      polesQuery += ' AND circuit_id = ?';
      polesArgs.push(circuitId);
    }
    polesQuery += ' ORDER BY name ASC';

    const poles = await db.all(polesQuery, polesArgs);
    if (poles.length === 0) {
      return res.status(404).json({ error: 'Nenhum poste encontrado para os filtros fornecidos' });
    }

    const poleIds: number[] = poles.map((p: { id: number }) => p.id);
    const ph = poleIds.map(() => '?').join(',');

    // Equipment summary per pole (aggregated)
    const eqRows = await db.all(
      `SELECT pole_id, COUNT(*) AS qty, GROUP_CONCAT(DISTINCT type) AS types
       FROM equipment WHERE pole_id IN (${ph})
       GROUP BY pole_id`,
      poleIds,
    );
    const eqByPole = new Map<number, { qty: number; types: string }>(
      eqRows.map((e: { pole_id: number; qty: number; types: string }) => [e.pole_id, e]),
    );

    // Conductor summary per pole (from-pole only, aggregated)
    const condRows = await db.all(
      `SELECT pole_from AS pole_id, COUNT(*) AS qty,
              GROUP_CONCAT(DISTINCT network_type) AS types,
              ROUND(SUM(COALESCE(computed_length_m, length_m, 0)), 1) AS total_m
       FROM conductors WHERE pole_from IN (${ph}) AND tenant_id = ?
       GROUP BY pole_from`,
      [...poleIds, tenantId],
    );
    const condByPole = new Map<number, { qty: number; types: string; total_m: number }>(
      condRows.map((c: { pole_id: number; qty: number; types: string; total_m: number }) => [c.pole_id, c]),
    );

    // Build CSV
    const header = toCsvRow(LEVANTAMENTO_HEADERS);
    const rows = poles.map((p: Record<string, unknown>) => {
      const eq = eqByPole.get(p.id as number);
      const cond = condByPole.get(p.id as number);
      return toCsvRow([
        p.id, p.name ?? '', p.lat ?? '', p.lng ?? '',
        p.utm_x ?? '', p.utm_y ?? '', p.height ?? '',
        p.material ?? '', p.structure_type ?? '',
        p.network_level ?? 'BT', p.structure_config ?? '',
        p.phase_config ?? '', p.num_arms ?? 0,
        p.ahi_score ?? 100, p.status ?? 'pending',
        p.installation_date ?? '',
        eq?.qty ?? 0, eq?.types ?? '',
        cond?.qty ?? 0, cond?.types ?? '',
        cond?.total_m ?? '0',
      ]);
    });

    const csv = [header, ...rows].join('\r\n');
    const date = new Date().toISOString().slice(0, 10);
    const filename = `levantamento_tenant${tenantId}_${date}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM for Excel compatibility in pt-BR Windows
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Erro ao gerar levantamento CSV:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar levantamento' });
  }
});

export default router;
