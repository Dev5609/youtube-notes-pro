-- Add explicit deny-all RLS policies to satisfy linter while keeping table private
DROP POLICY IF EXISTS "Deny all select" ON public.video_transcripts_cache;
DROP POLICY IF EXISTS "Deny all insert" ON public.video_transcripts_cache;
DROP POLICY IF EXISTS "Deny all update" ON public.video_transcripts_cache;
DROP POLICY IF EXISTS "Deny all delete" ON public.video_transcripts_cache;

CREATE POLICY "Deny all select"
ON public.video_transcripts_cache
FOR SELECT
USING (false);

CREATE POLICY "Deny all insert"
ON public.video_transcripts_cache
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny all update"
ON public.video_transcripts_cache
FOR UPDATE
USING (false);

CREATE POLICY "Deny all delete"
ON public.video_transcripts_cache
FOR DELETE
USING (false);