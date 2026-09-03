# Integraciones

Todo lo que hay que conectar además de Supabase, en orden de importancia. Cada
sección dice qué pasa **si no** la configuras: ninguna es obligatoria para que la
plataforma funcione, pero la primera sí lo es para que las empresas puedan
registrarse.

---

## 1. Correo (crítico)

Hay **dos** sistemas de correo distintos y es fácil pasar uno por alto.

### 1.1 Correos de la aplicación — Resend

Invitación al visitante, pase QR, aviso de llegada al anfitrión e invitación al
equipo. Salen por Resend con las plantillas de `src/lib/server/email.ts`.

1. Crea la cuenta en [resend.com](https://resend.com) y verifica tu dominio
   (agrega los registros SPF y DKIM que te indique en tu DNS).
2. Genera una API key.
3. Configura:

   ```bash
   RESEND_API_KEY=re_xxxxxxxx
   RESEND_FROM_EMAIL="NEXA VISIT <visitas@tudominio.com>"
   ```

**Si no lo configuras:** los correos no se envían; el destinatario y el enlace se
imprimen en la consola del servidor. El recorrido completo sigue funcionando
porque el anfitrión puede compartir el enlace desde su teléfono.

### 1.2 Correos de cuenta — SMTP de Supabase

Confirmación de registro, recuperación de contraseña y activación de un miembro
del equipo **no pasan por Resend**: los envía Supabase Auth.

> Sin este paso, quien se registre en `/signup` **nunca recibirá el correo de
> confirmación**. El SMTP integrado de Supabase está limitado a unos pocos
> mensajes por hora y solo entrega a miembros de tu propio equipo.

En el panel de Supabase → **Authentication → Emails → SMTP Settings**, activa
«Enable Custom SMTP» y usa el mismo Resend:

| Campo | Valor |
| --- | --- |
| Host | `smtp.resend.com` |
| Puerto | `465` |
| Usuario | `resend` |
| Contraseña | tu `RESEND_API_KEY` |
| Sender email | el mismo de `RESEND_FROM_EMAIL` |

En **Authentication → URL Configuration** define:

- Site URL: `https://tudominio.com`
- Redirect URLs: `https://tudominio.com/auth/callback`

Y en **Authentication → Emails → Templates**, traduce las plantillas al español.
La de «Confirm signup» debe apuntar a `{{ .ConfirmationURL }}`, que ya llega a
`/auth/callback?next=/onboarding`.

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
| SMTP en el panel de Supabase | Confirmación de cuenta y contraseñas | **Los registros no se confirman** |
| `CRON_SECRET` | Retención diaria de documentos | El cron responde 401 |
| `NEXT_PUBLIC_OCR_PROVIDER=tesseract` | Lectura real del MRZ | Lectura simulada |
| `GOOGLE_WALLET_*` | Pase en Google Wallet | Botón oculto |
| `APPLE_WALLET_*` | Pase en Apple Wallet | Botón oculto |
| `WHATSAPP_*` | Envío por WhatsApp | Opción oculta |
