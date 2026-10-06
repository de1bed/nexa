-- ============================================================================
-- «No traje vehículo»
--
-- A veces el anfitrión espera un vehículo que el visitante no trae. Aunque la
-- empresa pida el vehículo como obligatorio, el visitante puede declarar que
-- no lo trae; entonces no se le exigen placas ni fotos y la caseta lo ve así.
-- ============================================================================

alter table public.visits
  add column if not exists vehicle_declined boolean not null default false;
