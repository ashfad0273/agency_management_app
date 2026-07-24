import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Middleware that verifies the Supabase JWT from the Authorization header.
 * Attaches the authenticated user to `req.user` on success.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: data.user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}