-- El administrador puede volver a ver el código del guardia.
-- La tabla sigue cerrada para el navegador: solo la API de administración la lee.

alter table public.guard_access_codes
  add column if not exists code_display text;

comment on column public.guard_access_codes.code_display is
  'Texto del código para el administrador. El guardia no consulta esta tabla.';
