-- Transcript cache to reduce repeated YouTube fetches (helps avoid rate limits)
CREATE TABLE IF NOT EXISTS public.video_transcripts_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  lang TEXT,
  transcript TEXT NOT NULL,
  segments JSONB,
  source TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.video_transcripts_cache ENABLE ROW LEVEL SECURITY;

-- Ensure we have a shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_video_transcripts_cache_updated_at ON public.video_transcripts_cache;
CREATE TRIGGER update_video_transcripts_cache_updated_at
BEFORE UPDATE ON public.video_transcripts_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_video_transcripts_cache_video_id
ON public.video_transcripts_cache(video_id);