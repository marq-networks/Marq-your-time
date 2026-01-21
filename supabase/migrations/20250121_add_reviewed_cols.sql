-- Migration to add reviewed_at and reviewed_by columns to timesheets table
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS reviewed_by uuid references public.users(id) on delete set null;
