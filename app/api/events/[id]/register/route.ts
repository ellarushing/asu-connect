import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/events/[id]/register
 * Register a user for an event
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

    // Check if event exists and its club is approved
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        club_id,
        clubs:club_id (
          approval_status
        )
      `)
      .eq('id', id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify the event's club is approved
    if (!event.clubs || event.clubs.approval_status !== 'approved') {
      return NextResponse.json(
        {
          error: 'Cannot register for events from clubs that are not approved',
          details: event.clubs?.approval_status === 'rejected'
            ? 'This club has been rejected by an administrator'
            : 'This club is pending admin approval'
        },
        { status: 403 }
      );
    }

    // Check if already registered
    const { data: existingReg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingReg) {
      return NextResponse.json(
        { error: 'Already registered for this event' },
        { status: 409 }
      );
    }

    // Create registration
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .insert({
        event_id: id,
        user_id: user.id,
      })
      .select()
      .single();

    if (regError) {
      return NextResponse.json(
        { error: 'Failed to register for event', details: regError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        registration,
        message: 'Successfully registered for event',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`Error in POST /api/events/[id]/register:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]/register
 * Cancel registration for an event
 */
export async function DELETE(
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

    // Delete registration
    const { error: deleteError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to cancel registration', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Registration cancelled successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error in DELETE /api/events/[id]/register:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
