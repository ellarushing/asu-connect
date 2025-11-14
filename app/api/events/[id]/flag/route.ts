import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/events/[id]/flag
 * Check if current user has flagged this event
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
        { hasFlagged: false },
        { status: 200 }
      );
    }

    // Check if user has flagged this event
    const { data: flag } = await supabase
      .from('event_flags')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .single();

    return NextResponse.json(
      { hasFlagged: !!flag },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/events/[id]/flag:', error);
    return NextResponse.json(
      { hasFlagged: false },
      { status: 200 }
    );
  }
}

/**
 * POST /api/events/[id]/flag
 * Create a flag for an event
 * Body: { reason, details? }
 */
export async function POST(
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

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title')
      .eq('id', id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { reason, details } = body;

    // Validate reason
    if (!reason) {
      return NextResponse.json(
        { error: 'Flag reason is required' },
        { status: 400 }
      );
    }

    const validReasons = ['Inappropriate Content', 'Spam', 'Misinformation', 'Other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid flag reason' },
        { status: 400 }
      );
    }

    // Check for duplicate flag (one per user per event)
    const { data: existingFlag } = await supabase
      .from('event_flags')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingFlag) {
      return NextResponse.json(
        { error: 'You have already flagged this event' },
        { status: 409 }
      );
    }

    // Create flag
    const { data: flag, error: flagError } = await supabase
      .from('event_flags')
      .insert({
        event_id: id,
        user_id: user.id,
        reason,
        details: details || null,
        status: 'pending',
      })
      .select()
      .single();

    if (flagError) {
      console.error('Error creating flag:', flagError);
      return NextResponse.json(
        { error: 'Failed to create flag', details: flagError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        flag,
        message: 'Event flagged successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/events/[id]/flag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/events/[id]/flag
 * Update flag status (admin only - event creator)
 * Body: { flag_id, status }
 */
export async function PATCH(
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

    // Parse request body
    const body = await request.json();
    const { flag_id, status } = body;

    // Validate inputs
    if (!flag_id || !status) {
      return NextResponse.json(
        { error: 'Flag ID and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: reviewed, resolved, or dismissed' },
        { status: 400 }
      );
    }

    // Get the event to verify ownership
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, created_by')
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
        { error: 'Forbidden: Only event creator can update flag status' },
        { status: 403 }
      );
    }

    // Update flag
    const { data: updatedFlag, error: updateError } = await supabase
      .from('event_flags')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', flag_id)
      .eq('event_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating flag:', updateError);
      return NextResponse.json(
        { error: 'Failed to update flag', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        flag: updatedFlag,
        message: 'Flag status updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/events/[id]/flag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
