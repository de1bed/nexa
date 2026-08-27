# Checklist de producción

## Legal y privacidad

- [ ] Aviso revisado legalmente por jurisdicción.
- [ ] Base legal, finalidad y retención documentadas.
- [ ] DPIA y procedimiento ARCO/eliminación completados.
- [ ] DPA con proveedores.

## Seguridad

- [ ] Migraciones y pruebas RLS ejecutadas en CI.
- [ ] Pentest y modelado de amenazas.
- [ ] Rate limiter distribuido.
- [ ] Secretos rotados y MFA para administradores.
- [ ] CSP, HSTS, `frame-ancestors`, `nosniff` y Referrer-Policy.
- [ ] Logs sin PII/tokens, backups y restauración probados.

## Datos y operación

- [ ] Job elimina registro y objeto físico al vencer retención.
- [ ] Política de miniaturas aprobada.
- [ ] Runbook para QR inválido, offline y registro manual.
- [ ] Seed y cuentas demo deshabilitados.

## Calidad

- [ ] Lint, typecheck, unitarias, E2E y build pasan en CI.
- [ ] Safari iOS, Chrome Android y desktop reales.
- [ ] Cámara, permisos denegados y offline en dispositivo.
- [ ] Auditoría WCAG 2.2 AA y prueba de carga.
- [ ] Concurrencia real confirma prevención de duplicados.

## Despliegue

- [ ] Variables separadas por ambiente.
- [ ] HTTPS, Auth redirects y Resend verificados.
- [ ] Migraciones aplicadas antes del tráfico.
- [ ] Rollback documentado y monitoreo post-deploy asignado.
