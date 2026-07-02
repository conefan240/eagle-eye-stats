
CREATE TABLE public.rounds (
  id UUID NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holes INT NOT NULL CHECK (holes IN (9,18)),
  course_name TEXT NOT NULL DEFAULT '',
  tee TEXT NOT NULL DEFAULT 'white',
  started_at BIGINT NOT NULL,
  saved_at BIGINT,
  pars JSONB NOT NULL DEFAULT '[]'::jsonb,
  scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  distances JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rounds TO authenticated;
GRANT ALL ON public.rounds TO service_role;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rounds" ON public.rounds FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX rounds_user_saved_idx ON public.rounds(user_id, saved_at DESC);
