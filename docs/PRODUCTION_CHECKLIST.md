# Checklist de producción

## 1. Base de datos (bloqueante)

- [ ] `npx supabase db reset` en una máquina con Docker o en CI: las migraciones deben aplicarse sin error.
- [ ] Verificar que existen y funcionan `token_hash`, `create_organization`, `resolve_invitation`, `resolve_qr_token`, `record_access_decision` y `expire_stale_visits`.
- [ ] Probar RLS con dos organizaciones: un anfitrión de A no debe ver ninguna visita ni visitante de B.
- [ ] Confirmar que un anfitrión solo ve sus propias visitas dentro de su organización.
- [ ] Confirmar que el bucket `visitor-documents` es privado y que un guardia solo ve documentos si la organización lo habilitó.

## 2. Despliegue

- [ ] Variables por ambiente; `SUPABASE_SERVICE_ROLE_KEY` nunca con prefijo `NEXT_PUBLIC_`.
- [ ] `NEXT_PUBLIC_APP_URL` con HTTPS y dominio real (los enlaces de invitación y pase se construyen con él).
- [ ] Auth: URL del sitio y redirecciones (`/auth/callback`) configuradas.
- [ ] Resend con dominio verificado y `RESEND_FROM_EMAIL` correcto.
- [ ] `CRON_SECRET` aleatorio; verificar que el cron diario responde 200 y no 401.
- [ ] Migraciones aplicadas **antes** de dirigir tráfico.
- [ ] Rollback documentado y responsable asignado para el post-despliegue.

## 3. Seguridad

- [ ] Pentest y modelado de amenazas.
- [ ] Rate limiter distribuido (Postgres o KV) en lugar del contador en memoria.
- [ ] MFA para las cuentas de administración; secretos rotados.
- [ ] Endurecer la CSP: quitar `unsafe-inline` y `unsafe-eval` de `script-src` usando nonce.
- [ ] HSTS activo; verificar `frame-ancestors`, `nosniff` y `Referrer-Policy` en producción.
- [ ] Logs sin PII ni tokens; backups y restauración probados.

## 4. Legal y privacidad

- [ ] Aviso de privacidad redactado y aprobado por el área legal de cada empresa (se edita en Configuración).
- [ ] Base legal, finalidad y plazo de retención documentados.
- [ ] DPIA y procedimiento de derechos ARCO / eliminación.
- [ ] DPA firmado con Supabase y con el proveedor de correo.
- [ ] Plazo de retención revisado por jurisdicción antes de recibir al primer visitante.

## 5. Operación

- [ ] Runbook para: QR inválido, teléfono sin cámara, sin conexión en caseta y visitante sin invitación.
- [ ] Seed y datos demostrativos deshabilitados en el ambiente productivo.
- [ ] Confirmar que el cron de retención borra el objeto físico y no solo la fila.
- [ ] Definir quién revisa la bitácora de accesos y con qué frecuencia.

## 6. Calidad

- [ ] Lint, typecheck, unitarias, E2E y build en CI.
- [ ] Probar en Safari iOS y Chrome Android reales: cámara, permiso denegado, sin conexión y áreas seguras.
- [ ] Concurrencia real: dos guardias escaneando el mismo pase a la vez no deben duplicar la entrada.
- [ ] Auditoría WCAG 2.2 AA y prueba de carga.
