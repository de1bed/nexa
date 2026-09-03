# Decisiones técnicas

1. **RLS como frontera multiempresa.** Todas las tablas operativas llevan `organization_id`; `is_member`, `has_role` y `can_access_visit` centralizan las políticas. La API nunca es la única barrera.

2. **Hash de tokens sin depender de pgcrypto.** `public.token_hash()` usa `sha256()` y `convert_to()`, ambos built-ins de `pg_catalog`. Las funciones se declaran con `search_path = ''` por seguridad, y en ese contexto `digest()` —que vive en el esquema `extensions` de Supabase— no se resuelve. El hash coincide byte a byte con `createHash("sha256")` de Node, y hay una prueba unitaria que lo fija contra un valor conocido.

3. **Modo fail-closed.** `isLiveMode()` es la única fuente de verdad: hay credenciales de Supabase y no se pidió vitrina explícitamente. Antes bastaba con que faltara una variable para dejar los portales abiertos; ahora la ausencia de credenciales significa "no hay nada real que proteger", y su presencia obliga a autenticación.

4. **Redirección por rol sin bucles.** `roleHome` mapea cada rol a una ruta que ese rol sí puede abrir, y toda guarda redirige ahí. Es imposible construir un ciclo, porque el destino nunca vuelve a rechazar al mismo usuario.

5. **Acceso transaccional.** `record_access_decision` bloquea la visita con `for update`, revalida estado y ventana, y escribe evento y auditoría en la misma transacción. Las tolerancias salen de `organization_settings`, no de constantes.

6. **Catálogo dinámico.** Ubicaciones y anfitriones se leen de `/api/directory`. Ningún formulario tiene nombres ni sedes escritos en el código: una empresa nueva opera desde el primer minuto.

7. **Un enlace vigente a la vez.** Regenerar el enlace de registro reabre el formulario (`completed_at = null`) e invalida el anterior; emitir un pase nuevo revoca los previos. La interfaz lo advierte antes de hacerlo.

8. **Documentos separados y efímeros.** El objeto vive en Storage privado; PostgreSQL guarda metadatos y retención. La vista se entrega con URL firmada de 60 segundos y queda auditada. La retención borra primero el archivo y solo entonces marca la fila, para no dejar huérfanos.

9. **Estado del cliente como store externo.** Tanto el reloj de los cronómetros como el store de vitrina se consumen con `useSyncExternalStore`. Ningún efecto llama a `setState` de forma síncrona, y todos los contadores en vivo comparten un único temporizador.

10. **Un contrato de dominio.** `src/lib/domain.ts` describe las formas que viajan entre servidor y cliente; el mapeo desde PostgREST ocurre en un solo lugar. La interfaz no distingue vitrina de producción, así que lo que se evalúa es lo que se opera.

11. **Reglas de acceso duplicadas a propósito.** `visit-service.ts` es el espejo verificable de `record_access_decision`: alimenta el modo vitrina y permite probar las reglas en unitarias rápidas. Cualquier cambio debe hacerse en ambos lados.

12. **OCR local e intercambiable.** El proveedor se elige por variable de entorno y se carga bajo demanda. Tesseract corre en el dispositivo del visitante: la identificación no viaja a terceros. La lectura solo rellena campos vacíos, nunca pisa lo que la persona escribió.

13. **Móvil primero, de verdad.** Objetivos táctiles grandes, hojas inferiores en vez de diálogos centrados, áreas seguras respetadas, tipografía de 16 px en los campos para evitar el zoom de iOS, y listas que son tarjetas en el teléfono y tabla en el escritorio.

14. **Datos parciales de invitación.** Lo que el anfitrión adelanta se guarda en `visit_invitations` como sugerencia editable; no se convierte en identidad hasta que el visitante confirma su preregistro.

15. **Aviso de privacidad como dato.** El texto y su versión viven en `organization_settings`. Al editarlo se genera una versión nueva, y cada visita registra qué versión aceptó el visitante.
