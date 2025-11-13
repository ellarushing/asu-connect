import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/events/route';

// Mock the Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Mock design patterns to avoid console.log noise in tests
jest.mock('@/lib/design-patterns', () => ({
  FilterByDate: jest.fn().mockImplementation(function () {
    this.filter = jest.fn((events) => events);
  }),
  FilterByName: jest.fn().mockImplementation(function () {
    this.filter = jest.fn((events) => [...events].sort((a, b) => a.name.localeCompare(b.name)));
  }),
  FilterByPopularity: jest.fn().mockImplementation(function () {
    this.filter = jest.fn((events) => events);
  }),
  EventFilterContext: jest.fn().mockImplementation(function (strategy) {
    this.strategy = strategy;
    this.setStrategy = jest.fn((s) => {
      this.strategy = s;
    });
    this.executeFilter = jest.fn((events) => this.strategy.filter(events));
  }),
  EventSubject: jest.fn().mockImplementation(function () {
    this.attach = jest.fn();
    this.detach = jest.fn();
    this.notify = jest.fn();
    this.createEvent = jest.fn();
    this.updateEvent = jest.fn();
  }),
  EmailNotifier: jest.fn(),
  InAppNotifier: jest.fn(),
  CreateEventCommand: jest.fn().mockImplementation(function () {
    this.execute = jest.fn();
    this.undo = jest.fn();
  }),
  CommandInvoker: jest.fn().mockImplementation(function () {
    this.execute = jest.fn();
    this.undo = jest.fn();
    this.redo = jest.fn();
  }),
}));

import { createClient } from '@/utils/supabase/server';

describe('Events API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // GET /api/events Tests
  // ============================================================================

  describe('GET /api/events', () => {
    test('returns list of events sorted by date', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Event 1',
          description: 'First event',
          event_date: '2025-01-10',
          location: 'Room 101',
          club_id: 'club1',
          created_by: 'user1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: '2',
          title: 'Event 2',
          description: 'Second event',
          event_date: '2025-01-15',
          location: 'Room 202',
          club_id: 'club1',
          created_by: 'user1',
          created_at: '2025-01-02',
          updated_at: '2025-01-02',
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEvents,
              error: null,
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events?sortBy=date');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(2);
      expect(data.sortBy).toBe('date');
    });

    test('returns events sorted by name', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Zebra Event',
          description: 'Event Z',
          event_date: '2025-01-10',
          location: 'Room 101',
          club_id: 'club1',
          created_by: 'user1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        {
          id: '2',
          title: 'Alpha Event',
          description: 'Event A',
          event_date: '2025-01-15',
          location: 'Room 202',
          club_id: 'club1',
          created_by: 'user1',
          created_at: '2025-01-02',
          updated_at: '2025-01-02',
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEvents,
              error: null,
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events?sortBy=name');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sortBy).toBe('name');
    });

    test('returns events sorted by popularity', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Popular Event',
          description: 'Event popular',
          event_date: '2025-01-10',
          location: 'Room 101',
          club_id: 'club1',
          created_by: 'user1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEvents,
              error: null,
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events?sortBy=popularity');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sortBy).toBe('popularity');
    });

    test('returns empty list when no events exist', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(0);
    });

    test('returns 500 error when database query fails', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch events');
    });

    test('defaults to date sorting when sortBy is not specified', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Event 1',
          description: 'First event',
          event_date: '2025-01-10',
          location: 'Room 101',
          club_id: 'club1',
          created_by: 'user1',
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
      ];

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockEvents,
              error: null,
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sortBy).toBe('date');
    });
  });

  // ============================================================================
  // POST /api/events Tests
  // ============================================================================

  describe('POST /api/events', () => {
    test('creates a new event successfully', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };
      const newEvent = {
        id: 'event1',
        title: 'New Event',
        description: 'A test event',
        event_date: '2025-01-20',
        location: 'Room 101',
        club_id: 'club1',
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
        from: jest.fn().mockImplementation((table) => {
          if (table === 'events') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: newEvent,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'club_members') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { role: 'admin' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Event',
          description: 'A test event',
          event_date: '2025-01-20',
          location: 'Room 101',
          club_id: 'club1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.event.title).toBe('New Event');
      expect(data.message).toBe('Event created successfully');
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

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Event',
          event_date: '2025-01-20',
          club_id: 'club1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 400 when required fields are missing', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Missing title and date',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    test('returns 403 when user is not club admin', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { role: 'member' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Event',
          event_date: '2025-01-20',
          club_id: 'club1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    test('returns 403 when user is not club member', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Event',
          event_date: '2025-01-20',
          club_id: 'club1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    test('allows optional fields (description and location)', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };
      const newEvent = {
        id: 'event1',
        title: 'Event without extras',
        description: null,
        event_date: '2025-01-20',
        location: null,
        club_id: 'club1',
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
        from: jest.fn().mockImplementation((table) => {
          if (table === 'events') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: newEvent,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'club_members') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { role: 'admin' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Event without extras',
          event_date: '2025-01-20',
          club_id: 'club1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.event.title).toBe('Event without extras');
    });

    test('returns 500 when event creation fails', async () => {
      const mockUser = { id: 'user123', email: 'user@asu.edu' };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table) => {
          if (table === 'events') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' },
                  }),
                }),
              }),
            };
          }
          if (table === 'club_members') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { role: 'admin' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Event',
          event_date: '2025-01-20',
          club_id: 'club1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create event');
    });
  });
});
