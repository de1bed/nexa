-- Documentos de seguridad que el visitante recibe antes de llegar, el
-- momento en que los acepta, y el tipo de caseta (peatonal o vehicular).
-- Hay que aplicar esta migración en producción. Sin ella, guardar documentos
-- de seguridad o el tipo de caseta responde que la columna no existe; el
-- resto del acceso sigue funcionando.

alter table public.organization_settings
  add column if not exists safety_documents jsonb not null default '[]'::jsonb;

alter table public.visits
  add column if not exists safety_accepted_at timestamptz;

alter table public.booths
  add column if not exists kind text not null default 'general';

alter table public.booths
  drop constraint if exists booths_kind_check;

alter table public.booths
  add constraint booths_kind_check
  check (kind in ('general', 'pedestrian', 'vehicle'));
