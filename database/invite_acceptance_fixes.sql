-- ============================================================
-- INVITE ACCEPTANCE FIXES
--
-- This migration:
--   1. Updates get_invite_by_token to also return role + organization_id
--   2. Adds accept_invite_existing_user RPC so an already-registered
--      user can bind themselves to the inviting org when they log in
--      via an invite link ("Log In to Accept" flow).
--
-- Safe to run multiple times (uses CREATE OR REPLACE).
-- ============================================================

-- ============================================
-- 1. Updated get_invite_by_token
--    Now also returns role + organization_id so the frontend can
--    show role context and the existing-user accept RPC can run.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token TEXT)
RETURNS TABLE (
  organization_name TEXT,
  email TEXT,
  role TEXT,
  organization_id UUID
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    inv.organization_name,
    inv.email,
    inv.role,
    inv.organization_id
  FROM invitations inv
  WHERE inv.token = p_token
  AND inv.status = 'pending'
  AND inv.expires_at > now()
  LIMIT 1
$$;

-- ============================================
-- 2. accept_invite_existing_user
--    Called by an authenticated user who arrived via an invite link
--    but already has an account. Moves them into the inviting org
--    with the role specified on the invitation, and marks the
--    invitation as accepted.
--
--    Returns the organization_name so the caller can show a toast.
-- ============================================
CREATE OR REPLACE FUNCTION public.accept_invite_existing_user(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_email TEXT;
  v_default_role_id UUID;
  v_channel_id UUID;
BEGIN
  -- Caller must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to accept an invitation';
  END IF;

  -- Look up the pending, non-expired invitation
  SELECT * INTO v_invite
  FROM public.invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- The invited email must match the signed-in user's email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL OR lower(v_user_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  -- Move the existing user's profile into the inviting org with the invited role
  SELECT id INTO v_default_role_id
  FROM public.roles
  WHERE organization_id = v_invite.organization_id
  AND lower(name) = 'employee'
  LIMIT 1;

  UPDATE public.profiles
  SET
    organization_id = v_invite.organization_id,
    role = COALESCE(v_invite.role, 'employee'),
    role_id = COALESCE(v_default_role_id, role_id)
  WHERE id = auth.uid();

  -- Ensure the user is a member of the org's #general channel
  SELECT id INTO v_channel_id
  FROM public.channels
  WHERE organization_id = v_invite.organization_id AND name = 'general'
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
    VALUES (v_channel_id, auth.uid(), v_invite.organization_id, 'member')
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = v_invite.id;

  RETURN v_invite.organization_name;
END;
$$;

-- Refresh PostgREST schema cache so the new RPC is exposed
NOTIFY pgrst, 'reload schema';
