-- Fix: handle_new_user trigger — handle domain UNIQUE conflict
-- When re-signing up after deleting auth users, the old org still exists
-- with the same domain (user's email). This caused a 500 error.
--
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  channel_id UUID;
  invite_token TEXT;
  invite_record RECORD;
  default_role_id UUID;
BEGIN
  invite_token := NEW.raw_user_meta_data ->> 'invite_token';

  IF invite_token IS NOT NULL THEN
    SELECT * INTO invite_record FROM public.invitations
    WHERE token = invite_token
    AND email = NEW.email
    AND status = 'pending'
    AND expires_at > now();

    IF FOUND THEN
      org_id := invite_record.organization_id;
      UPDATE public.invitations SET status = 'accepted' WHERE id = invite_record.id;
    ELSE
      org_name := split_part(NEW.email, '@', 2);
      INSERT INTO public.organizations (name, domain) VALUES (org_name, NEW.email)
      ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO org_id;
      PERFORM public.seed_default_roles(org_id);
    END IF;
  ELSE
    org_name := COALESCE(NEW.raw_user_meta_data ->> 'organization_name', split_part(NEW.email, '@', 2), 'My Organization');
    INSERT INTO public.organizations (name, domain) VALUES (org_name, NEW.email)
    ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO org_id;
    PERFORM public.seed_default_roles(org_id);
  END IF;

  -- Assign default role
  IF invite_token IS NOT NULL THEN
    SELECT id INTO default_role_id FROM public.roles WHERE organization_id = org_id AND name = 'Employee';
  ELSE
    SELECT id INTO default_role_id FROM public.roles WHERE organization_id = org_id AND name = 'Administrator';
  END IF;
  -- Safety: if no matching role name found, pick any role in the org
  IF default_role_id IS NULL THEN
    SELECT id INTO default_role_id FROM public.roles WHERE organization_id = org_id LIMIT 1;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, organization_id, email, role, role_id)
  VALUES (
    NEW.id, org_id, NEW.email,
    CASE WHEN invite_token IS NOT NULL THEN 'employee' ELSE 'admin' END,
    default_role_id
  );

  -- Create #general channel
  INSERT INTO public.channels (organization_id, name, description, created_by)
  VALUES (org_id, 'general', 'General discussion', NEW.id)
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO channel_id;

  IF channel_id IS NULL THEN
    SELECT id INTO channel_id FROM public.channels WHERE organization_id = org_id AND name = 'general';
  END IF;

  INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
  VALUES (channel_id, NEW.id, org_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
