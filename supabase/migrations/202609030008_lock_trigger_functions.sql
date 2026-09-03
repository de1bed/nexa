-- ============================================================================
-- Los disparadores no tienen por qué estar al alcance de la API
--
-- El asesor de seguridad de Supabase señala que handle_new_user() y
-- enforce_visit_update_permissions() son invocables en /rest/v1/rpc por anon y
-- authenticated. La causa no es una omisión de las migraciones anteriores: los
-- privilegios por omisión del proyecto conceden EXECUTE a esos roles en cuanto
-- se crea una función en "public", así que revocar solo a "public" no basta.
--
-- Llamarlas directamente ya falla ("trigger functions can only be called as
-- triggers"), de modo que esto no cierra un agujero: reduce la superficie y
-- deja el asesor limpio para que un aviso futuro se note.
--
-- El privilegio de un disparador se comprueba al crearlo, no cada vez que se
-- dispara, así que revocarlo no cambia su comportamiento. En cambio is_member(),
-- has_role() y can_access_visit() SÍ necesitan EXECUTE y deben conservarlo: las
-- políticas RLS se evalúan con los privilegios de quien consulta, y sin él toda
-- lectura falla con "permission denied for function" (verificado).
-- ============================================================================

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_visit_update_permissions() from public, anon, authenticated;
