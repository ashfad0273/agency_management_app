import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

/**
 * GET /api/users/me
 * Returns the current authenticated user's profile.
 */
export async function getMyProfile(
  req: AuthenticatedRequest,
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
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch profile' });
    return;
  }

  res.json({ user: req.user, profile: data });
}
