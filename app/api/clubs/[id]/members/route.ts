import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    email: string | null;
    full_name: string | null;
  };
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/clubs/[id]/members
 * Get list of approved members for a club
 *
 * Returns:
 * - List of approved members with user info
 * - Each member includes: id, user_id, role, joined_at, email, full_name
 * - Ordered by joined_at DESC (newest members first)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const clubId = id;

    // Validate club ID
    if (!clubId) {
      return NextResponse.json(
        { error: 'Invalid club ID', details: 'Club ID is required' },
        { status: 400 }
      );
    }

    // Check if club exists
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id')
      .eq('id', clubId)
      .single();

    if (clubError || !club) {
      return NextResponse.json(
        { error: 'Club not found', details: 'The specified club does not exist' },
        { status: 404 }
      );
    }

    // Fetch approved members
    const { data: members, error: membersError } = await supabase
      .from('club_members')
      .select('id, user_id, role, joined_at')
      .eq('club_id', clubId)
      .eq('status', 'approved')
      .order('joined_at', { ascending: false });

    if (membersError) {
      console.error('Database error fetching members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch members', details: membersError.message },
        { status: 500 }
      );
    }

    // Extract unique user IDs
    const userIds = [...new Set((members || []).map(m => m.user_id))];

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('Database error fetching profiles:', profilesError);
    }

    // Create lookup map for profiles
    const profileMap = Object.fromEntries(
      (profiles || []).map(p => [p.id, p])
    );

    // Transform the data to merge profile information
    const transformedMembers = (members || []).map((member: any) => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      email: profileMap[member.user_id]?.email || null,
      full_name: profileMap[member.user_id]?.full_name || null,
    }));

    return NextResponse.json({
      members: transformedMembers,
      count: transformedMembers.length,
    });

  } catch (error) {
    console.error('Error in GET /api/clubs/[id]/members:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
