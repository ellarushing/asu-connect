import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin, handleAdminError, logModerationAction, ModerationAction } from '@/lib/auth/admin';

/**
 * GET /api/admin/flags/[id]
 * Fetch specific flag details (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify admin access
    const admin = await requireAdmin();

    const supabase = await createClient();

    // Try to find the flag in event_flags first (without join to avoid foreign key issues)
    const { data: eventFlag, error: eventFlagError} = await supabase
      .from('event_flags')
      .select(`
        *,
        event:events (
          id,
          title,
          description,
          event_date,
          location,
          created_by
        )
      `)
      .eq('id', id)
      .single();

    if (eventFlag && !eventFlagError) {
      // Fetch reporter and reviewer profiles separately to avoid foreign key issues
      const profileIds = [eventFlag.user_id, eventFlag.reviewed_by].filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', profileIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return NextResponse.json(
        {
          flag: {
            id: eventFlag.id,
            entity_id: eventFlag.event_id,
            entity_type: 'event',
            entity: eventFlag.event,
            user_id: eventFlag.user_id,
            reporter: profileMap.get(eventFlag.user_id) || null,
            reason: eventFlag.reason,
            details: eventFlag.details,
            status: eventFlag.status,
            reviewed_by: eventFlag.reviewed_by,
            reviewer: eventFlag.reviewed_by ? profileMap.get(eventFlag.reviewed_by) || null : null,
            reviewed_at: eventFlag.reviewed_at,
            created_at: eventFlag.created_at,
            updated_at: eventFlag.updated_at,
          },
        },
        { status: 200 }
      );
    }

    // Try to find the flag in club_flags (without join to avoid foreign key issues)
    const { data: clubFlag, error: clubFlagError } = await supabase
      .from('club_flags')
      .select(`
        *,
        club:clubs (
          id,
          name,
          description,
          created_by,
          approval_status
        )
      `)
      .eq('id', id)
      .single();

    if (clubFlag && !clubFlagError) {
      // Fetch reporter and reviewer profiles separately to avoid foreign key issues
      const profileIds = [clubFlag.user_id, clubFlag.reviewed_by].filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', profileIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return NextResponse.json(
        {
          flag: {
            id: clubFlag.id,
            entity_id: clubFlag.club_id,
            entity_type: 'club',
            entity: clubFlag.club,
            user_id: clubFlag.user_id,
            reporter: profileMap.get(clubFlag.user_id) || null,
            reason: clubFlag.reason,
            details: clubFlag.details,
            status: clubFlag.status,
            reviewed_by: clubFlag.reviewed_by,
            reviewer: clubFlag.reviewed_by ? profileMap.get(clubFlag.reviewed_by) || null : null,
            reviewed_at: clubFlag.reviewed_at,
            created_at: clubFlag.created_at,
            updated_at: clubFlag.updated_at,
          },
        },
        { status: 200 }
      );
    }

    // Flag not found in either table
    return NextResponse.json(
      { error: 'Flag not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error in GET /api/admin/flags/[id]:', error);
    return handleAdminError(error);
  }
}

/**
 * PATCH /api/admin/flags/[id]
 * Update flag status (admin only)
 * Body: { status, notes? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify admin access
    const admin = await requireAdmin();

    const supabase = await createClient();

    // Parse request body
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, reviewed, resolved, or dismissed' },
        { status: 400 }
      );
    }

    // Try to update event flag first
    const { data: eventFlagUpdate, error: eventFlagError } = await supabase
      .from('event_flags')
      .update({
        status,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    // Check if update succeeded (returns array, not single)
    if (eventFlagUpdate && eventFlagUpdate.length > 0 && !eventFlagError) {
      const eventFlag = eventFlagUpdate[0];

      // Fetch event details separately
      const { data: event } = await supabase
        .from('events')
        .select('id, title')
        .eq('id', eventFlag.event_id)
        .single();

      // Log moderation action
      const action = status === 'resolved' ? ModerationAction.RESOLVE_FLAG : ModerationAction.DISMISS_FLAG;
      await logModerationAction(
        admin.id,
        action,
        'flag',
        id,
        {
          flag_type: 'event',
          entity_id: eventFlag.event_id,
          entity_title: event?.title || null,
          status,
          notes,
        }
      );

      return NextResponse.json(
        {
          flag: { ...eventFlag, event },
          message: 'Event flag status updated successfully',
        },
        { status: 200 }
      );
    }

    if (eventFlagError) {
      console.error('Event flag update error:', eventFlagError);
    }

    // Try to update club flag
    const { data: clubFlagUpdate, error: clubFlagError } = await supabase
      .from('club_flags')
      .update({
        status,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    // Check if update succeeded (returns array, not single)
    if (clubFlagUpdate && clubFlagUpdate.length > 0 && !clubFlagError) {
      const clubFlag = clubFlagUpdate[0];

      // Fetch club details separately
      const { data: club } = await supabase
        .from('clubs')
        .select('id, name')
        .eq('id', clubFlag.club_id)
        .single();

      // Log moderation action
      const action = status === 'resolved' ? ModerationAction.RESOLVE_FLAG : ModerationAction.DISMISS_FLAG;
      await logModerationAction(
        admin.id,
        action,
        'flag',
        id,
        {
          flag_type: 'club',
          entity_id: clubFlag.club_id,
          entity_name: club?.name || null,
          status,
          notes,
        }
      );

      return NextResponse.json(
        {
          flag: { ...clubFlag, club },
          message: 'Club flag status updated successfully',
        },
        { status: 200 }
      );
    }

    if (clubFlagError) {
      console.error('Club flag update error:', clubFlagError);
    }

    // Flag not found in either table
    return NextResponse.json(
      { error: 'Flag not found', details: 'No flag exists with the provided ID' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/admin/flags/[id]:', error);
    return handleAdminError(error);
  }
}

/**
 * DELETE /api/admin/flags/[id]
 * Dismiss flag and optionally delete the flagged entity (admin only)
 * Query params: deleteEntity=true to also delete the flagged entity
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify admin access
    const admin = await requireAdmin();

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const deleteEntity = searchParams.get('deleteEntity') === 'true';

    // Try to find and delete event flag
    const { data: eventFlag, error: eventFlagError } = await supabase
      .from('event_flags')
      .select(`
        *,
        event:events (
          id,
          title
        )
      `)
      .eq('id', id)
      .single();

    if (eventFlag && !eventFlagError) {
      // If deleteEntity is true, delete the event
      if (deleteEntity && eventFlag.event_id) {
        const { error: deleteEventError } = await supabase
          .from('events')
          .delete()
          .eq('id', eventFlag.event_id);

        if (deleteEventError) {
          console.error('Error deleting event:', deleteEventError);
          return NextResponse.json(
            { error: 'Failed to delete event', details: deleteEventError.message },
            { status: 500 }
          );
        }

        // Log deletion
        await logModerationAction(
          admin.id,
          ModerationAction.DELETE_EVENT,
          'event',
          eventFlag.event_id,
          {
            reason: 'Flagged content deleted',
            flag_id: id,
            event_title: eventFlag.event?.title,
          }
        );
      } else {
        // Just dismiss the flag
        const { error: updateError } = await supabase
          .from('event_flags')
          .update({
            status: 'dismissed',
            reviewed_by: admin.id,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error dismissing flag:', updateError);
          return NextResponse.json(
            { error: 'Failed to dismiss flag', details: updateError.message },
            { status: 500 }
          );
        }

        // Log dismissal
        await logModerationAction(
          admin.id,
          ModerationAction.DISMISS_FLAG,
          'flag',
          id,
          {
            flag_type: 'event',
            entity_id: eventFlag.event_id,
            entity_title: eventFlag.event?.title,
          }
        );
      }

      return NextResponse.json(
        {
          message: deleteEntity ? 'Flag and event deleted successfully' : 'Flag dismissed successfully',
          deleted_entity: deleteEntity,
        },
        { status: 200 }
      );
    }

    // Try to find and delete club flag
    const { data: clubFlag, error: clubFlagError } = await supabase
      .from('club_flags')
      .select(`
        *,
        club:clubs (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (clubFlag && !clubFlagError) {
      // If deleteEntity is true, delete the club
      if (deleteEntity && clubFlag.club_id) {
        const { error: deleteClubError } = await supabase
          .from('clubs')
          .delete()
          .eq('id', clubFlag.club_id);

        if (deleteClubError) {
          console.error('Error deleting club:', deleteClubError);
          return NextResponse.json(
            { error: 'Failed to delete club', details: deleteClubError.message },
            { status: 500 }
          );
        }

        // Log deletion
        await logModerationAction(
          admin.id,
          ModerationAction.DELETE_CLUB,
          'club',
          clubFlag.club_id,
          {
            reason: 'Flagged content deleted',
            flag_id: id,
            club_name: clubFlag.club?.name,
          }
        );
      } else {
        // Just dismiss the flag
        const { error: updateError } = await supabase
          .from('club_flags')
          .update({
            status: 'dismissed',
            reviewed_by: admin.id,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error dismissing flag:', updateError);
          return NextResponse.json(
            { error: 'Failed to dismiss flag', details: updateError.message },
            { status: 500 }
          );
        }

        // Log dismissal
        await logModerationAction(
          admin.id,
          ModerationAction.DISMISS_FLAG,
          'flag',
          id,
          {
            flag_type: 'club',
            entity_id: clubFlag.club_id,
            entity_name: clubFlag.club?.name,
          }
        );
      }

      return NextResponse.json(
        {
          message: deleteEntity ? 'Flag and club deleted successfully' : 'Flag dismissed successfully',
          deleted_entity: deleteEntity,
        },
        { status: 200 }
      );
    }

    // Flag not found in either table
    return NextResponse.json(
      { error: 'Flag not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error in DELETE /api/admin/flags/[id]:', error);
    return handleAdminError(error);
  }
}
