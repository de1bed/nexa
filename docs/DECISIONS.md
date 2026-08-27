# Decisiones técnicas

1. **RLS como frontera multiempresa.** Todas las tablas operativas incluyen `organization_id`; `is_member`, `has_role` y `can_access_visit` centralizan políticas.
2. **Tokens opacos con SHA-256.** El token crudo se entrega una vez y no se guarda en PostgreSQL. El QR no contiene PII.
3. **Acceso transaccional.** `record_access_decision` bloquea la visita, revalida estado y registra evento/auditoría en la misma transacción.
4. **OCR reemplazable.** La UI depende de `OCRProvider`; mock permite E2E estable y Tesseract evita servicios pagados.
5. **Documentos separados.** Storage privado guarda objetos; PostgreSQL conserva metadatos, retención y OCR. Guardias no ven documentos salvo política explícita.
6. **Modo demo local.** Sin credenciales, `DemoProvider` conserva el recorrido en `localStorage`; los adaptadores productivos usan Supabase.
7. **Sin IP persistida.** No existe finalidad proporcional demostrada; solo se usa transitoriamente para rate limiting.
8. **Tailwind v4 y componentes propios.** Se evita una plantilla genérica y se mantienen patrones compatibles con shadcn/ui.
9. **Next.js 16.** Se usan params asíncronos y tipos generados de rutas según la documentación incluida.
10. **Métricas derivadas.** Dashboard y reportes calculan desde visitas visibles; no presentan números inventados como producción.
