# Test Examples & Patterns

This document shows examples of how the tests work and the patterns used.

## Design Patterns Test Examples

### Strategy Pattern Example

```typescript
test('FilterByName sorts events alphabetically', () => {
  // Arrange: Create test data
  const mockEvents: Event[] = [
    { id: '1', name: 'Event C', date: new Date('2025-01-15'), popularity: 50 },
    { id: '2', name: 'Event A', date: new Date('2025-01-10'), popularity: 100 },
    { id: '3', name: 'Event B', date: new Date('2025-01-20'), popularity: 75 },
  ];

  // Act: Create strategy and filter
  const strategy = new FilterByName();
  const filtered = strategy.filter(mockEvents);

  // Assert: Verify alphabetical order
  expect(filtered[0].name).toBe('Event A');
  expect(filtered[1].name).toBe('Event B');
  expect(filtered[2].name).toBe('Event C');
});
```

**What it tests**: That the Strategy Pattern can be used to sort events by name.

### Observer Pattern Example

```typescript
test('EventSubject notifies all attached observers', () => {
  // Setup: Spy on console.log to verify notifications
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  // Arrange: Create subject and observers
  const subject = new EventSubject();
  const emailNotifier = new EmailNotifier('test@asu.edu');
  const inAppNotifier = new InAppNotifier('user123');

  subject.attach(emailNotifier);
  subject.attach(inAppNotifier);

  // Act: Create event (triggers notifications)
  subject.createEvent('Tech Meetup');

  // Assert: Verify both observers were notified
  expect(consoleSpy).toHaveBeenCalledTimes(2);
  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('New event created: Tech Meetup')
  );

  // Cleanup
  consoleSpy.mockRestore();
});
```

**What it tests**: That the Observer Pattern notifies all subscribed observers.

### Command Pattern Example

```typescript
test('CommandInvoker supports undo and redo operations', () => {
  // Arrange: Create invoker and event store
  const invoker = new CommandInvoker();
  const eventStore: Event[] = [];
  const event: Event = {
    id: '1',
    name: 'Conference',
    date: new Date(),
    popularity: 0,
  };

  // Act: Execute command
  const command = new CreateEventCommand(event, eventStore);
  invoker.execute(command);

  // Assert: Event was added
  expect(eventStore.length).toBe(1);

  // Act: Undo
  invoker.undo();

  // Assert: Event was removed
  expect(eventStore.length).toBe(0);

  // Act: Redo
  invoker.redo();

  // Assert: Event was re-added
  expect(eventStore.length).toBe(1);
});
```

**What it tests**: That the Command Pattern supports execute, undo, and redo.

## API Test Examples

### GET Endpoint Example

```typescript
test('returns list of clubs sorted by name', async () => {
  // Arrange: Mock Supabase response
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

  // Act: Make API request
  const request = new NextRequest('http://localhost:3000/api/clubs?sortBy=name');
  const response = await GET(request);
  const data = await response.json();

  // Assert: Verify response
  expect(response.status).toBe(200);
  expect(data.clubs).toHaveLength(2);
  expect(data.sortBy).toBe('name');
  expect(data.count).toBe(2);
});
```

**What it tests**: That GET /api/clubs returns proper response with correct structure.

### POST Endpoint Example

```typescript
test('creates a new club successfully', async () => {
  // Arrange: Mock authenticated user
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

  // Act: Make POST request
  const request = new NextRequest('http://localhost:3000/api/clubs', {
    method: 'POST',
    body: JSON.stringify({
      name: 'New Club',
      description: 'A test club',
    }),
  });

  const response = await POST(request);
  const data = await response.json();

  // Assert: Verify success response
  expect(response.status).toBe(201);
  expect(data.club.name).toBe('New Club');
  expect(data.message).toBe('Club created successfully');
});
```

**What it tests**: That POST /api/clubs creates a club and returns 201 status.

### Error Handling Example

```typescript
test('returns 401 when not authenticated', async () => {
  // Arrange: Mock unauthenticated state
  const mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      }),
    },
  };

  (createClient as jest.Mock).mockResolvedValue(mockSupabase);

  // Act: Make POST request without auth
  const request = new NextRequest('http://localhost:3000/api/clubs', {
    method: 'POST',
    body: JSON.stringify({
      name: 'New Club',
    }),
  });

  const response = await POST(request);
  const data = await response.json();

  // Assert: Verify 401 response
  expect(response.status).toBe(401);
  expect(data.error).toBe('Unauthorized');
});
```

**What it tests**: That API properly handles authentication errors.

### Validation Example

```typescript
test('returns 400 when club name exceeds max length', async () => {
  // Arrange: Mock authenticated user
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

  // Create name that exceeds 255 character limit
  const longName = 'a'.repeat(300);

  // Act: Make POST request with invalid data
  const request = new NextRequest('http://localhost:3000/api/clubs', {
    method: 'POST',
    body: JSON.stringify({
      name: longName,
    }),
  });

  const response = await POST(request);
  const data = await response.json();

  // Assert: Verify 400 response for validation error
  expect(response.status).toBe(400);
  expect(data.error).toContain('255 characters or less');
});
```

**What it tests**: That API validates input fields and returns proper error.

## Common Test Patterns

### Setup and Teardown

```typescript
describe('Feature Tests', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup if needed
    jest.restoreAllMocks();
  });

  test('some test', () => {
    // test code
  });
});
```

**Pattern**: Reset all mocks between tests to prevent test pollution.

### Mocking External Services

```typescript
// Mock entire module
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// In test: Configure mock for specific test
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  }),
};

(createClient as jest.Mock).mockResolvedValue(mockSupabase);
```

**Pattern**: Mock at module level, configure per test.

### Testing Immutability

```typescript
test('original array is not mutated during filtering', () => {
  const original = [...mockEvents];

  // Make a copy to compare against later
  const strategy = new FilterByName();
  strategy.filter(mockEvents);

  // Verify original order is unchanged
  expect(mockEvents[0].name).toBe(original[0].name);
  expect(mockEvents[1].name).toBe(original[1].name);
});
```

**Pattern**: Verify that functions don't mutate input data.

### Testing Multiple Cases

```typescript
test.each([
  ['name', 'filtered by name'],
  ['date', 'filtered by date'],
  ['popularity', 'filtered by popularity'],
])('filters events %s', (sortBy, description) => {
  const request = new NextRequest(
    `http://localhost:3000/api/events?sortBy=${sortBy}`
  );
  // ... rest of test
});
```

**Pattern**: Use `test.each()` to test multiple similar cases.

## Running Specific Tests

```bash
# Run single test file
npm test -- design-patterns.test.ts

# Run single test suite
npm test -- -t "Strategy Pattern"

# Run single test case
npm test -- -t "FilterByName sorts"

# Watch mode for single file
npm test -- --watch design-patterns.test.ts
```

## Debugging Tests

### Add debug output
```typescript
test('debug example', () => {
  const result = someFunction();
  console.log('Result:', JSON.stringify(result, null, 2));
  expect(result).toBe(expected);
});
```

### Use debugger
```typescript
test('debug with debugger', () => {
  debugger; // Execution pauses here when using --inspect
  const result = someFunction();
  expect(result).toBe(expected);
});

// Run with: node --inspect-brk node_modules/.bin/jest --runInBand
```

### Print test name
```typescript
test('test name', ({ title }) => {
  console.log(`Running: ${title}`);
  // test code
});
```

## Assertion Examples

```typescript
// String assertions
expect(value).toBe('exact string');
expect(value).toContain('substring');
expect(value).toMatch(/regex/);

// Number assertions
expect(value).toBe(42);
expect(value).toBeGreaterThan(40);
expect(value).toBeLessThan(50);

// Array assertions
expect(array).toHaveLength(3);
expect(array).toContain(item);
expect(array[0]).toBe(value);

// Object assertions
expect(object).toEqual({ key: 'value' });
expect(object).toHaveProperty('key');

// Function assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(2);

// Promise assertions
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Tips for Writing Better Tests

1. **One assertion per test**: Each test should verify one behavior
2. **Clear test names**: `test('returns 401 when not authenticated', ...)`
3. **Use Arrange-Act-Assert**: Organize code into three sections
4. **Mock at boundaries**: Mock external services, test internal logic
5. **Test both happy path and errors**: Happy path + error cases + edge cases
6. **Keep tests isolated**: No test should depend on another
7. **Use fixtures for common data**: Reuse mock data across tests
8. **Test behavior, not implementation**: Focus on what, not how
