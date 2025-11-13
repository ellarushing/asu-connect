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

    // Fetch all clubs with member counts
    const { data: clubs, error } = await supabase
      .from('clubs')
      .select(`
        *,
        club_members(count)
      `);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch clubs', details: error.message },
        { status: 500 }
      );
    }

    // Transform clubs to include member count
    const clubsWithCounts = (clubs || []).map((club: any) => ({
      ...club,
      member_count: club.club_members?.[0]?.count || 0,
      club_members: undefined, // Remove the nested array
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Club name is required' },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { error: 'Club name must be 255 characters or less' },
        { status: 400 }
      );
    }

    // Use Command Pattern to create club
    const createCommand = new CreateClubCommand(
      { name: name.trim(), description },
      user.id
    );

    const club = await createCommand.execute();

    return NextResponse.json(
      { club, message: 'Club created successfully' },
      { status: 201 }
    );

  } catch (error) {
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
