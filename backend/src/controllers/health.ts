import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * GET /health
 * Health check endpoint that also verifies the Supabase connection.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  try {
    // Quick connectivity check against Supabase
    const { count } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true });

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      supabase: 'connected',
      organizations_count: count ?? 0,
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      supabase: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/users/me
 * Returns the current authenticated user's profile.
 */
export async function getMyProfile(
  req: Request & { user?: { id: string; email?: string } },
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
    return;
  }

  res.json({ user: req.user, profile: data });
}