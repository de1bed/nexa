-- El acceso al equipo es solo por invitación.
-- Una clave o un código ya no crean membresía.

create or replace function public.submit_access_request(
  p_key text,
  p_role text,
  p_department uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object('state', 'closed');
end;
$$;

create or replace function public.review_access_request(
  p_request uuid,
  p_decision text,
  p_role text,
  p_department uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object('state', 'closed');
end;
$$;

create or replace function public.use_join_code(p_code text)
returns table(
  organization_id uuid,
  organization_name text,
  role public.member_role,
  already_member boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'El acceso es solo por invitación' using errcode = '42501';
end;
$$;
