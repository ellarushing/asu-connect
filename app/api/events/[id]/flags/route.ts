import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/lib/auth/admin';

/**
 * GET /api/events/[id]/flags
 * Get all flags for an event (event creator or platform admin)
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

    // Get the event to verify ownership
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, created_by, title')
      .eq('id', id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify user is the event creator or an admin
    const isEventCreator = event.created_by === user.id;
    const userIsAdmin = await isAdmin(user.id);

    if (!isEventCreator && !userIsAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only event creator or admin can view flags' },
        { status: 403 }
      );
    }

    // Get all flags for the event
    const { data: flags, error: flagsError } = await supabase
      .from('event_flags')
      .select('*')
      .eq('event_id', id)
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
      event_id: flag.event_id,
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
        event: {
          id: event.id,
          title: event.title,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/events/[id]/flags:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
