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

    // Try to find the flag in event_flags first
    const { data: eventFlag, error: eventFlagError } = await supabase
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
        ),
        reporter:profiles!user_id (
          id,
          email,
          full_name
        ),
        reviewer:profiles!reviewed_by (
          id,
          email,
          full_name
        )
      `)
      .eq('id', id)
      .single();

    if (eventFlag && !eventFlagError) {
      return NextResponse.json(
        {
          flag: {
            id: eventFlag.id,
            entity_id: eventFlag.event_id,
            entity_type: 'event',
            entity: eventFlag.event,
            user_id: eventFlag.user_id,
            reporter: eventFlag.reporter,
            reason: eventFlag.reason,
            details: eventFlag.details,
            status: eventFlag.status,
            reviewed_by: eventFlag.reviewed_by,
            reviewer: eventFlag.reviewer,
            reviewed_at: eventFlag.reviewed_at,
            created_at: eventFlag.created_at,
            updated_at: eventFlag.updated_at,
          },
        },
        { status: 200 }
      );
    }

    // Try to find the flag in club_flags
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
        ),
        reporter:profiles!user_id (
          id,
          email,
          full_name
        ),
        reviewer:profiles!reviewed_by (
          id,
          email,
          full_name
        )
      `)
      .eq('id', id)
      .single();

    if (clubFlag && !clubFlagError) {
      return NextResponse.json(
        {
          flag: {
            id: clubFlag.id,
            entity_id: clubFlag.club_id,
            entity_type: 'club',
            entity: clubFlag.club,
            user_id: clubFlag.user_id,
            reporter: clubFlag.reporter,
            reason: clubFlag.reason,
            details: clubFlag.details,
            status: clubFlag.status,
            reviewed_by: clubFlag.reviewed_by,
            reviewer: clubFlag.reviewer,
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
    const { data: eventFlag, error: eventFlagError } = await supabase
      .from('event_flags')
      .update({
        status,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        event:events (
          id,
          title
        )
      `)
      .single();

    if (eventFlag && !eventFlagError) {
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
          entity_title: eventFlag.event?.title,
          status,
          notes,
        }
      );

      return NextResponse.json(
        {
          flag: eventFlag,
          message: 'Event flag status updated successfully',
        },
        { status: 200 }
      );
    }

    // Try to update club flag
    const { data: clubFlag, error: clubFlagError } = await supabase
      .from('club_flags')
      .update({
        status,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        club:clubs (
          id,
          name
        )
      `)
      .single();

    if (clubFlag && !clubFlagError) {
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
          entity_name: clubFlag.club?.name,
          status,
          notes,
        }
      );

      return NextResponse.json(
        {
          flag: clubFlag,
          message: 'Club flag status updated successfully',
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
