/**
 * auditLog.ts — Middleware de Rastreabilidade de Ações (Phase 50)
 *
 * Registra automaticamente mutations bem-sucedidas (POST/PUT/PATCH/DELETE)
 * na tabela `audit_log`. Fire-and-forget: falhas de escrita nunca bloqueiam
 * a resposta principal.
 *
 * Formato da entrada:
 *   user_id, user_role, action (CREATE/UPDATE/DELETE),
 *   entity_type (ex: 'poles'), entity_id, payload_json (max 2000 chars), ip
 */
import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';

/** HTTP methods mapeados para ações de auditoria */
const METHOD_ACTION: Readonly<Record<string, string>> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/** Tamanho máximo do snapshot de payload persistido */
const MAX_PAYLOAD_LEN = 2000;

/** Regex para extrair o primeiro segmento de path após /api/ */
const ENTITY_REGEX = /^\/api\/([^/?]+)/;

/** Extrai o tipo da entidade a partir do path (ex: /api/poles/5 → 'poles') */
function extractEntityType(reqPath: string): string {
  const m = ENTITY_REGEX.exec(reqPath);
  return m ? m[1] : 'unknown';
}

/** Extrai o ID numérico da entidade a partir do path (ex: /api/poles/5 → 5) */
function extractEntityId(reqPath: string): number | null {
  const segments = reqPath.split('/').filter(Boolean);
  if (segments.length >= 3) {
    const id = parseInt(segments[2], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

/**
 * Express middleware que registra actions de escrita na tabela `audit_log`.
 * Deve ser montado globalmente **antes** das rotas (app.use(auditLog)).
 */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  const action = METHOD_ACTION[method];

  // Não audita leituras (GET/HEAD/OPTIONS) nem preflight
  if (!action) {
    next();
    return;
  }

  res.on('finish', () => {
    // Só loga respostas bem-sucedidas (2xx)
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    // Extrai userId — primeiro do JWT, depois do header de teste
    const jwtUser = (req as any).jwtUser;
    const rawHeaderId = parseInt(String(req.headers['x-user-id'] || ''), 10);
    const userId: number | null = jwtUser?.userId ?? (isNaN(rawHeaderId) || rawHeaderId <= 0 ? null : rawHeaderId);

    // Extrai role — primeiro do JWT, depois do header de teste
    const userRole: string | null =
      jwtUser?.role ?? (String(req.headers['x-user-role'] || '') || null);

    const entityType = extractEntityType(req.path);
    const entityId   = extractEntityId(req.path);

    // Serializa o body, truncando se necessário
    const payloadRaw = JSON.stringify(req.body ?? {});
    const payload =
      payloadRaw.length > MAX_PAYLOAD_LEN
        ? payloadRaw.slice(0, MAX_PAYLOAD_LEN) + '...[truncado]'
        : payloadRaw;

    // IP: primeiro X-Forwarded-For (proxy), depois socket remoto
    const rawIp = String(
      req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? ''
    );
    const ip = rawIp.split(',')[0].trim().slice(0, 45);

    // Fire-and-forget — falhas não propagam
    getDb()
      .then(db =>
        db.run(
          `INSERT INTO audit_log
             (user_id, user_role, action, entity_type, entity_id, payload_json, ip)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, userRole, action, entityType, entityId, payload, ip]
        )
      )
      .catch(() => {
        /* silently ignore — audit log nunca deve interromper a operação principal */
      });
  });

  next();
}
