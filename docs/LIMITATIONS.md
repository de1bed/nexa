# Limitaciones honestas

Estado al cierre de esta iteración. Lo que sigue está verificado o pendiente de
verificar, sin adornos.

## Verificado en esta máquina

- `npm run lint`, `npm run typecheck`, `npm test` (55 unitarias) y `npm run build` pasan.
- `npm run test:e2e`: 14 pruebas en verde, en Chromium de escritorio y en Pixel 7,
  recorriendo anfitrión → visitante → guardia → administración.
- El **lector de MRZ** está validado contra el ejemplo canónico de la norma
  ICAO 9303: campos, dígitos de control, fechas y detección de vencimiento.
- El recorrido completo se probó en **modo vitrina**, que es el que corre sin
  credenciales.

## No verificado aquí

Nada de esto está roto que se sepa; simplemente no se ha podido ejercer.

- **Las migraciones no se ejecutaron contra PostgreSQL.** Esta máquina no tiene
  Docker. Antes de operar hay que correr `npx supabase db reset` en CI o en un
  equipo con Docker y revisar que las funciones se creen sin error.
- **El adaptador productivo no se ejerció extremo a extremo.** Rutas de API, RLS
  y políticas de Storage están escritas y tipadas, pero no se han ejecutado
  contra una base real.
- **El OCR con Tesseract nunca se ha ejecutado contra una credencial real.** El
  motor se descarga y se configura correctamente, y el lector de la banda está
  probado, pero la calidad del reconocimiento sobre fotos reales solo se puede
  medir con credenciales de verdad. Es lo primero que hay que probar en un
  teléfono antes de anunciar la función.
- **Los pases de cartera nunca se han generado de verdad.** Falta el certificado
  de Apple y el emisor de Google. El código está completo y los botones aparecen
  solos cuando existan las credenciales.
- **WhatsApp no ha enviado un mensaje real.** Falta la cuenta de Meta y la
  plantilla aprobada.
- Resend no se probó con dominio verificado; sin `RESEND_API_KEY` los enlaces se
  registran en consola.

## Limitaciones de diseño

- El modo vitrina usa `localStorage`: **no ofrece aislamiento de seguridad** y es
  solo para evaluación.
- El rate limit es en memoria y por instancia. En serverless con varias
  instancias hay que sustituirlo por Postgres o KV.
- El cron de retención procesa 500 documentos por ejecución; con acumulación
  previa hay que ejecutarlo varias veces (la respuesta incluye `remaining`).
- **El OCR no valida identidad.** Extrae texto y comprueba los dígitos de control
  de la banda. Que la lectura esté «verificada» significa que se leyó bien, no
  que la credencial sea auténtica ni que pertenezca a quien la presenta.
- Solo las credenciales para votar recientes traen banda MRZ. Con documentos sin
  banda —credenciales antiguas, gafetes corporativos, algunos pasaportes— no hay
  nada que leer y el visitante escribe sus datos.
- La cámara exige HTTPS y permiso del usuario; siempre hay respaldo por galería
  y por código manual.
- Las notificaciones push no están implementadas: el aviso de llegada al
  anfitrión es por correo.
- Cambiar el plazo de retención no reetiqueta los documentos ya almacenados:
  conservan la fecha con la que se subieron.
- El rol `superadmin` existe en el esquema y en los permisos, pero no tiene una
  superficie propia de soporte multiempresa.
- Los botones de cartera usan un diseño genérico. Apple y Google exigen sus
  insignias oficiales antes de publicar (ver `docs/INTEGRACIONES.md`).
- No se ha hecho pentest, revisión legal, DPIA, auditoría formal WCAG AA ni
  prueba de carga.

## Cómo cerrar estas brechas

El guion completo, con el SQL de verificación y el resultado que debe dar cada
consulta, está en [HANDOFF-SUPABASE.md](HANDOFF-SUPABASE.md).

## Antes de operar con datos reales

1. Ejecutar las migraciones y probar RLS con dos organizaciones.
2. Configurar SMTP propio en Supabase, o **nadie podrá confirmar su cuenta**.
3. Probar el OCR con credenciales reales en un teléfono, no en el escritorio.
4. Hacer que el área legal revise el aviso de privacidad, que es editable desde
   Configuración.
