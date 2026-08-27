# Limitaciones honestas

- Este host no tiene Docker; las migraciones no se ejecutaron aquí contra Supabase local. Deben validarse con `npx supabase db reset` en CI o una máquina con Docker.
- El modo demo usa `localStorage` y no ofrece aislamiento de seguridad; es solo para evaluación local.
- Sin credenciales no fue posible ejecutar el adaptador productivo extremo a extremo; las vistas administrativas, públicas y de guardia ya consumen sus endpoints Supabase cuando `NEXT_PUBLIC_DEMO_MODE=false`.
- El rate limit en memoria es por instancia; serverless requiere PostgreSQL/KV distribuido.
- El cron de Vercel elimina los objetos físicos y después marca los registros; su ejecución real requiere `CRON_SECRET` y un proyecto Supabase/Vercel configurado.
- Tesseract depende de imagen e iluminación; no valida identidad.
- SMS, push y reintentos con cola no están implementados.
- La cámara requiere HTTPS y permiso; se ofrece token manual.
- Superadmin no aparece en navegación cotidiana, por diseño; soporte global requiere superficie separada.
- No se realizó pentest, revisión legal, DPIA, auditoría formal AA ni carga.
