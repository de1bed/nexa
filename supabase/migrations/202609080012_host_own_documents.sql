-- El anfitrión debe ver (y saber que existe) la identificación de SUS visitas.
-- Antes RLS ocultaba visitor_documents a los hosts, así que el panel decía
-- "no capturada" aunque el archivo sí estaba guardado.

drop policy if exists documents_host_own on public.visitor_documents;
create policy documents_host_own on public.visitor_documents
  for select using (
    exists (
      select 1
      from public.visits v
      where v.id = visitor_documents.visit_id
        and v.organization_id = visitor_documents.organization_id
        and v.host_id = auth.uid()
        and public.has_role(
          v.organization_id,
          array['host']::public.member_role[]
        )
    )
  );

drop policy if exists document_storage_read on storage.objects;
create policy document_storage_read on storage.objects for select using (
  bucket_id = 'visitor-documents' and (
    public.has_role(
      (storage.foldername(name))[1]::uuid,
      array['superadmin','admin']::public.member_role[]
    )
    or (
      public.has_role(
        (storage.foldername(name))[1]::uuid,
        array['guard']::public.member_role[]
      )
      and exists (
        select 1 from public.organization_settings s
        where s.organization_id = (storage.foldername(name))[1]::uuid
          and s.allow_document_preview_for_guards
      )
    )
    or (
      public.has_role(
        (storage.foldername(name))[1]::uuid,
        array['host']::public.member_role[]
      )
      and exists (
        select 1 from public.visits v
        where v.organization_id = (storage.foldername(name))[1]::uuid
          and v.id::text = (storage.foldername(name))[2]
          and v.host_id = auth.uid()
      )
    )
  )
);
