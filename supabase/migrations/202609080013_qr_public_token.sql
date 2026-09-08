-- Token en claro para que anfitrión y admin puedan mostrar/descargar el QR
-- sin correo. La validación pública sigue usando token_hash.

alter table public.qr_tokens
  add column if not exists public_token text;
