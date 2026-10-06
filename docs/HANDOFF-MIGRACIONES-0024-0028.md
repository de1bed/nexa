# Traspaso: migraciones 0024 a 0028

**Para:** el agente con acceso al proyecto de Supabase (Cursor).
**De:** la sesión que escribió el código, sin acceso a la base de datos.
**Fecha:** 6 de octubre de 2026.

Guion ejecutable. Sigue los pasos en orden. Cada verificación trae el resultado
que debe dar. Si algo no coincide, **detente y reporta**: no improvises arreglos
sobre el esquema.

---

## 1. Qué cambia

| Archivo | Qué hace | ¿Toca datos existentes? |
| --- | --- | --- |
| `202610060024_retention_unlimited.sql` | Retención **ilimitada** de identificaciones, por omisión. RPC `apply_document_retention`. `resolve_invitation` devuelve `retention_unlimited`. | **Sí.** Pone `document_retention_unlimited = true` en todas las empresas y `retention_expires_at = null` en todos los documentos vivos. |
| `202610060025_vehicle_declined.sql` | `visits.vehicle_declined` («No traje vehículo»). | No (columna con default). |
| `202610060026_multi_location_pass.sql` | QR válido en varias sedes: `visits.all_locations`, tabla `visit_access_locations`, `organization_members.default_location_id`, `record_access_decision` con `p_location_id`, `resolve_qr_token` con columnas nuevas. | No. Las visitas existentes quedan con `all_locations = true`, que es como ya funcionaban. |
| `202610060027_visit_attachments.sql` | Requisitos por empresa (`organization_requirements`), anexos por visita (`visit_attachments`), `visitor_documents.attachment_id`. | No. |
| `202610060028_walkin_points.sql` | QR de recepción por sede (`walkin_points`, `walkin_attempts`, RPC `walkin_verify`) y bucket público `organization-logos`. | No. |

## 2. Orden de despliegue (importante)

1. **Primero las cinco migraciones**, en orden numérico.
2. **Después el código.**

El código nuevo lee columnas y tablas que solo existen tras las migraciones. Si
se despliega antes, la lista de visitas, la configuración y la caseta fallan.

Al revés no hay problema: el código actual sigue funcionando con el esquema
nuevo. `record_access_decision` acepta la llamada vieja de 4 argumentos porque
`p_location_id` tiene default, y `resolve_qr_token` solo agrega columnas.

## 3. Antes de aplicar

```sql
-- 3.1 Las migraciones previas están aplicadas (la última debe ser 0023).
select version from supabase_migrations.schema_migrations order by version desc limit 3;
-- Esperado: 202609300023 arriba.

-- 3.2 Ninguno de los objetos nuevos existe ya.
select to_regclass('public.visit_access_locations'),
       to_regclass('public.organization_requirements'),
       to_regclass('public.visit_attachments'),
       to_regclass('public.walkin_points'),
       to_regclass('public.walkin_attempts');
-- Esperado: cinco null.

-- 3.3 Una sola versión de record_access_decision (4 argumentos).
select pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_access_decision';
-- Esperado: una fila con 4 argumentos.

-- 3.4 Respaldo de las fechas de retención: 0024 las borra y no se pueden recalcular igual.
create table if not exists public._backup_retention_20261006 as
select id, retention_expires_at from public.visitor_documents where deleted_at is null;
```

## 4. Aplicar

Con la CLI vinculada al proyecto:

```bash
npx supabase db push
```

O una por una con el MCP de Supabase (`apply_migration`), usando como `name` el
nombre del archivo sin extensión y como `query` su contenido completo. Aplica
cada archivo en una sola transacción y no las juntes en una sola llamada.

## 5. Verificar

```sql
-- 0024 · retención
select count(*) from public.organization_settings where not document_retention_unlimited;
-- Esperado: 0
select count(*) from public.visitor_documents where deleted_at is null and retention_expires_at is not null;
-- Esperado: 0
select is_nullable from information_schema.columns
where table_name = 'visitor_documents' and column_name = 'retention_expires_at';
-- Esperado: YES

-- 0025 · vehículo
select column_default from information_schema.columns
where table_name = 'visits' and column_name = 'vehicle_declined';
-- Esperado: false

-- 0026 · sedes
select pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_access_decision';
-- Esperado: UNA fila, 5 argumentos, el último "p_location_id uuid".
select count(*) from public.visits where not all_locations;
-- Esperado: 0 (las visitas previas valen en todas las sedes)

-- 0027 / 0028 · RLS activo en todas las tablas nuevas
select relname, relrowsecurity from pg_class
where relname in ('visit_access_locations','organization_requirements',
                  'visit_attachments','walkin_points','walkin_attempts');
-- Esperado: cinco filas con true.

-- 0028 · bucket de logos
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'organization-logos';
-- Esperado: public = true, 2097152, {image/png,image/jpeg,image/webp}

-- Funciones que solo debe ejecutar service_role
select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('walkin_verify','visit_valid_at_location',
                    'visit_access_locations_same_org','member_location_same_org',
                    'visit_attachments_same_org','walkin_points_same_org');
-- Esperado: false / false en todas.

select has_function_privilege('authenticated', 'public.apply_document_retention(uuid)', 'execute');
-- Esperado: true (la llama la API con la sesión del admin; la función valida el rol)
```

Al final corre el asesor de seguridad (`get_advisors` tipo `security`) y reporta
cualquier aviso **nuevo** sobre estas tablas o funciones.

### Prueba funcional mínima (opcional, en una empresa de prueba)

```sql
-- Debe rechazar un check-in en una sede que no está en el pase.
-- 1) Crea una visita de prueba con all_locations = false y location_id = <sede A>.
-- 2) Como guardia de esa empresa:
--    select public.record_access_decision('<visit>', 'check_in', null, true, '<sede B>');
-- Esperado: error «Este pase no es válido en esta sede».
-- 3) Con '<sede A>' debe registrar la entrada, y access_events.location_id = sede A.
```

## 6. Reversa

Solo si algo sale mal **antes** de desplegar el código. Después de desplegarlo,
la reversa rompe la aplicación.

```sql
-- 0028
drop function if exists public.walkin_verify(text, text, text);
drop table if exists public.walkin_attempts;
drop table if exists public.walkin_points;
drop function if exists public.walkin_points_same_org();
-- (el bucket organization-logos se puede dejar; está vacío)

-- 0027
alter table public.visitor_documents drop column if exists attachment_id;
drop table if exists public.visit_attachments;
drop table if exists public.organization_requirements;
drop function if exists public.visit_attachments_same_org();

-- 0026: restaurar record_access_decision y resolve_qr_token desde 202609300023 y
-- 202609020006 (copiar sus bloques create function), y luego:
drop function if exists public.record_access_decision(uuid, text, text, boolean, uuid);
drop function if exists public.visit_valid_at_location(public.visits, uuid);
drop table if exists public.visit_access_locations;
drop function if exists public.visit_access_locations_same_org();
drop trigger if exists member_location_same_org on public.organization_members;
drop function if exists public.member_location_same_org();
alter table public.organization_members drop column if exists default_location_id;
alter table public.visits drop column if exists all_locations;

-- 0025
alter table public.visits drop column if exists vehicle_declined;

-- 0024: restaurar fechas desde el respaldo del paso 3.4
update public.visitor_documents d set retention_expires_at = b.retention_expires_at
from public._backup_retention_20261006 b where b.id = d.id;
-- (restaurar resolve_invitation desde 202609220016)
```

Cuando todo esté verificado y desplegado, borra el respaldo:
`drop table public._backup_retention_20261006;`

## 7. Qué reportar de vuelta

- Resultado de cada consulta de la sección 5 (aunque coincida).
- Avisos nuevos del asesor de seguridad.
- Cualquier error de `db push` con el mensaje completo.
