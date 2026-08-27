# NEXA VISIT

MVP empresarial multiempresa para preregistro, identificación, pases QR, entrada y salida de visitantes. La interfaz está en español, es responsive y separa los portales de administración, guardia y visitante.

> Este repositorio es un MVP. El aviso de privacidad, la retención y los procedimientos deben ser revisados por especialistas legales y de seguridad antes de producción.

## Incluye

- Dashboard con métricas derivadas del estado, gráfica semanal y actividad.
- Invitaciones con enlace aleatorio, Resend y adaptador de desarrollo.
- Mini app pública: captura comprimida, OCR intercambiable, revisión, consentimiento y QR.
- QR con token aleatorio, sin información personal en texto plano.
- Portal mobile-first para cámara, token manual, aprobación, rechazo y check-out.
- Registro manual, búsqueda, personas dentro y exportación CSV segura.
- Reportes por rango, impresión, motivos, anfitriones y duración.
- PostgreSQL multiempresa, RLS, Storage privado, auditoría y retención.
- Seed con 25 visitas y cinco usuarios demostrativos.
- Vitest y Playwright en escritorio y móvil.
- Modo demo persistente en `localStorage` para ejecutar sin credenciales.

## Requisitos

- Node.js 20.9+ y npm 10+.
- Para Supabase local: Docker Desktop.
- Para E2E: `npx playwright install chromium`.

## Inicio rápido sin servicios externos

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). `.env.example` activa el modo demo, por lo que el recorrido funciona sin Supabase ni Resend.

Rutas útiles:

- Administración: [http://localhost:3000/app/dashboard](http://localhost:3000/app/dashboard)
- Guardia: [http://localhost:3000/guard/scan](http://localhost:3000/guard/scan)
- Visitante: [http://localhost:3000/visit/nexa-demo-invitation-2026](http://localhost:3000/visit/nexa-demo-invitation-2026)
- Token QR: `nexa-demo-pass-2026`

## Credenciales demo

Contraseña común: `NexaDemo2026!`

| Rol | Correo |
| --- | --- |
| Administradora | `admin@novalogistics.demo` |
| Anfitrión | `mateo@novalogistics.demo` |
| Anfitriona | `valeria@novalogistics.demo` |
| Guardia | `guardia1@novalogistics.demo` |
| Guardia | `guardia2@novalogistics.demo` |

Son datos ficticios; nunca deben reutilizarse en producción.

## Supabase local

Con Docker Desktop activo:

```bash
npx supabase start
npx supabase db reset
```

Se aplican las migraciones de `supabase/migrations` y `supabase/seed.sql`. Copia la URL, anon key y service-role key de `supabase status` a `.env.local`. Usa `NEXT_PUBLIC_DEMO_MODE=false` para Auth real. Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` con el prefijo `NEXT_PUBLIC_`.

El bucket `visitor-documents` es privado. Las rutas comienzan con `organization_id`, las lecturas dependen de RLS y cualquier vista debe usar URL firmada temporal.

### Supabase cloud

1. Crea el proyecto y ejecuta `npx supabase link --project-ref <ref>`.
2. Publica con `npx supabase db push`.
3. Ejecuta el seed solo en ambientes demo; `db reset --linked` es destructivo.
4. Configura dominios y redirecciones de Auth.
5. Define `CRON_SECRET`. `vercel.json` ejecuta diariamente `/api/cron/purge-documents`; el worker elimina primero el objeto del bucket privado y solo entonces marca el registro y escribe auditoría. No programes la función SQL heredada: la migración `202608270004` la bloquea para evitar archivos huérfanos.

## Resend

Verifica un dominio y define `RESEND_API_KEY` y `RESEND_FROM_EMAIL`. Sin API key, `src/lib/server/email.ts` registra el destinatario y el enlace en consola. El correo usa los datos reales de la invitación.

## OCR

`OCRProvider` vive en `src/lib/ocr/types.ts`. Hay un proveedor mock reproducible y otro Tesseract local. La imagen se comprime a 1800 px antes del procesamiento. La UI marca baja confianza y permite corregir o capturar manualmente. OCR significa extracción de texto, no autenticidad ni reconocimiento facial.

## Seguridad

- `organization_id` y RLS en todas las tablas operativas.
- Roles aplicados en SQL y UI.
- Invitaciones y QR persistidos como SHA-256, no texto plano.
- `record_access_decision` bloquea la fila y evita duplicados.
- Bucket privado, 8 MiB máximo y allowlist JPG/PNG/WebP.
- Service role exclusiva de servidor.
- Consentimiento explícito y versión del aviso.
- Identificación enmascarada en datos operativos.
- Rate limiting local; en Vercel debe sustituirse por un contador distribuido.
- Errores públicos genéricos y CSV protegido contra fórmulas.
- IP no persistida: el MVP no demuestra una finalidad proporcional.

## Pruebas

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm run check` ejecuta lint, TypeScript, unitarias y build. Las unitarias cubren aislamiento, roles, invitaciones, expiración, OCR, hashing, QR revocado, check-in, duplicados, check-out, manual, CSV y retención. El E2E recorre anfitrión → visitante → QR → guardia → reportes en escritorio y móvil.

## Vercel

1. Importa el repositorio y usa Node 20 con `npm run build`.
2. Configura `.env.example`, `NEXT_PUBLIC_APP_URL` HTTPS y `NEXT_PUBLIC_DEMO_MODE=false`.
3. Configura el dominio en Supabase Auth y Resend.
4. Aplica migraciones antes de publicar.
5. Genera un `CRON_SECRET` aleatorio; Vercel lo envía como Bearer al cron de retención.
6. Prueba login, carga privada, invitación, QR, cámara, entrada y salida en Preview.
7. Activa logs con redacción, alertas y backups.

## Arquitectura

- Next.js App Router y Route Handlers.
- Server Components por defecto; cliente solo para cámara, formularios, charts y demo.
- Supabase PostgreSQL/Auth/Storage como fuente productiva.
- Adaptadores en `src/lib/server` y `src/lib/ocr`.
- RLS como frontera autoritativa.
- Acceso atómico mediante funciones PostgreSQL.
- Demo local como adaptador de evaluación, no sustituto productivo.

Consulta [decisiones](docs/DECISIONS.md), [limitaciones](docs/LIMITATIONS.md) y [checklist](docs/PRODUCTION_CHECKLIST.md).

## Capturas

![Dashboard administrativo](docs/screenshots/dashboard-desktop.png)

![Flujo móvil del visitante](docs/screenshots/visitor-mobile.png)

![Portal móvil del guardia](docs/screenshots/guard-mobile.png)

## Estructura

```text
src/app/                 rutas Next.js y API
src/components/          administración, visitante y guardia
src/lib/                 dominio, seguridad, OCR y adaptadores
supabase/migrations/     esquema, funciones y RLS
supabase/seed.sql        datos demo reproducibles
tests/e2e/               recorrido Playwright
docs/                    decisiones, limitaciones, checklist y capturas
```
