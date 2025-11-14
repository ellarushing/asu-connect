-- Fix Admin Permissions for ASU Connect
-- This script grants admin permissions to club creators who don't have them yet

-- ============================================================================
-- STEP 1: Add admin permissions to all club creators
-- ============================================================================
-- This adds an admin role in club_members for all users who created clubs
-- but don't have a corresponding membership entry

INSERT INTO public.club_members (club_id, user_id, role, joined_at)
SELECT
    c.id AS club_id,
    c.created_by AS user_id,
    'admin' AS role,
    c.created_at AS joined_at
FROM public.clubs c
WHERE NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = c.id
    AND cm.user_id = c.created_by
)
ON CONFLICT (club_id, user_id) DO UPDATE
SET role = 'admin';

-- ============================================================================
-- STEP 2: Update existing members who are club creators to admin role
-- ============================================================================
-- If someone created a club but was added as a regular member instead of admin,
-- this updates their role to admin

UPDATE public.club_members cm
SET role = 'admin'
FROM public.clubs c
WHERE cm.club_id = c.id
    AND cm.user_id = c.created_by
    AND cm.role != 'admin';

-- ============================================================================
-- STEP 3: Grant admin to specific user (optional - replace with your user ID)
-- ============================================================================
-- If you know your user ID and want to be an admin of all clubs you're a member of,
-- uncomment and run this:

-- UPDATE public.club_members
-- SET role = 'admin'
-- WHERE user_id = 'YOUR_USER_ID_HERE';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check which users are admins of which clubs
SELECT
    c.name AS club_name,
    cm.user_id,
    cm.role,
    c.created_by,
    CASE
        WHEN c.created_by = cm.user_id THEN 'Creator'
        ELSE 'Not Creator'
    END AS creator_status
FROM public.club_members cm
JOIN public.clubs c ON cm.club_id = c.id
WHERE cm.role = 'admin'
ORDER BY c.name, cm.role;

-- Check for any clubs without admin members
SELECT
    c.id,
    c.name,
    c.created_by,
    COUNT(cm.id) FILTER (WHERE cm.role = 'admin') AS admin_count
FROM public.clubs c
LEFT JOIN public.club_members cm ON cm.club_id = c.id AND cm.role = 'admin'
GROUP BY c.id, c.name, c.created_by
HAVING COUNT(cm.id) FILTER (WHERE cm.role = 'admin') = 0;
