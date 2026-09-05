# Integraciones

Todo lo que hay que conectar además de Supabase, en orden de importancia. Cada
sección dice qué pasa **si no** la configuras: ninguna es obligatoria para que la
plataforma funcione, pero la primera sí lo es para que las empresas puedan
registrarse.

---

## 1. Correo (crítico)

El correo dejó de ser un accesorio: **la autenticación es un código de seis
dígitos que llega por correo**. No hay contraseñas ni enlaces que abrir. Si el
correo no sale, nadie entra.

Hay **dos** sistemas de correo distintos y es fácil pasar uno por alto: los
mensajes de la aplicación (Resend, desde el servidor) y los de la cuenta
(Supabase Auth). Los dos se resuelven con la misma cuenta de Resend.

### 1.1 Resend

El plan gratuito de Resend cubre **3.000 correos al mes con un tope de 100 al
día**. El tope diario es el que aprieta primero, porque cada inicio de sesión
gasta uno y cada invitación a visitante otro.

Resend solo entrega a terceros desde un dominio verificado: con
`onboarding@resend.dev` únicamente puedes escribirte a ti mismo, así que las
invitaciones a visitantes no llegarían.

**En este proyecto el dominio `vortexlabai.com` ya está verificado** —DKIM en
`resend._domainkey`, SPF y MX de rebotes en `send`, los tres en verde— así que no
hay nada que hacer en el DNS. Solo la llave:

```bash
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL="NEXA VISIT <visitas@vortexlabai.com>"
```

Conviene que la llave tenga permiso de **solo envío** y esté restringida a ese
dominio: si se filtra, no sirve para leer ni administrar la cuenta.

Para un dominio nuevo el camino es **Domains → Add Domain**, y Resend dicta tres
registros que hay que copiar tal cual (la clave DKIM es única de cada cuenta).
Si el proveedor de DNS agrega el dominio por su cuenta al final del nombre
—Network Solutions y GoDaddy lo hacen— hay que escribir solo la parte izquierda,
`send` y `resend._domainkey`, o el registro queda duplicando el dominio y nunca
verifica.

**Si no lo configuras:** los correos de la aplicación no se envían; el
destinatario y el enlace se imprimen en la consola del servidor. El recorrido
sigue siendo demostrable porque el anfitrión puede compartir el enlace del pase
desde su teléfono.

### 1.2 Correos de cuenta — SMTP de Supabase

El código de acceso lo envía **Supabase Auth**, no la aplicación. El SMTP
integrado de Supabase no sirve para producción: entrega solo a miembros de tu
propio equipo y admite un par de mensajes por hora.

> Sin este paso **nadie puede iniciar sesión ni registrarse**, porque el código
> nunca llega.

**En este proyecto ya está aplicado y comprobado**: el código sale por Resend
desde `visitas@vortexlabai.com`. Los valores quedan aquí por si hay que
reconstruirlo o levantar otro proyecto.

En el panel de Supabase → **Authentication → Emails → SMTP Settings**, activa
«Enable Custom SMTP» con el mismo Resend:

| Campo | Valor |
| --- | --- |
| Host | `smtp.resend.com` |
| Puerto | `465` |
| Usuario | `resend` |
| Contraseña | tu `RESEND_API_KEY` |
| Sender email | `visitas@vortexlabai.com` |
| Sender name | `NEXA VISIT` |

### 1.3 Plantillas con el código, no con el enlace

Supabase envía un enlace mágico por omisión. Para que llegue el código hay que
poner `{{ .Token }}` en las plantillas de **Authentication → Emails →
Templates**. Son **dos**: «Magic Link» (quien ya tiene cuenta) y «Confirm
signup» (quien se registra por primera vez). Si solo cambias una, la mitad de
tus usuarios seguirá recibiendo un enlace.

El correo ya está escrito en
[`supabase/templates/access-code.html`](../supabase/templates/access-code.html):
copia ese archivo tal cual en las dos plantillas y pon como asunto «Tu código de
acceso a NEXA VISIT». Así se ve:

![Correo del código de acceso](screenshots/correo-codigo.png)

Lo que lo convierte en código es la variable `{{ .Token }}`; si aparece
`{{ .ConfirmationURL }}` en cualquier parte del cuerpo, incluso dentro de un
comentario de HTML, Supabase la sustituye por un enlace real. Por eso el archivo
es HTML limpio y la explicación vive aquí.

Dos cosas que cuestan una tarde si no se saben. La primera es que el motor de
plantillas acepta muy poco: `{{ .Token }}` sí, pero partir el código en seis
casillas con `{{ slice .Token 0 1 }}` no compila, y Supabase no avisa —guarda el
texto nuevo, responde 200 y sigue enviando la última plantilla que sí pudo
interpretar, así que parece que el cambio no se aplicó. La segunda es que el
logotipo es un recuadro de color con un carácter dentro, no una imagen: los
clientes de correo exigen una URL pública y bloquean `data:`, de modo que hasta
que la aplicación esté desplegada no hay dónde alojar un PNG. Cuando lo esté,
`https://nexavisit.vortexlabai.com/icon` ya sirve el escudo de la marca.

Un cambio de plantilla tarda alrededor de un minuto en surtir efecto, porque
Auth mantiene la anterior en memoria. Si pruebas de inmediato, verás la vieja.

En desarrollo local no hace falta copiar nada, porque `supabase/config.toml`
apunta al mismo archivo y los correos se leen en Inbucket
(`http://localhost:54324`).

Nada de esto tiene que hacerse a mano. La API de gestión configura el SMTP y las
dos plantillas de una sola vez, y sirve para revisar el estado sin abrir el
panel. Requiere un token personal de la cuenta, que conviene revocar al terminar
porque da acceso completo:

```bash
curl -H "Authorization: Bearer $SUPABASE_PAT" \
  https://api.supabase.com/v1/projects/<REF>/config/auth
```

El `PATCH` al mismo endpoint acepta `smtp_host`, `smtp_port` (cadena, no número),
`smtp_user`, `smtp_pass`, `smtp_admin_email`, `smtp_sender_name`,
`mailer_otp_length`, `mailer_otp_exp` y el contenido y asunto de cada plantilla en
`mailer_templates_magic_link_content`, `mailer_subjects_magic_link`,
`mailer_templates_confirmation_content` y `mailer_subjects_confirmation`.

Esto es lo que ve quien entra:

![Pantalla del código de acceso](screenshots/access-mobile.png)

El campo se valida solo al sexto dígito y usa `autocomplete="one-time-code"`, así
que en iOS y Android el código se rellena desde la notificación sin copiarlo a
mano.

En **Authentication → Sign In / Providers → Email** deja «Email OTP expiration»
en 3600 segundos (una hora) y el largo del código en 6 dígitos. La opción
«Confirm email» puede quedarse encendida: con el código, la confirmación y el
inicio de sesión son el mismo acto.

En **Authentication → URL Configuration** define el origen donde vive la
aplicación, que no tiene por qué ser el dominio del correo:

- Site URL: `https://nexavisit.vortexlabai.com`
- Redirect URLs: `https://nexavisit.vortexlabai.com/auth/callback`

Son dos cosas distintas y conviene no confundirlas: la aplicación se sirve desde
`nexavisit.vortexlabai.com` (un subdominio apuntado a Vercel) y el correo sale
desde `vortexlabai.com` (el dominio verificado en Resend).

Esas URL ya no se usan para entrar, pero sí para cualquier enlace que genere
Supabase desde el panel, por ejemplo un acceso de emergencia si el correo
fallara.

### 1.4 Límite de correos por hora

Este es el ajuste que deja un proyecto inservible sin que nadie lo note. En
**Authentication → Rate Limits**, «Emails sent per hour» viene en **2**, que es
lo razonable mientras Supabase presta su propio remitente y absurdo en cuanto
tienes SMTP propio: con dos correos por hora, la tercera persona del turno se
queda fuera. Ya está subido a **30 por hora** en este proyecto.

El techo verdadero lo pone Resend, que en su plan gratuito da 100 correos al
día; si el uso crece, ahí es donde hay que mirar primero. Al lado vive «minimum
interval between emails», en 60 segundos: es el mismo número que espera el botón
«Reenviar código» de la pantalla, y si cambias uno hay que cambiar el otro en
[`src/components/access-code.tsx`](../src/components/access-code.tsx).

---

## 2. Lectura de identificaciones (OCR)

La plataforma lee la **banda MRZ del reverso** de la credencial: los tres
renglones de letras y números en tipografía monoespaciada. A diferencia del
anverso, el MRZ trae dígitos de control, así que la lectura se puede **verificar**
en lugar de confiar en ella. Cuando los cuatro dígitos cuadran, la interfaz marca
«Lectura verificada».

Todo ocurre en el teléfono del visitante: la imagen no se envía a ningún
servicio de terceros para analizarla.

### Activarlo

```bash
npm run setup:ocr                    # copia el motor a public/tesseract (~54 MB)
NEXT_PUBLIC_OCR_PROVIDER=tesseract   # en .env.local
```

`npm run build` ejecuta ese script automáticamente (`prebuild`), así que en
Vercel no hay que hacer nada extra.

Los archivos se sirven **desde tu propio dominio** a propósito: por defecto
tesseract.js los descarga de un CDN externo, lo que chocaría con la política de
seguridad de contenido (`connect-src 'self'`) y sacaría tráfico de tu
infraestructura.

**Si no lo configuras:** se usa el proveedor reproducible, que devuelve una banda
de ejemplo bien formada. Útil para demostraciones y pruebas; en producción hay
que activar Tesseract o el visitante tendrá que escribir sus datos.

### Qué esperar, con honestidad

- El MRZ existe en las credenciales para votar recientes. Con credenciales
  antiguas, pasaportes de otros formatos o gafetes corporativos no habrá banda
  que leer: el visitante escribe sus datos y el flujo continúa igual.
- La precisión depende de la foto. Reflejos, sombras y encuadres torcidos bajan
  la lectura. Por eso todo campo es editable y la interfaz avisa cuando la
  lectura no quedó comprobada.
- **Esto no valida que la credencial sea auténtica.** Extrae texto. Si necesitas
  verificación de autenticidad o prueba de vida, hace falta un servicio
  especializado (Incode, Metamap, Truora, Veridas, AWS Textract AnalyzeID…), que
  cobra por verificación y **envía la identificación a un tercero**: eso exige
  firmar un DPA y actualizar el aviso de privacidad.

---

## 3. Carteras del teléfono

El visitante puede guardar su pase en Apple Wallet o Google Wallet. Los botones
solo aparecen si el servidor tiene las credenciales correspondientes.

### 3.1 Google Wallet (más sencillo, sin costo de licencia)

1. En Google Cloud, activa la **Google Wallet API**.
2. Crea una cuenta de servicio y descarga su llave JSON.
3. En la [consola de Google Pay & Wallet](https://pay.google.com/business/console)
   obtén tu **Issuer ID** y autoriza a la cuenta de servicio.
4. Configura:

   ```bash
   GOOGLE_WALLET_ISSUER_ID=3388000000022xxxxxx
   GOOGLE_WALLET_CLIENT_EMAIL=nexa-wallet@tu-proyecto.iam.gserviceaccount.com
   GOOGLE_WALLET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
   GOOGLE_WALLET_CLASS_SUFFIX=nexa_visit_pass
   ```

Los saltos de línea de la llave van escapados como `\n`.

### 3.2 Apple Wallet (requiere el Developer Program)

1. Inscríbete en el **Apple Developer Program** (99 USD al año).
2. En el portal de desarrollador crea un **Pass Type ID**
   (`pass.com.tuempresa.visita`) y genera su certificado.
3. Exporta el certificado y su llave privada a PEM, y descarga el certificado
   **WWDR** de Apple.
4. Conviértelos a base64 para que quepan en una variable de entorno:

   ```bash
   base64 -w0 signerCert.pem
   base64 -w0 signerKey.pem
   base64 -w0 wwdr.pem
   ```

5. Configura:

   ```bash
   APPLE_WALLET_TEAM_ID=ABCDE12345
   APPLE_WALLET_PASS_TYPE_ID=pass.com.tuempresa.visita
   APPLE_WALLET_ORG_NAME="Tu Empresa"
   APPLE_WALLET_CERT=<base64>
   APPLE_WALLET_KEY=<base64>
   APPLE_WALLET_KEY_PASSPHRASE=<si la llave la tiene>
   APPLE_WALLET_WWDR=<base64>
   ```

> **Pendiente de marca:** Apple y Google exigen usar sus insignias oficiales
> («Add to Apple Wallet» / «Save to Google Wallet») con sus guías de tamaño y
> espaciado. Los botones actuales en `src/components/visitor/wallet-buttons.tsx`
> son funcionales pero genéricos: sustitúyelos por los recursos oficiales antes
> de publicar.

**Si no las configuras:** los botones no aparecen. El pase sigue disponible por
enlace y por correo.

---

## 4. WhatsApp

Envía el enlace de invitación por WhatsApp además de por correo. Usa la API de
Meta Cloud.

WhatsApp **no permite iniciar una conversación con texto libre**: el primer
mensaje debe usar una plantilla aprobada por Meta. Por eso el texto vive en la
plantilla y el código solo rellena sus variables.

1. Crea una app en [Meta for Developers](https://developers.facebook.com) y
   agrega el producto **WhatsApp**.
2. Registra tu número y obtén el **Phone Number ID** y un token de acceso
   permanente (usuario de sistema).
3. Crea una plantilla de tipo *Marketing* o *Utility* con **cuatro variables en
   el cuerpo y un botón de URL dinámica**:

   ```text
   Hola {{1}}: {{2}} te invita a {{3}} el {{4}}.
   Completa tu registro desde tu teléfono y recibe tu pase de acceso.

   [Botón · Ver invitación] https://tudominio.com/{{1}}
   ```

   Las variables son, en orden: nombre del visitante, nombre del anfitrión,
   nombre de la empresa y fecha. El botón recibe la ruta `visit/<token>`.

4. Configura:

   ```bash
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   WHATSAPP_ACCESS_TOKEN=EAAG...
   WHATSAPP_TEMPLATE_NAME=nexa_visit_invitation
   WHATSAPP_TEMPLATE_LANG=es_MX
   WHATSAPP_DEFAULT_COUNTRY_CODE=52
   ```

Los números de diez dígitos reciben el código de país configurado; si el
visitante trae otro país, captura el teléfono con `+` y su lada.

**Si no lo configuras:** la opción no aparece en el formulario. El anfitrión
sigue pudiendo compartir el enlace por WhatsApp con el botón de compartir del
teléfono, que abre la app instalada y no cuesta nada.

---

## 5. Aplicación instalable (PWA)

Ya está lista: `src/app/manifest.ts` con iconos generados en el servidor y
atajos directos al escáner y a la invitación. En Android aparece «Instalar
aplicación»; en iOS, «Añadir a pantalla de inicio» desde Compartir.

Requiere HTTPS con dominio real, igual que la cámara.

**Pendiente:** las notificaciones push al anfitrión necesitan además un service
worker y claves VAPID. No está implementado; hoy el aviso de llegada es por
correo.

---

## Resumen de variables

| Variable | Para qué | Sin ella |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` | Base de datos, sesión y almacenamiento | Modo vitrina |
| `NEXT_PUBLIC_APP_URL` | Construir enlaces de invitación y pase | Usa `localhost` |
| `RESEND_API_KEY` · `RESEND_FROM_EMAIL` | Correos de la aplicación | Se registran en consola |
| SMTP en el panel de Supabase | Código de acceso de seis dígitos | **Nadie puede iniciar sesión** |
| Plantillas con `{{ .Token }}` | Que llegue el código y no un enlace | Llega un enlace que no lleva a ningún lado |
| `CRON_SECRET` | Retención diaria de documentos | El cron responde 401 |
| `NEXT_PUBLIC_OCR_PROVIDER=tesseract` | Lectura real del MRZ | Lectura simulada |
| `GOOGLE_WALLET_*` | Pase en Google Wallet | Botón oculto |
| `APPLE_WALLET_*` | Pase en Apple Wallet | Botón oculto |
| `WHATSAPP_*` | Envío por WhatsApp | Opción oculta |
