import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  EventSubject,
  EmailNotifier,
  InAppNotifier,
  UpdateEventCommand,
  CommandInvoker,
  Event as DesignPatternEvent,
} from '@/lib/design-patterns';

// Database event type matching the schema
interface DatabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  club_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Convert database event to design pattern event
function toDesignPatternEvent(dbEvent: DatabaseEvent): DesignPatternEvent {
  return {
    id: dbEvent.id,
    name: dbEvent.title,
    date: new Date(dbEvent.event_date),
    popularity: 0,
  };
}

/**
 * GET /api/events/[id]
 * Get a single event by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch event from database
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch event', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    console.error(`Error in GET /api/events/[id]:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/[id]
 * Update an event by ID
 * Body: { title?, description?, event_date?, location? }
 */
export async function PUT(
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

    // Fetch existing event
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch event', details: fetchError.message },
        { status: 500 }
      );
    }

    // Verify user is the event creator
    if (existingEvent.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only event creator can update this event' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, description, event_date, location } = body;

    // Build update object (only include provided fields)
    const updates: Partial<DatabaseEvent> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (event_date !== undefined) updates.event_date = event_date;
    if (location !== undefined) updates.location = location;

    // Validate at least one field to update
    if (Object.keys(updates).length === 1) {
      // Only updated_at
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Apply Command Pattern for update
    const designPatternEvent = toDesignPatternEvent(existingEvent);
    const updateCommand = new UpdateEventCommand(designPatternEvent, {
      name: title,
      date: event_date ? new Date(event_date) : undefined,
    });
    const invoker = new CommandInvoker();

    invoker.execute(updateCommand);
    console.log('[COMMAND PATTERN] Event update command executed');

    // Update event in database
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update event', details: updateError.message },
        { status: 500 }
      );
    }

    // Apply Observer Pattern - trigger notifications
    const eventSubject = new EventSubject();
    const emailNotifier = new EmailNotifier(user.email || 'user@asu.edu');
    const inAppNotifier = new InAppNotifier(user.id);

    eventSubject.attach(emailNotifier);
    eventSubject.attach(inAppNotifier);

    // Build change summary
    const changes: string[] = [];
    if (title && title !== existingEvent.title) changes.push('title');
    if (event_date && event_date !== existingEvent.event_date) changes.push('date');
    if (description !== undefined && description !== existingEvent.description)
      changes.push('description');
    if (location !== undefined && location !== existingEvent.location)
      changes.push('location');

    eventSubject.updateEvent(
      updatedEvent.title,
      changes.join(', ') || 'unknown fields'
    );

    return NextResponse.json(
      {
        event: updatedEvent,
        message: 'Event updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error in PUT /api/events/[id]:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]
 * Delete an event by ID
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

    // Fetch existing event to verify ownership
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch event', details: fetchError.message },
        { status: 500 }
      );
    }

    // Verify user is the event creator
    if (existingEvent.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only event creator can delete this event' },
        { status: 403 }
      );
    }

    // Delete event from database
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete event', details: deleteError.message },
        { status: 500 }
      );
    }

    // Apply Observer Pattern - notify about deletion
    const eventSubject = new EventSubject();
    const emailNotifier = new EmailNotifier(user.email || 'user@asu.edu');
    const inAppNotifier = new InAppNotifier(user.id);

    eventSubject.attach(emailNotifier);
    eventSubject.attach(inAppNotifier);
    eventSubject.notify(`Event "${existingEvent.title}" has been deleted`);

    return NextResponse.json(
      {
        message: 'Event deleted successfully',
        deletedEvent: existingEvent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error in DELETE /api/events/[id]:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
