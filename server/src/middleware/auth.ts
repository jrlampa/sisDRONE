import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';

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
