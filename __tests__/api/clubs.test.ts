import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/clubs/route';

// Mock the Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';

describe('Clubs API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // GET /api/clubs Tests
  // ============================================================================

  describe('GET /api/clubs', () => {
    test('returns list of clubs sorted by name', async () => {
      const mockClubs = [
        {
          id: '1',
          name: 'Alpha Club',
          description: 'First club',
          created_by: 'user1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          club_members: [{ count: 5 }],
        },
        {
          id: '2',
          name: 'Beta Club',
          description: 'Second club',
          created_by: 'user2',
          created_at: '2025-01-02',
          updated_at: '2025-01-02',
          club_members: [{ count: 10 }],
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: mockClubs,
            error: null,
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs?sortBy=name');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.clubs).toHaveLength(2);
      expect(data.sortBy).toBe('name');
      expect(data.count).toBe(2);
    });

    test('returns clubs sorted by newest', async () => {
      const mockClubs = [
        {
          id: '1',
          name: 'Older Club',
          description: 'Created first',
          created_by: 'user1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          club_members: [{ count: 5 }],
        },
        {
          id: '2',
          name: 'Newer Club',
          description: 'Created second',
          created_by: 'user2',
          created_at: '2025-01-05',
          updated_at: '2025-01-05',
          club_members: [{ count: 10 }],
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: mockClubs,
            error: null,
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs?sortBy=newest');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sortBy).toBe('newest');
      // Newest first means Newer Club should come first
      expect(data.clubs[0].name).toBe('Newer Club');
    });

    test('returns empty list when no clubs exist', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.clubs).toHaveLength(0);
      expect(data.count).toBe(0);
    });

    test('returns 500 error when database query fails', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch clubs');
    });

    test('includes member count in response', async () => {
      const mockClubs = [
        {
          id: '1',
          name: 'Large Club',
          description: 'Many members',
          created_by: 'user1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
          club_members: [{ count: 50 }],
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: mockClubs,
            error: null,
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs');
      const response = await GET(request);
      const data = await response.json();

      expect(data.clubs[0].member_count).toBe(50);
    });
  });

  // ============================================================================
  // POST /api/clubs Tests
  // ============================================================================

  describe('POST /api/clubs', () => {
    test('creates a new club successfully', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };
      const newClub = {
        id: 'club1',
        name: 'New Club',
        description: 'A test club',
        created_by: 'user123',
        created_at: '2025-01-10',
        updated_at: '2025-01-10',
      };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: newClub,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Club',
          description: 'A test club',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.club.name).toBe('New Club');
      expect(data.club.description).toBe('A test club');
      expect(data.message).toBe('Club created successfully');
    });

    test('returns 401 when not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
          }),
        },
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Club',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 400 when club name is missing', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          description: 'A club without a name',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Club name is required');
    });

    test('returns 400 when club name is empty string', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: '   ',
          description: 'A test club',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Club name is required');
    });

    test('returns 400 when club name exceeds max length', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const longName = 'a'.repeat(300);

      const request = new NextRequest('http://localhost:3000/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: longName,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('255 characters or less');
    });

    test('trims whitespace from club name', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };
      const newClub = {
        id: 'club1',
        name: 'Trimmed Club',
        description: null,
        created_by: 'user123',
        created_at: '2025-01-10',
        updated_at: '2025-01-10',
      };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: newClub,
                error: null,
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: '  Trimmed Club  ',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.club.name).toBe('Trimmed Club');
    });

    test('returns 500 when database insertion fails', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Duplicate key' },
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Club',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create club');
    });
  });
});
