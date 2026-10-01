-- La consola puede borrar una empresa. El aviso queda en la bitácora
-- aunque la empresa ya no exista.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.platform_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%company_created%';
  if constraint_name is not null then
    execute format(
      'alter table public.platform_events drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.platform_events
  add constraint platform_events_event_type_check
  check (
    event_type in (
      'company_created',
      'service_paused',
      'service_resumed',
      'key_rotated',
      'payment_recorded',
      'company_updated',
      'company_archived',
      'company_restored',
      'admin_invite_resent',
      'company_deleted'
    )
  );
