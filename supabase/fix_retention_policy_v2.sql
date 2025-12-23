-- Safe migration to add unique constraint and default policies
DO $$
BEGIN
    -- 1. Remove duplicates if any exist (keeping the most recent one)
    DELETE FROM public.data_retention_policies a USING (
        SELECT org_id, category, max(created_at) as max_created
        FROM public.data_retention_policies 
        GROUP BY org_id, category HAVING count(*) > 1
    ) b
    WHERE a.org_id = b.org_id 
    AND a.category = b.category 
    AND a.created_at < b.max_created;

    -- 2. Add the unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'data_retention_policies_org_category_key'
    ) THEN
        ALTER TABLE public.data_retention_policies 
        ADD CONSTRAINT data_retention_policies_org_category_key UNIQUE (org_id, category);
    END IF;
END $$;

-- 3. Insert default 30-day hard-delete policy for screenshots
INSERT INTO public.data_retention_policies (org_id, category, retention_days, hard_delete)
SELECT id, 'screenshots', 30, true
FROM public.organizations
ON CONFLICT (org_id, category) DO NOTHING;
