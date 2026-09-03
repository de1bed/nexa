# Traspaso: conectar NEXA VISIT a Supabase

**Para:** el agente o desarrollador que tenga acceso al proyecto de Supabase.
**De:** la sesión que construyó la plataforma sin acceso a la base de datos.
**Fecha:** 3 de septiembre de 2026.

Este documento es un guion ejecutable. Sigue los pasos en orden; cada uno trae el
comando o el SQL exacto y **el resultado que debe dar**. Si un resultado no
coincide, la sección 7 explica qué significa.

---

## 1. Situación en una pantalla

La aplicación está terminada y verificada en todo lo que se puede verificar sin
base de datos. Opera en dos modos, decididos por una sola función
(`isLiveMode()` en [`src/lib/config.ts`](../src/lib/config.ts)):

| Modo | Cuándo | Qué usa |
| --- | --- | --- |
| **Vitrina** | No hay credenciales de Supabase | Estado local del navegador |
| **Real** | Hay credenciales | Supabase: Auth, RLS, Storage privado |

**No hay que tocar código para pasar a modo real.** Basta con `.env.local`.

### Lo que ya está verificado

```
lint ✓   typecheck ✓   55 unitarias ✓   14 E2E ✓ (escritorio y móvil)   build ✓
```

### Estado del despliegue

> **Las migraciones ya se aplicaron** el 3 de septiembre de 2026 contra el
> proyecto `ogrdzqrvbrpgbtkmhuus`, y las verificaciones de la sección 5 pasaron
> todas: hash canónico, las catorce funciones, RLS en las trece tablas, bucket
> privado, aislamiento entre dos empresas, trigger de columnas por rol, decisión
> de acceso por rol y ventanas configurables. Los datos de prueba se borraron
> después: el proyecto quedó vacío.

Lo que falta no se puede hacer con SQL: el SMTP propio y las URLs de Auth viven
en el panel (sección 4), y el recorrido completo necesita un teléfono real
(sección 6).

Si cambias el esquema, repite la sección 5. No asumas que sigue bien porque un
día lo estuvo.

---

## 2. Paso 0 — Credenciales

Crea `.env.local` en la raíz (ya está en `.gitignore`):

```bash
# Panel → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key — botón "Reveal">

# Panel → Project Settings → Database → Connection string → URI
SUPABASE_DB_URL=postgresql://postgres.<REF>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_DB_URL` no la lee la aplicación; sirve para aplicar migraciones y
correr las verificaciones con `psql`.

> **Contexto útil:** el proyecto en uso es `ogrdzqrvbrpgbtkmhuus`, y es el que
> apunta la conexión MCP de Supabase en `C:\Users\david\.cursor\mcp.json`. El ref
> anterior, `ympluwkqneyiqjjlbnwx`, todavía existe en el plano de control —la API
> de gestión responde— pero su base de datos da timeout y su subdominio no
> resuelve en DNS: está pausado o abandonado. **No lo uses.**

---

## 3. Paso 1 — Aplicar las migraciones

Ocho archivos en `supabase/migrations/`, en orden estricto:

| # | Archivo | Qué hace |
| --- | --- | --- |
| 1 | `202608270001_initial_schema.sql` | Tablas, enums, índices, RLS, bucket privado, `record_access_decision` |
| 2 | `202608270002_public_token_api.sql` | `resolve_invitation`, `resolve_qr_token` |
| 3 | `202608270003_harden_visit_updates.sql` | Trigger que limita qué columnas puede cambiar cada rol |
| 4 | `202608270004_retention_job_guard.sql` | Bloquea la función SQL heredada de purga |
| 5 | `202608270005_partial_invitation_data.sql` | Datos que el anfitrión adelanta |
| 6 | `202609020006_platform_foundation.sql` | **La importante.** `token_hash`, alta de empresas, ventanas configurables, correcciones de RLS |
| 7 | `202609020007_whatsapp_channel.sql` | Canal `whatsapp` en la bitácora de envíos |
| 8 | `202609030008_lock_trigger_functions.sql` | Quita de la API las dos funciones de disparador |

### Opción A — CLI de Supabase (recomendada)

```bash
npx supabase link --project-ref <REF>
npx supabase db push
```

### Opción B — psql directo

```bash
for f in supabase/migrations/*.sql; do
  echo "== $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

### Opción C — MCP de Supabase

Usa `apply_migration` una por una, **en orden numérico**, con el nombre del
archivo como nombre de migración.

> **Detalle que ya se corrigió, pero conviene que sepas:** las migraciones 2 y 5
> usaban `digest()` de pgcrypto dentro de funciones declaradas con
> `search_path = ''`. En Supabase pgcrypto vive en el esquema `extensions`, así
> que no se resolvía y la función habría fallado. Se sustituyó por
> `encode(sha256(convert_to(p_token,'UTF8')),'hex')`, ambos built-ins de
> `pg_catalog`. **Si el push falla en la migración 2 con
> `function digest(text, unknown) does not exist`, tienes una copia vieja del
> repositorio.**

### Seed (solo en entornos de demostración)

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Crea cinco usuarios ficticios con contraseña `NexaDemo2026!`. **Nunca en
producción.**

---

## 4. Paso 2 — Configuración del panel de Supabase

Tres cosas que no viven en el código.

### 4.1 SMTP propio (crítico)

**Sin esto, quien se registre en `/signup` nunca recibirá el correo de
confirmación y no podrá entrar.** El SMTP integrado de Supabase está limitado a
unos pocos mensajes por hora y solo entrega a miembros del propio equipo.

Panel → **Authentication → Emails → SMTP Settings** → «Enable Custom SMTP»:

| Campo | Valor (usando Resend) |
| --- | --- |
| Host | `smtp.resend.com` |
| Puerto | `465` |
| Usuario | `resend` |
| Contraseña | la API key de Resend |
| Sender email | el mismo de `RESEND_FROM_EMAIL` |

### 4.2 URLs de Auth

Panel → **Authentication → URL Configuration**:

- Site URL: `https://<tu-dominio>` (o `http://localhost:3000` en local)
- Redirect URLs: `<origen>/auth/callback`

La ruta [`src/app/auth/callback/route.ts`](../src/app/auth/callback/route.ts)
solo acepta destinos internos, así que un `next` externo se ignora por diseño.

### 4.3 Registro habilitado

Panel → **Authentication → Providers → Email**: «Enable Sign Up» activo, o el
alta de empresas no funcionará. (`supabase/config.toml` ya lo trae para el
entorno local.)

---

## 5. Paso 3 — Verificaciones

Ejecuta todo con `psql "$SUPABASE_DB_URL"`. **Este es el corazón del traspaso.**

### 5.1 El hash coincide con el de la aplicación (máxima prioridad)

Los tokens se guardan hasheados. Si PostgreSQL y Node calculan distinto, **nadie
podrá usar su invitación ni su pase**: los tokens simplemente no se encontrarán.

```sql
select public.token_hash('abc') as hash;
```

Debe devolver exactamente:

```
ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
```

Es el mismo valor que fija la prueba unitaria en
[`src/lib/__tests__/security.test.ts`](../src/lib/__tests__/security.test.ts),
que a su vez espeja `createHash("sha256")` de Node.

**Si esto falla, detente.** Nada más importa hasta arreglarlo.

### 5.2 Las funciones con `search_path` vacío se ejecutan

Esta es la prueba del problema descrito arriba. Un token inexistente debe
devolver **cero filas sin error**, no una excepción:

```sql
select count(*) from public.resolve_invitation('token-que-no-existe');
-- esperado: 0

select count(*) from public.resolve_qr_token('token-que-no-existe');
-- esperado: 0
```

Un `ERROR: function digest(text, unknown) does not exist` significa que quedó
alguna versión antigua de las funciones.

### 5.3 Todas las funciones existen

```sql
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'token_hash','create_organization','resolve_invitation','resolve_qr_token',
    'record_access_decision','expire_stale_visits','handle_new_user',
    'is_member','has_role','can_access_visit','purge_expired_documents',
    'enforce_visit_update_permissions','slugify','unaccent_fallback'
  )
order by proname;
```

Deben aparecer las 14.

### 5.4 RLS activo en todas las tablas operativas

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
```

**Toda** fila debe traer `relrowsecurity = t`. Una tabla en `f` es una fuga de
datos entre empresas.

### 5.5 El bucket es privado

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'visitor-documents';
```

Esperado: `public = f`, límite `8388608`, y los tres tipos de imagen. Si
`public = t`, **las identificaciones serían accesibles por URL directa**.

### 5.6 Aislamiento entre empresas (la prueba que de verdad importa)

Crea dos organizaciones con datos y comprueba que no se ven entre sí. Sustituye
los UUID por los reales de tu entorno:

```sql
-- Suplanta a un anfitrión de la organización A
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<UUID_ANFITRION_A>', 'role', 'authenticated')::text,
  true);
set local role authenticated;

select count(*) as visitas_visibles from public.visits;
-- esperado: SOLO las visitas de A donde host_id = ese anfitrión

select count(*) as visitantes_visibles from public.visitors;
-- esperado: solo los visitantes ligados a SUS visitas, no todo el padrón

rollback;
```

Repite con un guardia de A (debe ver todas las visitas de A, ninguna de B) y con
un administrador de B (nada de A).

> **Contexto:** la política `visitors_staff_write` original concedía `FOR ALL`
> con `USING` a los anfitriones, lo que también les daba **lectura de todo el
> padrón de visitantes** de la empresa. La migración 6 la separó en
> `visitors_staff_insert` y `visitors_staff_update`. Esta consulta comprueba que
> la corrección funciona.

### 5.7 El trigger de columnas por rol

Un guardia solo puede mover el estado de la visita, nada más:

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','<UUID_GUARDIA>','role','authenticated')::text, true);
set local role authenticated;

-- Debe FALLAR con 'Actualización no permitida para guardia'
update public.visits set purpose = 'alterado' where id = '<UUID_VISITA_DE_SU_ORG>';

rollback;
```

### 5.8 La decisión de acceso es atómica y respeta roles

```sql
-- Con un anfitrión (no debe poder): espera 'Acceso denegado'
select public.record_access_decision('<UUID_VISITA>', 'check_in');
```

Con un guardia de la misma organización, dentro de la ventana horaria, debe
devolver la fila de la visita ya en `checked_in`, y haber escrito en
`access_events` y en `audit_logs`.

### 5.9 Ventanas configurables

Confirma que la tolerancia sale de la configuración y no de constantes:

```sql
update public.organization_settings
set early_entry_minutes = 120 where organization_id = '<UUID_ORG>';
```

Después, un check-in dos horas antes de la hora debe pasar sin marcar
`p_allow_outside_window`.

---

## 6. Paso 4 — Prueba de extremo a extremo

Con `.env.local` puesto:

```bash
npm install
npm run setup:ocr     # opcional; solo si vas a probar la lectura real
npm run dev
```

Recorrido completo, **idealmente desde un teléfono real** (la cámara exige HTTPS
y permiso; en local usa el mismo equipo o un túnel):

1. `/signup` → crear cuenta → confirmar por correo → `/onboarding` → crear la empresa.
   - Verifica en la base: fila en `organizations`, `organization_members` con rol
     `admin`, `organization_settings` y una `locations`.
2. `/app/visits/new` → crear invitación → copiar el enlace.
3. Abrir el enlace en el teléfono → registrar datos → fotografiar **las dos caras**
   de la credencial → aceptar el aviso → recibir el pase QR.
   - Verifica: dos filas en `visitor_documents` (`identity_front`,
     `identity_back`), objetos en el bucket bajo `<org_id>/<visit_id>/`, y una
     fila en `qr_tokens`.
4. `/guard/scan` con una cuenta de guardia → escanear el QR → autorizar entrada.
   - Verifica: `visits.status = 'checked_in'`, evento en `access_events`,
     entrada en `audit_logs`, y que el anfitrión recibió el correo de llegada.
5. Escanear otra vez → registrar salida.
   - Verifica: `checked_out_at`, y que `qr_tokens.revoked_at` quedó puesto.
6. `/app/dashboard` → el cronómetro de estancia y las métricas cuadran.

### Retención

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/purge-documents
```

Debe responder `{"purged":0,...}` sin error. Para probarlo de verdad, adelanta
`retention_expires_at` de un documento y vuelve a llamarlo: el objeto debe
desaparecer **del bucket** antes de que la fila se marque.

---

## 7. Qué puede salir mal

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `function digest(text, unknown) does not exist` | Copia vieja del repo | Repositorio actualizado; migraciones 2 y 5 ya usan `sha256()` |
| `token_hash('abc')` no coincide | Función distinta a la esperada | Reaplicar la migración 6 |
| Invitaciones y pases «no existen» al abrirlos | Hash desalineado entre Node y PostgreSQL | Sección 5.1 |
| Nadie confirma su registro | Falta SMTP propio | Sección 4.1 |
| `Database error querying schema` al iniciar sesión | Usuario insertado a mano con `confirmation_token`, `recovery_token` y las demás columnas de token en `NULL`; Auth las lee como texto | Ponerlas en cadena vacía. El `seed.sql` ya lo hace |
| `/onboarding` da 500 | `create_organization` no existe, o falta la política `organizations_insert` | Reaplicar migración 6 |
| El anfitrión ve visitantes ajenos | Quedó la política `visitors_staff_write` vieja | Reaplicar migración 6 |
| El guardia no ve la identificación | Es el comportamiento por defecto | Activarlo en Configuración (`allow_document_preview_for_guards`) |
| La cámara no abre | Falta HTTPS | Dominio real o túnel |
| El OCR no lee nada | Falta `npm run setup:ocr` | Ejecutarlo; hay respaldo manual siempre |
| Bucle de redirección | No debería ocurrir | `roleHome` en `src/lib/config.ts` lo impide por construcción; si pasa, es un bug nuevo |

### No hagas esto

- `supabase db reset --linked` contra un proyecto con datos: **es destructivo**.
- Ejecutar `supabase/seed.sql` en producción: crea usuarios con contraseña conocida.
- Poner la `service_role` key con prefijo `NEXT_PUBLIC_`: quedaría en el navegador.
- Llamar a `public.purge_expired_documents()`: está bloqueada a propósito
  (migración 4) porque marcaba filas sin borrar los archivos. Usa el endpoint
  del cron.

---

## 8. Criterios de aceptación

Antes de decir «conectado», todo esto debe cumplirse:

- [x] Las ocho migraciones aplicadas sin error.
- [x] `public.token_hash('abc')` da el hash esperado (5.1).
- [x] `resolve_invitation` y `resolve_qr_token` devuelven cero filas sin excepción (5.2).
- [x] Las 14 funciones existen (5.3).
- [x] RLS activo en todas las tablas (5.4).
- [x] Bucket privado con límite y allowlist (5.5).
- [x] Un anfitrión de A no ve nada de B, ni el padrón completo de visitantes (5.6).
- [x] Un guardia no puede alterar columnas que no le tocan (5.7).
- [x] Un anfitrión no puede registrar entradas (5.8).
- [x] La ventana de entrada sale de la configuración, no de constantes (5.9).
- [ ] SMTP propio configurado y un registro real confirmado por correo (4.1).
- [ ] Recorrido completo con un teléfono real (sección 6).
- [ ] El cron de retención borra el objeto antes de marcar la fila.

Sobre el asesor de seguridad del panel: quedan once avisos
`*_security_definer_function_executable`, y son esperados. Cuatro señalan
funciones concedidas a propósito (`resolve_invitation` a `anon`;
`resolve_qr_token`, `record_access_decision` y `create_organization` a
`authenticated`), todas con su propia validación de rol dentro. Los otros siete
señalan `is_member`, `has_role` y `can_access_visit`, que **no se pueden
revocar**: las políticas RLS se evalúan con los privilegios de quien consulta y
sin `EXECUTE` toda lectura falla con `permission denied for function`
(comprobado). Si aparece un aviso distinto a estos, revísalo.

Cuando se cumplan, actualiza [`docs/LIMITATIONS.md`](LIMITATIONS.md): la sección
«No verificado aquí» debe reflejar la realidad nueva. **No la borres, corrígela.**

---

## 9. Mapa del código

Solo lo que tocarías al depurar la conexión.

| Ruta | Para qué |
| --- | --- |
| [`src/lib/config.ts`](../src/lib/config.ts) | Decide vitrina o modo real. Rutas de inicio por rol. |
| [`src/lib/server/session.ts`](../src/lib/server/session.ts) | Sesión, membresías y guardas de portal y API |
| [`src/lib/server/supabase.ts`](../src/lib/server/supabase.ts) | Cliente de servidor con cookies |
| [`src/lib/server/supabase-admin.ts`](../src/lib/server/supabase-admin.ts) | Cliente con `service_role` (solo servidor) |
| [`src/lib/server/visit-mapper.ts`](../src/lib/server/visit-mapper.ts) | Único lugar donde PostgREST se traduce al dominio |
| [`src/lib/domain.ts`](../src/lib/domain.ts) | Contrato compartido servidor/cliente |
| [`src/lib/visit-service.ts`](../src/lib/visit-service.ts) | Espejo en TypeScript de `record_access_decision` |
| [`src/proxy.ts`](../src/proxy.ts) | Refresco de sesión y guardas optimistas |
| `src/app/api/` | Route handlers; cada uno valida rol antes de tocar datos |

### Detalles de diseño que conviene no romper

1. **Los tokens nunca se guardan en claro**, solo su SHA-256. Por eso «reenviar
   enlace» genera uno nuevo e invalida el anterior: es imposible recuperar el
   original.
2. **`visit-service.ts` y `record_access_decision` son espejos.** Si cambias las
   reglas de acceso, cámbialas en ambos o la vitrina mentirá.
3. **La autoridad es RLS, no la API.** Las comprobaciones de rol en los route
   handlers son una segunda capa, no la principal.
4. **`resolve_qr_token` valida la organización dentro de la función**, no solo en
   la ruta, porque cualquier usuario autenticado puede llamar la RPC vía
   PostgREST.

---

## 10. Después de la base de datos

Ninguna es obligatoria; los pasos están en
[`docs/INTEGRACIONES.md`](INTEGRACIONES.md).

| Integración | Estado |
| --- | --- |
| OCR real de la banda MRZ | Código listo y probado contra la norma ICAO 9303. **Nunca ejecutado contra una credencial real** — pruébalo en un teléfono antes de anunciarlo. |
| Apple Wallet | Código completo; faltan certificados (Developer Program, 99 USD/año) |
| Google Wallet | Código completo; falta cuenta de servicio e issuer ID |
| WhatsApp | Código completo; falta cuenta de Meta y plantilla aprobada |
| PWA instalable | Ya funciona; requiere HTTPS |
| Notificaciones push | **No implementado** |
| Rate limit distribuido | **No implementado** — hoy es en memoria, por instancia |

---

## 11. Resumen para quien tenga prisa

1. `.env.local` con las cuatro variables (sección 2).
2. `npx supabase link` + `npx supabase db push`.
3. `select public.token_hash('abc');` → debe dar `ba7816bf…15ad`.
4. `select count(*) from public.resolve_invitation('x');` → 0 filas, **sin error**.
5. Configurar SMTP propio en el panel, o nadie confirma su cuenta.
6. Recorrer el flujo completo desde un teléfono.
7. Corregir `docs/LIMITATIONS.md` con lo que hayas comprobado.
