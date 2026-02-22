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
    console.error('PDF report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar relatório PDF' });
  }
});

export default router;
