import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/events/[id]/flags
 * Get all flags for an event (admin only - event creator)
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

    // Verify user is the event creator
    if (event.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only event creator can view flags' },
        { status: 403 }
      );
    }

    // Get all flags for the event with user information
    const { data: flags, error: flagsError } = await supabase
      .from('event_flags')
      .select(`
        *,
        user:user_id (
          email
        ),
        reviewer:reviewed_by (
          email
        )
      `)
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (flagsError) {
      console.error('Error fetching flags:', flagsError);
      return NextResponse.json(
        { error: 'Failed to fetch flags', details: flagsError.message },
        { status: 500 }
      );
    }

    // Format the response to include user email in a cleaner format
    const formattedFlags = flags?.map((flag) => ({
      id: flag.id,
      event_id: flag.event_id,
      user_id: flag.user_id,
      user_email: (flag as { user?: { email?: string } }).user?.email || 'Unknown',
      reason: flag.reason,
      details: flag.details,
      status: flag.status,
      reviewed_by: flag.reviewed_by,
      reviewer_email: (flag as { reviewer?: { email?: string } }).reviewer?.email || null,
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
