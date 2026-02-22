import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
let handlerCounter = 0;

/**
 * Simple in-memory rate limiter.
 * Each call to rateLimit() creates an independent handler with its own counter per IP.
 * @param maxRequests Maximum requests per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  const handlerId = ++handlerCounter;
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${handlerId}:${ip}`;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
    } else {
      entry.count += 1;
    }

    if (entry.count > maxRequests) {
      res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
      return;
    }

    next();
  };
}
