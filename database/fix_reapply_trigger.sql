-- Fix: handle_new_user trigger — handle domain UNIQUE conflict
-- Safe to run multiple times.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_channel_id UUID;
  v_invite_token TEXT;
  v_invite_record RECORD;
  v_default_role_id UUID;
BEGIN
  v_invite_token := NEW.raw_user_meta_data ->> 'invite_token';

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_invite_record FROM public.invitations
    WHERE token = v_invite_token
    AND email = NEW.email
    AND status = 'pending'
    AND expires_at > now();

    IF FOUND THEN
      v_org_id := v_invite_record.organization_id;
      UPDATE public.invitations SET status = 'accepted' WHERE id = v_invite_record.id;
    ELSE
      v_org_name := split_part(NEW.email, '@', 2);
      INSERT INTO public.organizations (name, domain) VALUES (v_org_name, NEW.email)
      ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_org_id;
      PERFORM public.seed_default_roles(v_org_id);
    END IF;
  ELSE
    v_org_name := COALESCE(NEW.raw_user_meta_data ->> 'organization_name', split_part(NEW.email, '@', 2), 'My Organization');
    INSERT INTO public.organizations (name, domain) VALUES (v_org_name, NEW.email)
    ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_org_id;
    PERFORM public.seed_default_roles(v_org_id);
  END IF;

  IF v_invite_token IS NOT NULL THEN
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id AND name = 'Employee';
  ELSE
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id AND name = 'Administrator';
  END IF;
  IF v_default_role_id IS NULL THEN
    SELECT id INTO v_default_role_id FROM public.roles WHERE organization_id = v_org_id LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, organization_id, email, role, role_id)
  VALUES (NEW.id, v_org_id, NEW.email,
    CASE WHEN v_invite_token IS NOT NULL THEN 'employee' ELSE 'admin' END,
    v_default_role_id);

  INSERT INTO public.channels (organization_id, name, description, created_by)
  VALUES (v_org_id, 'general', 'General discussion', NEW.id)
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO v_channel_id;

  IF v_channel_id IS NULL THEN
    SELECT id INTO v_channel_id FROM public.channels WHERE organization_id = v_org_id AND name = 'general';
  END IF;

  INSERT INTO public.channel_members (channel_id, user_id, organization_id, role)
  VALUES (v_channel_id, NEW.id, v_org_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
