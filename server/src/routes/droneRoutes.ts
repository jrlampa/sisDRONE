/**
 * droneRoutes.ts — Rotas de Planejamento de Inspeção por Drone (Phase 55)
 *
 * GET /api/drones/route       — Retorna rota JSON (TSP nearest-neighbor)
 * GET /api/drones/route/kml   — Retorna rota KML para Google Earth Pro
 *
 * Smart Backend: toda lógica de roteamento em routeService.ts.
 * Zero custo: sem APIs externas.
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { rateLimit } from '../middleware/rateLimit';
import { planInspectionRoute } from '../services/routeService';

const router = Router();

/** Escapa caracteres especiais XML para uso seguro em KML/SVG */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Valida e parseia um parâmetro query opcional de coordenada */
function parseCoord(val: unknown, min: number, max: number): number | null | 'invalid' {
  if (val === undefined || val === '') return null;
  const n = parseFloat(String(val));
  if (isNaN(n) || n < min || n > max) return 'invalid';
  return n;
}

/**
 * GET /api/drones/route?tenant_id=&start_lat=&start_lng=
 * Retorna rota JSON de inspeção (waypoints ordenados, distâncias, tempo estimado).
 */
router.get('/route', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  const tenantId = parseInt(String(req.query.tenant_id ?? ''), 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  const startLat = parseCoord(req.query.start_lat, -90, 90);
  const startLng = parseCoord(req.query.start_lng, -180, 180);

  if (startLat === 'invalid') return res.status(400).json({ error: 'start_lat inválido' });
  if (startLng === 'invalid') return res.status(400).json({ error: 'start_lng inválido' });

  try {
    const db = await getDb();
    const tenant = await db.get('SELECT id FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Concessionária não encontrada' });

    const poles = await db.all(
      `SELECT id, name, lat, lng, ahi_score
       FROM poles WHERE tenant_id = ? AND lat IS NOT NULL AND lng IS NOT NULL`,
      [tenantId],
    );

    if (poles.length === 0) {
      return res.status(404).json({ error: 'Nenhum poste com coordenadas encontrado' });
    }

    const route = planInspectionRoute(
      poles,
      startLat ?? undefined,
      startLng ?? undefined,
    );
    return res.json(route);
  } catch (err) {
    console.error('Erro ao gerar rota de drone:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar rota de drone' });
  }
});

/**
 * GET /api/drones/route/kml?tenant_id=&start_lat=&start_lng=
 * Retorna KML da rota de inspeção para importação no Google Earth Pro.
 */
router.get('/route/kml', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const tenantId = parseInt(String(req.query.tenant_id ?? ''), 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ error: 'tenant_id inválido' });
  }

  const startLat = parseCoord(req.query.start_lat, -90, 90);
  const startLng = parseCoord(req.query.start_lng, -180, 180);

  if (startLat === 'invalid') return res.status(400).json({ error: 'start_lat inválido' });
  if (startLng === 'invalid') return res.status(400).json({ error: 'start_lng inválido' });

  try {
    const db = await getDb();
    const tenant = await db.get('SELECT id, name FROM tenants WHERE id = ?', [tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Concessionária não encontrada' });

    const poles = await db.all(
      `SELECT id, name, lat, lng, ahi_score
       FROM poles WHERE tenant_id = ? AND lat IS NOT NULL AND lng IS NOT NULL`,
      [tenantId],
    );

    if (poles.length === 0) {
      return res.status(404).json({ error: 'Nenhum poste com coordenadas encontrado' });
    }

    const route = planInspectionRoute(poles, startLat ?? undefined, startLng ?? undefined);
    const tenantName = escapeXml(String(tenant.name ?? `Tenant ${tenantId}`));
    const dateStr = new Date().toLocaleDateString('pt-BR');

    const waypointsKml = route.waypoints
      .map((wp) => {
        const wpName = escapeXml(String(wp.name ?? `Poste #${wp.pole_id}`));
        const desc = `AHI: ${wp.ahi_score ?? 'N/D'} | Dist. anterior: ${wp.distance_from_prev_m} m`;
        return (
          `    <Placemark>\n` +
          `      <name>${wp.order}. ${wpName}</name>\n` +
          `      <description>${escapeXml(desc)}</description>\n` +
          `      <styleUrl>#droneWaypoint</styleUrl>\n` +
          `      <Point><coordinates>${wp.lng},${wp.lat},0</coordinates></Point>\n` +
          `    </Placemark>`
        );
      })
      .join('\n');

    const coordsKml = route.waypoints.map((wp) => `${wp.lng},${wp.lat},0`).join(' ');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>sisDRONE — Rota de Inspeção — ${tenantName}</name>
    <description>Roteiro gerado em ${dateStr} | ${route.total_poles} postes | ${route.total_distance_km} km | ~${route.estimated_flight_minutes} min</description>
    <Style id="droneWaypoint">
      <IconStyle><color>ff0078d4</color><scale>0.8</scale></IconStyle>
      <LabelStyle><scale>0.7</scale></LabelStyle>
    </Style>
    <Placemark>
      <name>Rota — ${tenantName}</name>
      <Style><LineStyle><color>ff0078d4</color><width>3</width></LineStyle></Style>
      <LineString>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coordsKml}</coordinates>
      </LineString>
    </Placemark>
${waypointsKml}
  </Document>
</kml>`;

    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rota_drone_tenant${tenantId}.kml"`,
    );
    return res.send(kml);
  } catch (err) {
    console.error('Erro ao gerar KML de rota:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar KML de rota' });
  }
});

export default router;
