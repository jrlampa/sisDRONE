/**
 * Relatório PDF de Inspeção de Poste — Geração Server-Side
 *
 * Smart Backend: gera PDF completo com dados do poste, histórico de inspeções
 * e planos de manutenção sem expor lógica ao cliente.
 *
 * Biblioteca: pdfkit (MIT, zero custo, sem deps nativas no Alpine)
 */
import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { buildCroquiSvg } from '../services/croquiService';

const router = Router();

/**
 * GET /api/report/pole/:id
 * Streams a PDF report for the given pole.
 */
router.get('/pole/:id', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  const poleId = parseInt(req.params.id, 10);
  if (isNaN(poleId) || poleId <= 0) {
    return res.status(400).json({ error: 'ID de poste inválido' });
  }

  try {
    const db = await getDb();
    const pole = await db.get('SELECT * FROM poles WHERE id = ?', [poleId]);
    if (!pole) return res.status(404).json({ error: 'Poste não encontrado' });

    const history = await db.all(
      `SELECT l.label, l.confidence, l.source, l.created_at, i.file_path
       FROM labels l
       LEFT JOIN images i ON l.image_id = i.id
       WHERE l.pole_id = ?
       ORDER BY l.created_at DESC
       LIMIT 20`,
      [poleId]
    );

    const plans = await db.all(
      'SELECT * FROM maintenance_plans WHERE pole_id = ? ORDER BY created_at DESC LIMIT 5',
      [poleId]
    );

    const tenant = pole.tenant_id
      ? await db.get('SELECT name FROM tenants WHERE id = ?', [pole.tenant_id])
      : null;

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="poste_${poleId}_relatorio.pdf"`);
    doc.pipe(res);

    const BLUE = '#3b82f6';
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const RED = '#ef4444';
    const GREEN = '#10b981';

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 70).fill(DARK);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('sisDRONE', 40, 20);
    doc.fontSize(10).font('Helvetica')
      .text('SISTEMA DE INSPEÇÃO AUTOMATIZADA DE REDES ELÉTRICAS', 40, 44);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 40, 58);

    doc.moveDown(2);

    // ── Pole Header ──
    doc.fillColor(BLUE).fontSize(16).font('Helvetica-Bold')
      .text(`Relatório de Inspeção — ${pole.name || `Poste #${pole.id}`}`, 40, 90);
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text(`Concessionária: ${tenant?.name || 'N/D'} | ID: ${pole.id} | Status: ${pole.status?.toUpperCase() || 'PENDENTE'}`, 40, 110);

    // ── AHI Score Bar ──
    const ahi = pole.ahi_score ?? 100;
    const ahiColor = ahi < 50 ? RED : ahi < 80 ? '#f59e0b' : GREEN;
    doc.y = 130;
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('AHI Score (Asset Health Index)', 40);
    doc.moveDown(0.3);
    // background bar
    doc.rect(40, doc.y, 350, 16).fill('#e2e8f0');
    // filled bar
    doc.rect(40, doc.y - 16, Math.round(350 * ahi / 100), 16).fill(ahiColor);
    // label
    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
      .text(`${ahi}/100`, 400, doc.y - 14);
    doc.moveDown(1.2);

    // ── Pole Data Table ──
    doc.fillColor(BLUE).fontSize(12).font('Helvetica-Bold').text('Dados do Ativo', 40);
    doc.moveDown(0.4);

    const tableData = [
      ['Campo', 'Valor'],
      ['Latitude', pole.lat?.toFixed(6) ?? 'N/D'],
      ['Longitude', pole.lng?.toFixed(6) ?? 'N/D'],
      ['UTM X', pole.utm_x?.toFixed(0) ?? 'N/D'],
      ['UTM Y', pole.utm_y?.toFixed(0) ?? 'N/D'],
      ['Altura (m)', pole.height?.toString() ?? 'N/D'],
      ['Material', pole.material ?? 'N/D'],
      ['Tipo de Estrutura', pole.structure_type ?? 'N/D'],
      ['Data de Instalação', pole.installation_date ? new Date(pole.installation_date).toLocaleDateString('pt-BR') : 'N/D'],
    ];

    const colWidths = [160, 360];
    let tableY = doc.y;
    tableData.forEach((row, i) => {
      const isHeader = i === 0;
      const bgColor = isHeader ? BLUE : i % 2 === 0 ? '#f8fafc' : 'white';
      const textColor = isHeader ? 'white' : DARK;
      doc.rect(40, tableY, colWidths[0], 18).fill(bgColor);
      doc.rect(40 + colWidths[0], tableY, colWidths[1], 18).fill(bgColor);
      doc.fillColor(textColor).fontSize(8.5)
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .text(row[0], 45, tableY + 5, { width: colWidths[0] - 10 });
      doc.fillColor(textColor).fontSize(8.5)
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .text(row[1], 40 + colWidths[0] + 5, tableY + 5, { width: colWidths[1] - 10 });
      tableY += 18;
    });

    doc.y = tableY + 12;
    doc.moveDown(0.5);

    // ── Inspection History ──
    doc.addPage();
    doc.fillColor(BLUE).fontSize(12).font('Helvetica-Bold').text('Histórico de Inspeções', 40, 40);
    doc.moveDown(0.4);

    if (history.length === 0) {
      doc.fillColor(GRAY).fontSize(10).text('Nenhuma inspeção registrada.', 40);
    } else {
      history.slice(0, 15).forEach((h, idx) => {
        const label = h.label ?? 'N/D';
        const conf = h.confidence ? `${Math.round(h.confidence * 100)}%` : 'N/D';
        const src = h.source ?? 'N/D';
        const date = h.created_at ? new Date(h.created_at).toLocaleDateString('pt-BR') : 'N/D';

        const rowBg = idx % 2 === 0 ? '#f8fafc' : 'white';
        doc.rect(40, doc.y, 515, 22).fill(rowBg);
        doc.fillColor(DARK).fontSize(8)
          .text(`#${idx + 1}`, 44, doc.y + 7, { width: 20 });
        doc.text(date, 68, doc.y + 7, { width: 60 });
        doc.text(src.toUpperCase(), 132, doc.y + 7, { width: 60 });
        doc.text(conf, 196, doc.y + 7, { width: 40 });
        doc.text(label.slice(0, 100), 240, doc.y + 7, { width: 310 });
        doc.y += 22;
        if (doc.y > doc.page.height - 80) doc.addPage();
      });
    }

    doc.moveDown(1);

    // ── Maintenance Plans ──
    doc.fillColor(BLUE).fontSize(12).font('Helvetica-Bold').text('Planos de Manutenção', 40);
    doc.moveDown(0.4);

    if (plans.length === 0) {
      doc.fillColor(GRAY).fontSize(10).text('Nenhum plano gerado.', 40);
    } else {
      plans.forEach((plan, idx) => {
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
          .text(`Plano #${idx + 1} — ${plan.status} — R$ ${plan.estimated_cost?.toFixed(2) ?? '0,00'}`, 40);
        doc.fillColor(GRAY).fontSize(8).font('Helvetica')
          .text(`Criado: ${new Date(plan.created_at).toLocaleDateString('pt-BR')}`, 40);
        doc.moveDown(0.3);
        doc.fillColor(DARK).fontSize(8.5)
          .text((plan.plan_text || '').slice(0, 600), 40, doc.y, { width: 515 });
        doc.moveDown(1);
      });
    }

    // ── Footer ──
    doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill(DARK);
    doc.fillColor('white').fontSize(8)
      .text('sisDRONE © — Relatório gerado automaticamente. Confidencial.', 40, doc.page.height - 18);

    doc.end();
  } catch (err) {
    console.error('Erro ao gerar relatório PDF:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar relatório PDF' });
  }
});

/**
 * GET /api/report/croqui/:tenantId  (Phase 31)
 * Gera e retorna o Croqui Digital da rede como SVG.
 */
router.get('/croqui/:tenantId', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenantId inválido' });
  }

  try {
    const db = await getDb();
    const tenant = await db.get('SELECT name FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Concessionária não encontrada' });

    const poles = await db.all(
      `SELECT id, name, lat, lng, ahi_score, status, network_level FROM poles WHERE tenant_id = ? ORDER BY id`,
      [tenantId]
    );

    if (poles.length === 0) {
      return res.status(404).json({ error: 'Nenhum poste encontrado para esta concessionária' });
    }

    const conductors = await db.all(
      `SELECT c.id, c.pole_from, c.pole_to, c.network_type,
              pf.lat AS from_lat, pf.lng AS from_lng,
              pt.lat AS to_lat, pt.lng AS to_lng,
              c.computed_length_m, c.length_m
       FROM conductors c
       JOIN poles pf ON pf.id = c.pole_from
       JOIN poles pt ON pt.id = c.pole_to
       WHERE c.tenant_id = ?
       ORDER BY c.id`,
      [tenantId]
    );

    // Phase 62: query equipment counts per pole for croqui symbols
    const poleIds: number[] = poles.map((p: { id: number }) => p.id);
    const eqRows = poleIds.length ? await db.all(
      `SELECT pole_id, COUNT(*) AS qty FROM equipment WHERE pole_id IN (${poleIds.map(() => '?').join(',')}) GROUP BY pole_id`,
      poleIds,
    ) : [];
    const eqByPole = new Map<number, number>(
      eqRows.map((e: { pole_id: number; qty: number }) => [e.pole_id, e.qty]),
    );

    const svg = buildCroquiSvg(poles, conductors, tenant.name, eqByPole);

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="croqui_tenant${tenantId}.svg"`);
    res.send(svg);
  } catch (err) {
    console.error('Erro ao gerar croqui SVG:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar croqui' });
  }
});

// ── Phase 44: Relatório de Circuito (PDF Completo) ──────────────────────────

/** AHI padrão usado no cálculo de média quando um poste não possui score registrado */
const DEFAULT_AHI_SCORE = 100;

/**
 * GET /api/report/circuit/:circuitId
 * Gera PDF técnico completo de um circuito: capa, postes, condutores e planos de manutenção.
 */
router.get('/circuit/:circuitId', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  const circuitId = parseInt(req.params.circuitId, 10);
  if (isNaN(circuitId) || circuitId <= 0) {
    return res.status(400).json({ error: 'ID de circuito inválido' });
  }

  try {
    const db = await getDb();
    const circuit = await db.get('SELECT * FROM circuits WHERE id = ?', [circuitId]);
    if (!circuit) return res.status(404).json({ error: 'Circuito não encontrado' });

    const tenant = await db.get('SELECT name FROM tenants WHERE id = ?', [circuit.tenant_id]);

    const poles = await db.all(
      `SELECT * FROM poles WHERE circuit_id = ? ORDER BY name ASC`,
      [circuitId]
    );

    const conductors = await db.all(
      `SELECT c.*, pf.name AS from_name, pt.name AS to_name
       FROM conductors c
       LEFT JOIN poles pf ON c.pole_from = pf.id
       LEFT JOIN poles pt ON c.pole_to = pt.id
       WHERE c.circuit_id = ? ORDER BY c.id ASC`,
      [circuitId]
    );

    const poleIds = poles.map((p: { id: number }) => p.id);
    const plans = poleIds.length
      ? await db.all(
          `SELECT mp.*, p.name AS pole_name FROM maintenance_plans mp
           JOIN poles p ON mp.pole_id = p.id
           WHERE mp.pole_id IN (${poleIds.map(() => '?').join(',')}) AND mp.status = 'PENDING'
           ORDER BY p.ahi_score ASC LIMIT 50`,
          poleIds
        )
      : [];

    const avgAhi =
      poles.length > 0
        ? Math.round(poles.reduce((s: number, p: { ahi_score: number }) => s + (p.ahi_score ?? DEFAULT_AHI_SCORE), 0) / poles.length)
        : DEFAULT_AHI_SCORE;
    const totalLength = conductors.reduce(
      (s: number, c: { computed_length_m: number; length_m: number }) =>
        s + (c.computed_length_m ?? c.length_m ?? 0),
      0
    );

    // ── Build PDF ──
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="circuito_${circuitId}_relatorio.pdf"`
    );
    doc.pipe(res);

    const DARK = '#1e293b';
    const BLUE = '#3b82f6';
    const GRAY = '#64748b';

    // Cover
    doc.rect(0, 0, doc.page.width, 80).fill(DARK);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('sisDRONE', 40, 22);
    doc.fontSize(10).font('Helvetica').text('RELATÓRIO TÉCNICO DE CIRCUITO ELÉTRICO', 40, 48);
    doc.text(
      `Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      40, 62
    );

    doc.moveDown(3);
    doc.fillColor(BLUE).fontSize(16).font('Helvetica-Bold')
      .text(`Circuito: ${circuit.name}`, 40, 100);
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
      .text(
        `Concessionária: ${tenant?.name ?? 'N/D'} | ID: ${circuit.id} | Postes: ${poles.length} | Condutores: ${conductors.length}`,
        40, 120
      );
    doc.text(`AHI Médio: ${avgAhi} | Extensão Total: ${(totalLength / 1000).toFixed(2)} km`, 40, 132);
    if (circuit.description) {
      doc.text(`Descrição: ${circuit.description}`, 40, 144);
    }

    // Poles table
    doc.moveDown(2);
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Postes do Circuito', { underline: true });
    doc.moveDown(0.4);
    if (poles.length === 0) {
      doc.fillColor(GRAY).fontSize(10).font('Helvetica').text('Nenhum poste associado a este circuito.');
    } else {
      const COL = [40, 200, 290, 360, 430];
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
      doc.text('Nome', COL[0], doc.y, { width: 150, continued: false });
      const rowY = doc.y - 11;
      doc.text('Material', COL[1], rowY, { width: 85 });
      doc.text('Status', COL[2], rowY, { width: 65 });
      doc.text('AHI', COL[3], rowY, { width: 65 });
      doc.text('Estrutura', COL[4], rowY, { width: 100 });
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(8);
      for (const p of poles) {
        const y = doc.y;
        doc.fillColor('#334155').text(p.name || `#${p.id}`, COL[0], y, { width: 155, continued: false });
        doc.text(p.material || '—', COL[1], y, { width: 85 });
        doc.text((p.status || '—').toUpperCase(), COL[2], y, { width: 65 });
        doc.text(p.ahi_score != null ? String(p.ahi_score) : '—', COL[3], y, { width: 65 });
        doc.text(p.structure_type || '—', COL[4], y, { width: 100 });
        doc.moveDown(0.15);
      }
    }

    // Conductors table
    doc.moveDown(1.5);
    doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Condutores do Circuito', { underline: true });
    doc.moveDown(0.4);
    if (conductors.length === 0) {
      doc.fillColor(GRAY).fontSize(10).font('Helvetica').text('Nenhum condutor associado a este circuito.');
    } else {
      const COL2 = [40, 160, 260, 340, 420];
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
      doc.text('De', COL2[0], doc.y, { width: 115, continued: false });
      const ry = doc.y - 11;
      doc.text('Para', COL2[1], ry, { width: 95 });
      doc.text('Tipo', COL2[2], ry, { width: 75 });
      doc.text('Tensão (kV)', COL2[3], ry, { width: 75 });
      doc.text('Comprimento (m)', COL2[4], ry, { width: 120 });
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(8);
      for (const c of conductors) {
        const y = doc.y;
        const lenM = c.computed_length_m ?? c.length_m;
        doc.fillColor('#334155').text(c.from_name || `P#${c.pole_from}`, COL2[0], y, { width: 115 });
        doc.text(c.to_name || `P#${c.pole_to}`, COL2[1], y, { width: 95 });
        doc.text((c.network_type || c.cable_type || '—').toUpperCase(), COL2[2], y, { width: 75 });
        doc.text(c.voltage_kv != null ? String(c.voltage_kv) : '—', COL2[3], y, { width: 75 });
        doc.text(lenM != null ? lenM.toFixed(1) : '—', COL2[4], y, { width: 120 });
        doc.moveDown(0.15);
      }
    }

    // Maintenance plans
    if (plans.length > 0) {
      doc.moveDown(1.5);
      doc.fillColor(DARK).fontSize(13).font('Helvetica-Bold').text('Planos de Manutenção Ativos', { underline: true });
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(8).fillColor('#334155');
      for (const pl of plans) {
        doc.text(`[${pl.pole_name}] ${pl.plan_text?.split('\n')[0] ?? '—'} — R$ ${pl.estimated_cost?.toFixed(2) ?? '—'}`);
        doc.moveDown(0.2);
      }
    }

    doc.end();
  } catch (err) {
    console.error('Erro ao gerar relatório de circuito:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar relatório de circuito' });
  }
});

export default router;

