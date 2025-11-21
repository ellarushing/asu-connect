import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/clubs/[id]/announcements
 * List all announcements for a club, sorted by created_at DESC
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId } = await context.params;
    const supabase = await createClient();

    // Fetch announcements
    const { data: announcements, error } = await supabase
      .from('club_announcements')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch announcements', details: error.message },
        { status: 500 }
      );
    }

    // Extract unique creator IDs
    const creatorIds = [...new Set((announcements || []).map(a => a.created_by))];

    // Fetch profiles for these creators
    let profiles: any[] = [];
    if (creatorIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', creatorIds);

      if (profilesError) {
        console.error('Database error fetching profiles:', profilesError);
      } else {
        profiles = profilesData || [];
      }
    }

    // Create lookup map for profiles
    const profileMap = Object.fromEntries(
      profiles.map(p => [p.id, p])
    );

    // Transform announcements to include profile information
    const transformedAnnouncements = (announcements || []).map((announcement: any) => ({
      ...announcement,
      profile: profileMap[announcement.created_by] || null,
    }));

    return NextResponse.json({
      announcements: transformedAnnouncements,
    });
  } catch (error) {
    console.error('Error in GET /api/clubs/[id]/announcements:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clubs/[id]/announcements
 * Create a new announcement for a club
 * Authorization is handled by RLS policies (platform admins, club admins, approved student leaders)
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId } = await context.params;
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
    const { title, content } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: title and content' },
        { status: 400 }
      );
    }

    // Validate title length (1-200 characters)
    if (typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 200) {
      return NextResponse.json(
        { error: 'Title must be between 1 and 200 characters' },
        { status: 400 }
      );
    }

    // Validate content length (1-5000 characters)
    if (typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 5000) {
      return NextResponse.json(
        { error: 'Content must be between 1 and 5000 characters' },
        { status: 400 }
      );
    }

    // Insert announcement - RLS policies will handle authorization
    const { data: announcement, error: insertError } = await supabase
      .from('club_announcements')
      .insert({
        club_id: clubId,
        created_by: user.id,
        title: title.trim(),
        content: content.trim(),
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a permission error
      if (insertError.code === '42501' || insertError.message.includes('permission')) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to create announcements for this club' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create announcement', details: insertError.message },
        { status: 500 }
      );
    }

    // Fetch the creator's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', user.id)
      .single();

    return NextResponse.json(
      {
        announcement: {
          ...announcement,
          profile: profile || null,
        },
        message: 'Announcement created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/clubs/[id]/announcements:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
