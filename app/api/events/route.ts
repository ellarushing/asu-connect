import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  FilterByDate,
  FilterByName,
  FilterByPopularity,
  EventFilterContext,
  EventSubject,
  EmailNotifier,
  InAppNotifier,
  CreateEventCommand,
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
    popularity: 0, // Could be calculated from event_registrations count
  };
}

/**
 * GET /api/events
 * List all events with optional filtering using Strategy pattern
 * Query params: ?sortBy=date|name|popularity
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'date';

    // Fetch events from database
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch events', details: error.message },
        { status: 500 }
      );
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ events: [] }, { status: 200 });
    }

    // Apply Strategy Pattern for filtering
    const designPatternEvents = events.map(toDesignPatternEvent);
    let filterContext: EventFilterContext;

    switch (sortBy) {
      case 'name':
        filterContext = new EventFilterContext(new FilterByName());
        break;
      case 'popularity':
        filterContext = new EventFilterContext(new FilterByPopularity());
        break;
      case 'date':
      default:
        filterContext = new EventFilterContext(new FilterByDate());
        break;
    }

    const filteredEvents = filterContext.executeFilter(designPatternEvents);

    // Map back to database format with filtered order
    const orderedEvents = filteredEvents.map((filtered) =>
      events.find((e) => e.id === filtered.id)
    );

    return NextResponse.json(
      { events: orderedEvents, sortBy },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 * Create new event using Command pattern and trigger Observer pattern notifications
 * Body: { title, description, event_date, location, club_id }
 */
export async function POST(request: NextRequest) {
  try {
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
    const { title, description, event_date, location, club_id } = body;

    // Validate required fields
    if (!title || !event_date || !club_id) {
      return NextResponse.json(
        { error: 'Missing required fields: title, event_date, club_id' },
        { status: 400 }
      );
    }

    // Verify user is a club admin
    const { data: membership } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', club_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only club admins can create events' },
        { status: 403 }
      );
    }

    // Insert event into database
    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        title,
        description: description || null,
        event_date,
        location: location || null,
        club_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create event', details: insertError.message },
        { status: 500 }
      );
    }

    // Apply Observer Pattern - trigger notifications
    const eventSubject = new EventSubject();

    // Example observers (in production, fetch actual user preferences)
    const emailNotifier = new EmailNotifier(user.email || 'user@asu.edu');
    const inAppNotifier = new InAppNotifier(user.id);

    eventSubject.attach(emailNotifier);
    eventSubject.attach(inAppNotifier);
    eventSubject.createEvent(title);

    // Apply Command Pattern (for future undo/redo functionality)
    // This demonstrates the pattern, though the actual state is in the database
    const eventStore: DesignPatternEvent[] = [];
    const designPatternEvent = toDesignPatternEvent(newEvent);
    const createCommand = new CreateEventCommand(designPatternEvent, eventStore);
    const invoker = new CommandInvoker();

    invoker.execute(createCommand);
    console.log('[COMMAND PATTERN] Event creation command executed');

    return NextResponse.json(
      {
        event: newEvent,
        message: 'Event created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
