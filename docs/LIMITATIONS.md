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

## Verificado contra Supabase

Proyecto `ogrdzqrvbrpgbtkmhuus`, el 3 de septiembre de 2026. Las ocho migraciones
se aplicaron en orden y sin error, y se comprobó con SQL:

- `public.token_hash('abc')` devuelve el mismo hash que fija la prueba unitaria,
  de modo que los tokens hasheados sí se encuentran.
- Las catorce funciones existen, y las que declaran `search_path` vacío se
  ejecutan sin excepción.
- RLS activo en las trece tablas, y el bucket es privado con su límite de tamaño
  y su lista de tipos permitidos.
- Con dos empresas y datos propios: un anfitrión ve solo su visita y solo el
  visitante ligado a ella —no el padrón—, un guardia ve toda su empresa y nada de
  la otra, y una administradora de la segunda no ve nada de la primera.
- El guardia no puede alterar columnas que no le corresponden, el anfitrión no
  puede registrar entradas, y la tolerancia de entrada sale de la configuración
  de la organización y no de constantes.
- Un token de invitación real se resolvió como visitante anónimo.
- Con credenciales puestas, la aplicación exige autenticación: el panel y el
  portal del guardia redirigen a `/login` y la API responde 401.
- El registro está habilitado en Auth. La aplicación ya no usa contraseñas: pide
  un código de seis dígitos por correo, así que el SMTP propio es el primer
  bloqueo real.
- Una sesión real de Auth devuelve un perfil creado por el trigger, con el nombre
  que viajó en el registro. Se comprobó con el flujo de contraseña, que era el
  que existía en ese momento.
- Alta de empresa desde una sesión real: `create_organization` dejó la
  organización, la membresía de administradora, la sede, la configuración con su
  aviso de privacidad y la entrada en la bitácora.
- Los correos de la aplicación se entregan de verdad. Se ejecutó el adaptador de
  `src/lib/server/email.ts` con la llave real y Resend reporta la invitación de
  equipo como `delivered` en una bandeja de Gmail. El dominio `vortexlabai.com`
  está verificado con DKIM, SPF y MX de rebotes.
- **El acceso por código funciona de punta a punta.** Con el SMTP de Resend y las
  plantillas ya aplicadas en el proyecto, se probaron las dos ramas:
  - Quien ya tiene cuenta: se pidió el código, llegó por Resend desde
    `visitas@vortexlabai.com` con estado `delivered`, el cuerpo trae seis dígitos
    y ningún enlace, y canjearlo devolvió una sesión válida de una hora.
  - Quien se registra: el alta usó la plantilla «Confirm signup», el código llegó
    igual, y al canjearlo quedó la sesión abierta con el nombre en los metadatos y
    el correo confirmado en el mismo acto. El usuario de prueba se borró.
  - El largo del código estaba en 8 en el proyecto y se corrigió a 6, que es lo
    que valida la interfaz.
  - El límite de correos por hora estaba en 2, el valor que trae Supabase cuando
    presta su propio remitente. Se subió a 30, porque con dos por hora la tercera
    persona de un turno recibe `over_email_send_rate_limit` y se queda fuera. El
    techo real sigue siendo el plan gratuito de Resend: 100 al día.
  - El logotipo del correo es un recuadro de color con un carácter de visto bueno,
    no el escudo de la marca. Los clientes de correo exigen una imagen alojada en
    una URL pública y la aplicación aún no está desplegada; cuando lo esté,
    `/icon` ya genera ese PNG y conviene cambiarlo.

Los datos de prueba se borraron: el proyecto quedó vacío.

## No verificado aquí

Nada de esto está roto que se sepa; simplemente no se ha podido ejercer.

- **Nadie ha recorrido la aplicación de extremo a extremo por la interfaz.**
  Sesión, alta de empresa y resolución de tokens se ejercieron contra el proyecto
  real, pero por la API de Supabase, no pulsando botones. El recorrido de
  invitación, captura de identificación, pase y escaneo sigue sin hacerse en
  pantalla, y el primer bloqueo es el SMTP propio: sin él no llega el código y
  por tanto nadie entra al panel.
- **Nadie ha entrado por la pantalla, aunque el mecanismo ya funciona.** Las dos
  ramas del acceso se ejercieron completas contra el proyecto real por API, no
  pulsando botones: pedir código, recibirlo, canjearlo y obtener sesión. Lo que
  falta es teclear los seis dígitos en el campo del teléfono, con su autorrelleno
  y su validación al sexto dígito.
- **Las políticas de Storage no se han ejercido con un archivo real.** El bucket
  existe y es privado, y las políticas están escritas y revisadas, pero no se ha
  subido ninguna identificación.
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

1. Configurar SMTP propio en Supabase, o **nadie podrá confirmar su cuenta**.
2. Completar el recorrido por la interfaz contra la base real, incluida la subida
   de una identificación al bucket.
3. Probar el OCR con credenciales reales en un teléfono, no en el escritorio.
4. Hacer que el área legal revise el aviso de privacidad, que es editable desde
   Configuración.
