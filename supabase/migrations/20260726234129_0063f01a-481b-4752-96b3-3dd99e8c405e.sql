-- Only company owners can upload/update/delete files under {company_id}/...
DROP POLICY IF EXISTS "company_media_owner_insert" ON storage.objects;
CREATE POLICY "company_media_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_media_owner_update" ON storage.objects;
CREATE POLICY "company_media_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_media_owner_delete" ON storage.objects;
CREATE POLICY "company_media_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );

-- Owner can list their own files (for management UI)
DROP POLICY IF EXISTS "company_media_owner_select" ON storage.objects;
CREATE POLICY "company_media_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-media'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );
