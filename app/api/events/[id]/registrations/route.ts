import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/lib/auth/admin';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  registered_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

/**
 * GET /api/events/[id]/registrations
 * Get all registrations for an event (event creator or admin only)
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: eventId } = await context.params;
    const supabase = await createClient();

    // Get current user
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

    // Get event details to check creator
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, created_by')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if current user is event creator OR admin
    const userIsAdmin = await isAdmin(user.id);
    const isEventCreator = event.created_by === user.id;

    if (!isEventCreator && !userIsAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only event creator or admin can view registrations' },
        { status: 403 }
      );
    }

    // Get registrations with user info
    let registrations: Registration[] = [];

    // First, fetch registrations
    const { data: registrationsData, error: fetchError } = await supabase
      .from('event_registrations')
      .select(`
        id,
        event_id,
        user_id,
        registered_at
      `)
      .eq('event_id', eventId)
      .order('registered_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch registrations: ${fetchError.message}`);
    }

    // Now enrich with profile data
    if (registrationsData && registrationsData.length > 0) {
      const userIds = registrationsData.map((reg: any) => reg.user_id);

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      // Map profiles to registrations
      registrations = registrationsData.map((reg: any) => {
        const profile = profilesData?.find((p: any) => p.id === reg.user_id);
        return {
          ...reg,
          profiles: profile ? { full_name: profile.full_name, email: profile.email } : null
        };
      });
    }

    return NextResponse.json({
      registrations,
      total_count: registrations.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
