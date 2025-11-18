import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/clubs/[id]/flags
 * Get all flags for a club (admin only - club creator)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the club to verify ownership
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id, created_by, name')
      .eq('id', id)
      .single();

    if (clubError || !club) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    // Verify user is the club creator
    if (club.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only club creator can view flags' },
        { status: 403 }
      );
    }

    // Get all flags for the club
    const { data: flags, error: flagsError } = await supabase
      .from('club_flags')
      .select('*')
      .eq('club_id', id)
      .order('created_at', { ascending: false });

    if (flagsError) {
      console.error('Error fetching flags:', flagsError);
      return NextResponse.json(
        { error: 'Failed to fetch flags', details: flagsError.message },
        { status: 500 }
      );
    }

    // Extract unique user IDs (both reporters and reviewers)
    const userIds = [
      ...new Set([
        ...(flags || []).map(f => f.user_id),
        ...(flags || []).map(f => f.reviewed_by).filter(Boolean)
      ])
    ];

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Create lookup map for profiles
    const profileMap = Object.fromEntries(
      (profiles || []).map(p => [p.id, p])
    );

    // Format the response to include user email in a cleaner format
    const formattedFlags = (flags || []).map((flag) => ({
      id: flag.id,
      club_id: flag.club_id,
      user_id: flag.user_id,
      user_email: profileMap[flag.user_id]?.email || 'Unknown',
      reason: flag.reason,
      details: flag.details,
      status: flag.status,
      reviewed_by: flag.reviewed_by,
      reviewer_email: flag.reviewed_by ? (profileMap[flag.reviewed_by]?.email || null) : null,
      reviewed_at: flag.reviewed_at,
      created_at: flag.created_at,
      updated_at: flag.updated_at,
    }));

    return NextResponse.json(
      {
        flags: formattedFlags || [],
        club: {
          id: club.id,
          name: club.name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/clubs/[id]/flags:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
