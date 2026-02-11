import { Request, Response, NextFunction } from 'express';

export const checkPermission = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // In a real app, this would come from a JWT or session
    // For this mock phase, we'll look for a 'x-user-role' header
    const userRole = req.headers['x-user-role'] as string;

    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
