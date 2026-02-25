/**
 * croquiService.ts — Geração de Croqui Digital SVG (Phase 31 + Phase 62)
 *
 * Gera representação vetorial (SVG) da rede elétrica: postes como círculos
 * coloridos por AHI, condutores como linhas (MT/BT/ramal) com setas de direção,
 * símbolos de equipamentos, seta Norte, barra de escala real e legenda.
 *
 * Phase 62 aprimoramentos: símbolos de equipamentos, seta Norte, barra de escala
 * visual, labels MT/BT/AT nos postes, setas de direção nos condutores MT.
 *
 * Regra: 2.5D — representação 2D com elevação/AHI textual.
 */

/** Color per network type */
const NETWORK_COLOR: Record<string, string> = {
  MT: '#f97316',
  BT: '#3b82f6',
  ramal: '#22c55e',
};
const DEFAULT_EDGE_COLOR = '#94a3b8';

/** Color per network level badge */
const LEVEL_COLOR: Record<string, string> = {
  MT: '#f97316',
  BT: '#3b82f6',
  AT: '#7c3aed',
};

/** AHI color thresholds (matching Map.tsx) */
function ahiColor(ahi: number | null): string {
  if (ahi === null || ahi === undefined) return '#9ca3af';
  if (ahi < 50) return '#ef4444';
  if (ahi < 80) return '#f59e0b';
  return '#10b981';
}

interface RawPole {
  id: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  ahi_score: number | null;
  status: string | null;
  network_level?: string | null;
}

interface RawConductor {
  id: number;
  pole_from: number;
  pole_to: number;
  network_type: string;
  from_lat: number | null;
  from_lng: number | null;
  to_lat: number | null;
  to_lng: number | null;
  computed_length_m: number | null;
  length_m: number | null;
}

interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  spanLat: number;
  spanLng: number;
}

/** Escape special XML/SVG characters to prevent XSS or malformed SVG */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SVG_W = 900;
const SVG_H = 700;
const MARGIN = 60;
const DRAW_W = SVG_W - MARGIN * 2;
const DRAW_H = SVG_H - MARGIN * 2 - 40; // reserve bottom for legend

/** Project (lat, lng) to SVG canvas coordinates. */
function project(lat: number, lng: number, bbox: BBox): [number, number] {
  const x = MARGIN + ((lng - bbox.minLng) / (bbox.spanLng || 1)) * DRAW_W;
  // Invert Y: higher lat → lower Y in SVG
  const y = MARGIN + ((bbox.maxLat - lat) / (bbox.spanLat || 1)) * DRAW_H;
  return [parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2))];
}

function computeBBox(poles: RawPole[]): BBox {
  const lats = poles.filter(p => p.lat != null).map(p => p.lat as number);
  const lngs = poles.filter(p => p.lng != null).map(p => p.lng as number);
  if (lats.length === 0) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1, spanLat: 1, spanLng: 1 };
  }
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 0.001;
  const spanLng = maxLng - minLng || 0.001;
  return { minLat, maxLat, minLng, maxLng, spanLat, spanLng };
}

/** Estimate scale bar label in meters from bbox */
function scaleBarLabel(bbox: BBox): string {
  const latMidRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const metersPerDeg = 111_320 * Math.cos(latMidRad);
  const totalWidthM = bbox.spanLng * metersPerDeg;
  const scaleM = Math.round(totalWidthM / 5 / 10) * 10 || 10;
  return `${scaleM} m`;
}

/** Build SVG string for the croqui. */
export function buildCroquiSvg(
  poles: RawPole[],
  conductors: RawConductor[],
  tenantName: string,
  equipmentByPole?: Map<number, number>, // poleId → equipment count
): string {
  if (poles.length === 0) return '';

  const bbox = computeBBox(poles);
  const poleMap = new Map(poles.map(p => [p.id, p]));

  // ── Arrowhead marker for MT conductors ──
  const defs = `<defs>
    <marker id="arrow-mt" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="${NETWORK_COLOR.MT}" opacity="0.8"/>
    </marker>
    <marker id="arrow-bt" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="${NETWORK_COLOR.BT}" opacity="0.8"/>
    </marker>
  </defs>`;

  // ── Edge lines ──
  const edgeLines = conductors.map(c => {
    if (c.from_lat == null || c.from_lng == null || c.to_lat == null || c.to_lng == null) return '';
    const [x1, y1] = project(c.from_lat, c.from_lng, bbox);
    const [x2, y2] = project(c.to_lat, c.to_lng, bbox);
    const color = NETWORK_COLOR[c.network_type] ?? DEFAULT_EDGE_COLOR;
    const dash = c.network_type === 'ramal' ? 'stroke-dasharray="6 3"' : '';
    const arrowMark = c.network_type === 'MT'
      ? 'marker-end="url(#arrow-mt)"'
      : c.network_type === 'BT'
        ? 'marker-end="url(#arrow-bt)"'
        : '';
    const len = c.computed_length_m ?? c.length_m;
    const title = `${c.network_type}${len ? ` — ${len.toFixed(0)} m` : ''}`;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" ${dash} ${arrowMark}><title>${escapeXml(title)}</title></line>`;
  }).filter(Boolean).join('\n  ');

  // ── Pole circles with network_level badge and equipment icon ──
  const poleCircles = poles.map(p => {
    if (p.lat == null || p.lng == null) return '';
    const [cx, cy] = project(p.lat, p.lng, bbox);
    const fill = ahiColor(p.ahi_score);
    const label = escapeXml((p.name || `#${p.id}`).slice(0, 16));
    const ahi = p.ahi_score != null ? `AHI: ${p.ahi_score}` : '';
    const eqCount = equipmentByPole?.get(p.id) ?? 0;

    // network_level badge (MT/BT/AT mini label)
    const lvl = p.network_level ?? 'BT';
    const lvlColor = LEVEL_COLOR[lvl] ?? LEVEL_COLOR.BT;
    const lvlBadge = `<text x="${cx + 7}" y="${cy - 5}" font-size="6" fill="${lvlColor}" font-family="monospace" font-weight="bold">${escapeXml(lvl)}</text>`;

    // Equipment icon: small ⚡ or "E" badge when pole has equipment
    const eqBadge = eqCount > 0
      ? `<circle cx="${cx - 7}" cy="${cy - 7}" r="4" fill="#fbbf24" stroke="#fff" stroke-width="0.8"/><text x="${cx - 7}" y="${cy - 4}" text-anchor="middle" font-size="5" fill="#1e293b" font-family="monospace">${eqCount}</text>`
      : '';

    return `
  <circle cx="${cx}" cy="${cy}" r="6" fill="${fill}" stroke="#fff" stroke-width="1.5"><title>${escapeXml(label)}${ahi ? ' | ' + ahi : ''}${eqCount > 0 ? ` | ${eqCount} equip.` : ''}</title></circle>
  <text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="8" fill="#1e293b" font-family="monospace">${label}</text>
  ${lvlBadge}${eqBadge}`;
  }).filter(Boolean).join('\n');

  // ── Legend ──
  const legendY = SVG_H - 36;
  const legend = `
  <rect x="0" y="${legendY - 4}" width="${SVG_W}" height="44" fill="#f8fafc"/>
  <text x="12" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#64748b">Legenda:</text>
  <line x1="70" y1="${legendY + 7}" x2="100" y2="${legendY + 7}" stroke="${NETWORK_COLOR.MT}" stroke-width="2.5"/>
  <text x="104" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#1e293b">MT</text>
  <line x1="130" y1="${legendY + 7}" x2="160" y2="${legendY + 7}" stroke="${NETWORK_COLOR.BT}" stroke-width="2.5"/>
  <text x="164" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#1e293b">BT</text>
  <line x1="190" y1="${legendY + 7}" x2="220" y2="${legendY + 7}" stroke="${NETWORK_COLOR.ramal}" stroke-width="2.5" stroke-dasharray="6 3"/>
  <text x="224" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#1e293b">Ramal</text>
  <circle cx="268" cy="${legendY + 7}" r="5" fill="#10b981"/>
  <text x="276" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#1e293b">Bom (AHI≥80)</text>
  <circle cx="360" cy="${legendY + 7}" r="5" fill="#f59e0b"/>
  <text x="368" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#1e293b">Atenção (50–79)</text>
  <circle cx="460" cy="${legendY + 7}" r="5" fill="#ef4444"/>
  <text x="468" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#1e293b">Crítico (&lt;50)</text>
  <circle cx="548" cy="${legendY + 7}" r="4" fill="#fbbf24"/>
  <text x="555" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#1e293b">Equip.</text>
  <text x="${SVG_W - 12}" y="${legendY + 10}" font-size="9" font-family="sans-serif" fill="#94a3b8" text-anchor="end">Escala aprox.: ${scaleBarLabel(bbox)}/5</text>`;

  // ── North Arrow (top-right corner) ──
  const northX = SVG_W - 36;
  const northY = 52;
  const northArrow = `<g transform="translate(${northX},${northY})">
    <circle r="18" fill="white" fill-opacity="0.85" stroke="#cbd5e1" stroke-width="1"/>
    <polygon points="0,-14 4,0 0,-4 -4,0" fill="#1e293b"/>
    <polygon points="0,14 4,0 0,4 -4,0" fill="#cbd5e1"/>
    <text x="0" y="-18" text-anchor="middle" font-size="8" font-weight="bold" font-family="sans-serif" fill="#1e293b">N</text>
  </g>`;

  // ── Scale Bar (visual, bottom-left) ──
  const latMidRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const metersPerDeg = 111_320 * Math.cos(latMidRad);
  const totalWidthM = bbox.spanLng * metersPerDeg;
  const scaleM = Math.round(totalWidthM / 5 / 10) * 10 || 10;
  const scalePx = Math.round((scaleM / (totalWidthM || 1)) * DRAW_W);
  const scaleBarX = MARGIN;
  const scaleBarY = legendY - 16;
  const scaleBar = `<g>
    <line x1="${scaleBarX}" y1="${scaleBarY}" x2="${scaleBarX + scalePx}" y2="${scaleBarY}" stroke="#64748b" stroke-width="2"/>
    <line x1="${scaleBarX}" y1="${scaleBarY - 4}" x2="${scaleBarX}" y2="${scaleBarY + 4}" stroke="#64748b" stroke-width="1.5"/>
    <line x1="${scaleBarX + scalePx}" y1="${scaleBarY - 4}" x2="${scaleBarX + scalePx}" y2="${scaleBarY + 4}" stroke="#64748b" stroke-width="1.5"/>
    <text x="${scaleBarX + scalePx / 2}" y="${scaleBarY - 6}" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#64748b">${scaleM} m</text>
  </g>`;

  // ── Title ──
  const title = `<text x="${SVG_W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="bold" font-family="sans-serif" fill="#1e293b">sisDRONE — Croqui Digital: ${escapeXml(tenantName)}</text>`;
  const subtitle = `<text x="${SVG_W / 2}" y="38" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#64748b">${poles.length} postes · ${conductors.length} condutores · Gerado ${new Date().toLocaleDateString('pt-BR')}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
  <rect width="${SVG_W}" height="${SVG_H}" fill="#f0f4f8"/>
  ${defs}
  ${title}
  ${subtitle}
  ${edgeLines}
  ${poleCircles}
  ${northArrow}
  ${scaleBar}
  ${legend}
</svg>`;
}
