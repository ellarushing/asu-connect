-- Add status column to club_members table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'club_members'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.club_members
        ADD COLUMN status TEXT DEFAULT 'approved';

        -- Add constraint
        ALTER TABLE public.club_members
        ADD CONSTRAINT club_members_status_check
            CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- Update existing records to have 'approved' status (safe to run multiple times)
UPDATE public.club_members
SET status = 'approved'
WHERE status IS NULL;

-- Create index for status column to improve query performance (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_club_members_status ON public.club_members(status);

-- Add comment to explain the status column (safe to run multiple times)
COMMENT ON COLUMN public.club_members.status IS 'Membership status: pending (awaiting approval), approved (active member), rejected (denied membership)';
