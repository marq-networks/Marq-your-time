-- Fix for member_privacy_settings unique constraint issue
-- Before: unique(member_id) prevented users from having settings in multiple orgs
-- After: unique(member_id, org_id) allows settings per org

DO $$
BEGIN
    -- Drop the incorrect unique constraint if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_privacy_settings_member_id_key') THEN
        ALTER TABLE public.member_privacy_settings DROP CONSTRAINT member_privacy_settings_member_id_key;
    END IF;
    
    -- Add the correct unique constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_privacy_settings_member_org_unique') THEN
        ALTER TABLE public.member_privacy_settings ADD CONSTRAINT member_privacy_settings_member_org_unique UNIQUE (member_id, org_id);
    END IF;
END $$;

-- Fix for activity_events missing click_count column
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS click_count integer;
