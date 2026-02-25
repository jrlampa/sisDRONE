/**
 * projectSummaryReport.ts — Resumo Executivo do Projeto (Phase 57)
 *
 * GET /api/report/project-summary?tenant_id=
 *
 * Gera PDF executivo completo da infraestrutura de rede elétrica aérea MT/BT:
 * postes por material/status/nível de rede, condutores por tipo, equipamentos,
 * AHI médio e distribuição de criticidade.
 *
 * Extraído de reportRoutes.ts para respeitar a regra de ≤500 linhas por arquivo.
 * Biblioteca: pdfkit (MIT, zero custo).
 */
import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// ── Constantes de Cores ──────────────────────────────────────────────────────
const DARK = '#1e293b';
const BLUE = '#3b82f6';
const GRAY = '#64748b';
const GREEN = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';

/** Renderiza uma tabela simples de 2 colunas no PDF */
function renderTable(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Array<{ label: string; value: string }>,
): void {
  if (doc.y > doc.page.height - 160) doc.addPage();
  doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text(title, 40);
  doc.moveDown(0.3);
  const COL = [40, 280];
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? '#f8fafc' : 'white';
    doc.rect(COL[0], doc.y, 515, 16).fill(bg);
    doc.fillColor('#334155').fontSize(8).font('Helvetica')
      .text(row.label, COL[0] + 4, doc.y + 4, { width: 230 });
    doc.text(row.value, COL[1], doc.y - 8, { width: 230, align: 'right' });
    doc.moveDown(0.1);
  });
  doc.moveDown(0.6);
}

/**
 * GET /api/report/project-summary?tenant_id=
 * Gera PDF executivo completo da rede: postes por material/status, condutores,
 * equipamentos, circuitos, AHI médio e distribuição de criticidade.
 */
router.get('/project-summary', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  const tenantId = parseInt(String(req.query.tenant_id ?? ''), 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  try {
    const db = await getDb();
    const tenant = await db.get('SELECT name FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Concessionária não encontrada' });

    // ── Aggregate queries (paralelas para performance) ──
    const [polesTotal, conductorsTotal, equipmentTotal, circuitsTotal] = await Promise.all([
      db.get(
        'SELECT COUNT(*) AS c, AVG(ahi_score) AS avg_ahi FROM poles WHERE tenant_id = ?',
        [tenantId],
      ),
      db.get(
        `SELECT COUNT(*) AS c, SUM(COALESCE(computed_length_m, length_m, 0)) AS total_m
         FROM conductors WHERE tenant_id = ?`,
        [tenantId],
      ),
      db.get('SELECT COUNT(*) AS c FROM equipment WHERE tenant_id = ?', [tenantId]),
      db.get('SELECT COUNT(*) AS c FROM circuits WHERE tenant_id = ?', [tenantId]),
    ]);

    const [byMaterial, byStatus, byNetworkLevel, byNetworkType, byEquipType, ahiDistrib] =
      await Promise.all([
        db.all(
          `SELECT COALESCE(material, 'N/D') AS material, COUNT(*) AS c
           FROM poles WHERE tenant_id = ? GROUP BY material ORDER BY c DESC`,
          [tenantId],
        ),
        db.all(
          `SELECT COALESCE(status, 'pending') AS status, COUNT(*) AS c
           FROM poles WHERE tenant_id = ? GROUP BY status ORDER BY c DESC`,
          [tenantId],
        ),
        db.all(
          `SELECT COALESCE(network_level, 'BT') AS network_level, COUNT(*) AS c
           FROM poles WHERE tenant_id = ? GROUP BY network_level ORDER BY c DESC`,
          [tenantId],
        ),
        db.all(
          `SELECT COALESCE(network_type, 'BT') AS network_type, COUNT(*) AS c,
                  SUM(COALESCE(computed_length_m, length_m, 0)) AS total_m
           FROM conductors WHERE tenant_id = ? GROUP BY network_type ORDER BY c DESC`,
          [tenantId],
        ),
        db.all(
          `SELECT type, COUNT(*) AS c FROM equipment
           WHERE tenant_id = ? GROUP BY type ORDER BY c DESC`,
          [tenantId],
        ),
        db.all(
          `SELECT
             SUM(CASE WHEN ahi_score < 50 THEN 1 ELSE 0 END) AS critical,
             SUM(CASE WHEN ahi_score >= 50 AND ahi_score < 80 THEN 1 ELSE 0 END) AS attention,
             SUM(CASE WHEN ahi_score >= 80 THEN 1 ELSE 0 END) AS good,
             SUM(CASE WHEN ahi_score IS NULL THEN 1 ELSE 0 END) AS unknown
           FROM poles WHERE tenant_id = ?`,
          [tenantId],
        ),
      ]);

    // ── Build PDF ──
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resumo_projeto_tenant${tenantId}.pdf"`,
    );
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill(DARK);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('sisDRONE', 40, 22);
    doc.fontSize(10).font('Helvetica').text('RESUMO EXECUTIVO DO PROJETO', 40, 48);
    doc.text(
      `Gerado em: ${new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })}`,
      40, 62,
    );
    doc.fillColor(BLUE).fontSize(16).font('Helvetica-Bold')
      .text(`Concessionária: ${tenant.name}`, 40, 100);
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text('Relatório consolidado da infraestrutura de rede elétrica aérea MT/BT', 40, 120);

    // ── KPI Cards ──
    const avgAhi = Math.round(polesTotal?.avg_ahi ?? 100);
    const totalKm = ((conductorsTotal?.total_m ?? 0) / 1000).toFixed(2);
    const kpiY = 145;
    const cards = [
      { label: 'Postes', value: String(polesTotal?.c ?? 0), color: BLUE },
      { label: 'Condutores', value: String(conductorsTotal?.c ?? 0), color: BLUE },
      { label: 'Extensão (km)', value: totalKm, color: BLUE },
      { label: 'AHI Médio', value: String(avgAhi), color: avgAhi < 50 ? RED : avgAhi < 80 ? ORANGE : GREEN },
      { label: 'Equipamentos', value: String(equipmentTotal?.c ?? 0), color: BLUE },
      { label: 'Circuitos', value: String(circuitsTotal?.c ?? 0), color: BLUE },
    ];
    const cardW = 82;
    cards.forEach((card, i) => {
      const x = 40 + i * (cardW + 4);
      doc.rect(x, kpiY, cardW, 44).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor(card.color).fontSize(16).font('Helvetica-Bold')
        .text(card.value, x + 4, kpiY + 8, { width: cardW - 8, align: 'center' });
      doc.fillColor(GRAY).fontSize(7).font('Helvetica')
        .text(card.label, x + 4, kpiY + 30, { width: cardW - 8, align: 'center' });
    });
    doc.y = kpiY + 58;

    // ── AHI Distribution ──
    const ahiRow = ahiDistrib[0] ?? { critical: 0, attention: 0, good: 0, unknown: 0 };
    const totalPoles = polesTotal?.c || 1;
    doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text('Distribuição AHI', 40);
    doc.moveDown(0.3);
    const ahiBars = [
      { label: 'Crítico (< 50)', count: ahiRow.critical ?? 0, color: RED },
      { label: 'Atenção (50–79)', count: ahiRow.attention ?? 0, color: ORANGE },
      { label: 'Bom (≥ 80)', count: ahiRow.good ?? 0, color: GREEN },
      { label: 'Sem AHI', count: ahiRow.unknown ?? 0, color: GRAY },
    ];
    ahiBars.forEach((b) => {
      const pct = Math.round((b.count / totalPoles) * 100);
      const barW = Math.round((b.count / totalPoles) * 300) || 0;
      doc.fillColor(GRAY).fontSize(8).text(`${b.label}: ${b.count} (${pct}%)`, 40, doc.y);
      const barY = doc.y - 10;
      if (barW > 0) doc.rect(200, barY, barW, 8).fill(b.color);
      doc.moveDown(0.2);
    });
    doc.moveDown(0.5);

    // ── Data Tables ──
    renderTable(
      doc, 'Postes por Material',
      byMaterial.map((r: { material: string; c: number }) => ({ label: r.material, value: String(r.c) })),
    );
    renderTable(
      doc, 'Postes por Status',
      byStatus.map((r: { status: string; c: number }) => ({
        label: r.status.toUpperCase(), value: String(r.c),
      })),
    );
    renderTable(
      doc, 'Postes por Nível de Rede',
      byNetworkLevel.map((r: { network_level: string; c: number }) => ({
        label: r.network_level, value: String(r.c),
      })),
    );
    renderTable(
      doc, 'Condutores por Tipo de Rede',
      byNetworkType.map((r: { network_type: string; c: number; total_m: number }) => ({
        label: r.network_type,
        value: `${r.c} vãos — ${(r.total_m / 1000).toFixed(2)} km`,
      })),
    );
    if (byEquipType.length > 0) {
      renderTable(
        doc, 'Equipamentos por Tipo',
        byEquipType.map((r: { type: string; c: number }) => ({ label: r.type, value: String(r.c) })),
      );
    }

    // Footer
    doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill(DARK);
    doc.fillColor('white').fontSize(8)
      .text('sisDRONE © — Resumo gerado automaticamente. Confidencial.', 40, doc.page.height - 18);

    doc.end();
  } catch (err) {
    console.error('Erro ao gerar resumo do projeto:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar resumo do projeto' });
  }
});

export default router;
