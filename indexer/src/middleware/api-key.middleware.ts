import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const ADMIN_KEY = process.env.INDEXER_ADMIN_KEY;

// Paths that bypass the API key check. Health must be open so Render's
// anonymous health probe can reach it.
const PUBLIC_PATHS = new Set<string>([
  '/admin/health',
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {

  use(req: Request, res: Response, next: NextFunction) {
    const fullPath = (req.originalUrl || req.url || '').split('?')[0];
    if (PUBLIC_PATHS.has(fullPath)) return next();

    if (!ADMIN_KEY) {
      res.status(503).json({ error: 'INDEXER_ADMIN_KEY not configured on the server' });
      return;
    }

    const header = req.headers['x-admin-key'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || !timingSafeEqual(String(provided), ADMIN_KEY)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }
}
