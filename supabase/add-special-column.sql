ALTER TABLE public.monitors ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;
