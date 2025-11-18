import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/lib/auth/admin';

// ============================================================================
// TYPES
// ============================================================================

interface Club {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/clubs/my-admin-clubs
 * Get list of clubs where the current user is an admin
 *
 * Returns:
 * - All clubs if user is a platform admin
 * - Only clubs where user has role='admin' in club_members if regular user
 * - Empty array if user is not authenticated or has no admin clubs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'You must be logged in to view your admin clubs' },
        { status: 401 }
      );
    }

    // Check if user is a platform admin
    const userIsPlatformAdmin = await isAdmin(user.id);

    let clubs: Club[] = [];

    if (userIsPlatformAdmin) {
      // Platform admins can see all clubs
      const { data: allClubs, error: clubsError } = await supabase
        .from('clubs')
        .select('*')
        .order('name');

      if (clubsError) {
        console.error('Database error fetching all clubs:', clubsError);
        return NextResponse.json(
          { error: 'Failed to fetch clubs', details: clubsError.message },
          { status: 500 }
        );
      }

      clubs = allClubs || [];
    } else {
      // Regular users - fetch only clubs where they are admins
      const { data: adminMemberships, error: membershipError } = await supabase
        .from('club_members')
        .select(`
          club_id,
          clubs:club_id (
            id,
            name,
            description,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .eq('status', 'approved');

      if (membershipError) {
        console.error('Database error fetching admin clubs:', membershipError);
        return NextResponse.json(
          { error: 'Failed to fetch admin clubs', details: membershipError.message },
          { status: 500 }
        );
      }

      // Extract clubs from the join result
      clubs = (adminMemberships || [])
        .map((membership: any) => membership.clubs)
        .filter((club: any) => club !== null);

      // Sort by name
      clubs.sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({
      clubs,
      count: clubs.length,
      is_platform_admin: userIsPlatformAdmin,
    });

  } catch (error) {
    console.error('Error in GET /api/clubs/my-admin-clubs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
