CREATE TABLE public.pilot_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 folder text NOT NULL CHECK (folder IN ('piloto','drone')),
 name text NOT NULL,
 mime_type text NOT NULL,
 storage_path text NOT NULL UNIQUE,
 expires_on date,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (split_part(storage_path, '/', 1) = user_id::text)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_documents TO authenticated;
GRANT ALL ON public.pilot_documents TO service_role;
ALTER TABLE public.pilot_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read documents" ON public.pilot_documents FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Owners insert documents" ON public.pilot_documents FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Owners update documents" ON public.pilot_documents FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Owners delete documents" ON public.pilot_documents FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE INDEX pilot_documents_user_id_idx ON public.pilot_documents(user_id);
CREATE POLICY "Owners read private document files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pilot-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "Owners upload private document files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pilot-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "Owners delete private document files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'pilot-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);