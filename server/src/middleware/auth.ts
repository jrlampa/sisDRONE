import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { getDb } from '../db';

/**
 * Extracts role from request:
 *  1. JWT Bearer token in Authorization header (production path)
 *  2. x-user-role header (dev/test fallback)
 */
function extractRole(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      // Attach decoded user to request for downstream use
      (req as any).jwtUser = payload;
      return payload.role;
    } catch {
      return null;
    }
  }

  // Fallback: mock header for tests and dev
  return (req.headers['x-user-role'] as string) || null;
}

/** Extracts userId from JWT payload or x-user-id test header */
function extractUserId(req: Request): number | null {
  const jwtUserId = (req as any).jwtUser?.userId;
  if (jwtUserId) return jwtUserId;
  const headerVal = parseInt(String(req.headers['x-user-id'] || ''), 10);
  return isNaN(headerVal) || headerVal <= 0 ? null : headerVal;
}

export const checkPermission = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = extractRole(req);

    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

/**
 * Default permissions per role — used as fallback when no explicit granular permission is set.
 * Key format: "resource/action"
 */
const DEFAULT_ROLE_PERMISSIONS: Record<string, Set<string>> = {
  ADMIN: new Set(['*']), // ADMIN has all permissions
  ENGINEER: new Set([
    'poles/create', 'poles/read', 'poles/update', 'poles/delete',
    'inspections/create', 'inspections/read', 'inspections/update', 'inspections/delete',
    'conductors/create', 'conductors/read', 'conductors/delete',
    'work_orders/create', 'work_orders/read', 'work_orders/update', 'work_orders/delete',
    'circuits/create', 'circuits/read', 'circuits/update', 'circuits/delete',
    'network/read', 'report/read', 'maintenance/create', 'maintenance/read',
  ]),
  VIEWER: new Set([
    'poles/read', 'inspections/read', 'conductors/read', 'network/read',
    'circuits/read', 'report/read', 'maintenance/read',
  ]),
};

/**
 * Middleware factory for granular permission checks (Phase 37).
 * Combines role-based defaults with explicit permissions from the `permissions` table.
 *
 * Precedence:
 *  1. ADMIN role → always allowed
 *  2. Explicit DB permission found → allowed
 *  3. Role default includes resource/action → allowed
 *  4. Otherwise → 403
 */
export const checkGranularPermission = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userRole = extractRole(req);
    if (!userRole) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }

    // ADMIN bypasses all checks
    if (userRole === 'ADMIN') return next();

    const userId = extractUserId(req);

    // Check explicit DB permission if we have a userId
    if (userId) {
      try {
        const db = await getDb();
        const perm = await db.get(
          'SELECT id FROM permissions WHERE user_id = ? AND resource = ? AND action = ?',
          [userId, resource, action]
        );
        if (perm) return next();
      } catch {
        // DB check failure → fall through to role default
      }
    }

    // Fall back to role-based defaults
    const defaults = DEFAULT_ROLE_PERMISSIONS[userRole];
    if (defaults && (defaults.has('*') || defaults.has(`${resource}/${action}`))) {
      return next();
    }

    return res.status(403).json({ error: 'Acesso negado: permissão insuficiente' });
  };
};
