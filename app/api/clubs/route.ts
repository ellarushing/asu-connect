import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

interface Club {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

interface ClubCreateInput {
  name: string;
  description?: string;
}

// ============================================================================
// STRATEGY PATTERN - Filtering Clubs
// ============================================================================

interface ClubFilterStrategy {
  filter(clubs: Club[]): Club[];
}

class FilterByName implements ClubFilterStrategy {
  filter(clubs: Club[]): Club[] {
    return [...clubs].sort((a, b) => a.name.localeCompare(b.name));
  }
}

class FilterByNewest implements ClubFilterStrategy {
  filter(clubs: Club[]): Club[] {
    return [...clubs].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

class FilterByOldest implements ClubFilterStrategy {
  filter(clubs: Club[]): Club[] {
    return [...clubs].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
}

class ClubFilterContext {
  private strategy: ClubFilterStrategy;

  constructor(strategy: ClubFilterStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: ClubFilterStrategy): void {
    this.strategy = strategy;
  }

  executeFilter(clubs: Club[]): Club[] {
    return this.strategy.filter(clubs);
  }
}

// ============================================================================
// COMMAND PATTERN - Creating Clubs
// ============================================================================

interface Command<T> {
  execute(): Promise<T>;
}

class CreateClubCommand implements Command<Club> {
  private clubData: ClubCreateInput;
  private userId: string;

  constructor(clubData: ClubCreateInput, userId: string) {
    this.clubData = clubData;
    this.userId = userId;
  }

  async execute(): Promise<Club> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('clubs')
      .insert({
        name: this.clubData.name,
        description: this.clubData.description || null,
        created_by: this.userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create club: ${error.message}`);
    }

    return data as Club;
  }
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/clubs
 * List all clubs with optional filtering
 *
 * Query parameters:
 * - sortBy: 'name' | 'newest' | 'oldest' (default: 'name')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') || 'name';

    // Validate sortBy parameter
    if (!['name', 'newest', 'oldest'].includes(sortBy)) {
      return NextResponse.json(
        { error: 'Invalid sortBy parameter', details: 'Must be "name", "newest", or "oldest"' },
        { status: 400 }
      );
    }

    // Fetch all clubs
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('*');

    if (clubsError) {
      console.error('Database error fetching clubs:', clubsError);
      return NextResponse.json(
        { error: 'Failed to fetch clubs', details: clubsError.message },
        { status: 500 }
      );
    }

    // If no clubs, return empty array
    if (!clubs) {
      return NextResponse.json({
        clubs: [],
        count: 0,
        sortBy,
      });
    }

    // Fetch member counts for all clubs in one query
    const { data: memberCounts, error: memberCountError } = await supabase
      .from('club_members')
      .select('club_id, count()');

    if (memberCountError) {
      console.error('Database error fetching member counts:', memberCountError);
      // Continue anyway - just use 0 as count
    }

    // Create a map of club_id to member count
    const memberCountMap = new Map<string, number>();
    if (memberCounts) {
      memberCounts.forEach((item: any) => {
        memberCountMap.set(item.club_id, item.count || 0);
      });
    }

    // Transform clubs to include member count
    const clubsWithCounts = clubs.map((club: any) => ({
      ...club,
      member_count: memberCountMap.get(club.id) || 0,
    }));

    // Apply Strategy Pattern for filtering
    let filterStrategy: ClubFilterStrategy;

    switch (sortBy) {
      case 'newest':
        filterStrategy = new FilterByNewest();
        break;
      case 'oldest':
        filterStrategy = new FilterByOldest();
        break;
      case 'name':
      default:
        filterStrategy = new FilterByName();
        break;
    }

    const filterContext = new ClubFilterContext(filterStrategy);
    const filteredClubs = filterContext.executeFilter(clubsWithCounts);

    return NextResponse.json({
      clubs: filteredClubs,
      count: filteredClubs.length,
      sortBy,
    });

  } catch (error) {
    console.error('Error in GET /api/clubs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clubs
 * Create a new club
 *
 * Body:
 * {
 *   "name": "Club Name",
 *   "description": "Optional description"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized', details: 'You must be logged in to create a club' },
        { status: 401 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body', details: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const { name, description } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation error', details: 'Club name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { error: 'Validation error', details: 'Club name must be 255 characters or less' },
        { status: 400 }
      );
    }

    if (description && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Validation error', details: 'Club description must be a string' },
        { status: 400 }
      );
    }

    if (description && description.length > 1000) {
      return NextResponse.json(
        { error: 'Validation error', details: 'Club description must be 1000 characters or less' },
        { status: 400 }
      );
    }

    // Use Command Pattern to create club
    const createCommand = new CreateClubCommand(
      { name: name.trim(), description: description?.trim() || null },
      user.id
    );

    const club = await createCommand.execute();

    return NextResponse.json(
      { club, message: 'Club created successfully' },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in POST /api/clubs:', error);

    if (error instanceof Error && error.message.includes('Failed to create club')) {
      return NextResponse.json(
        { error: 'Failed to create club', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
