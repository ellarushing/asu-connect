# ASU Connect Test Suite

This directory contains comprehensive tests for the ASU Connect project, demonstrating that the design patterns (Strategy, Observer, and Command patterns) work correctly and that the API endpoints respond as expected.

## Test Files

### 1. `design-patterns.test.ts`
Tests for the core design patterns implemented in `/lib/design-patterns.ts`.

**Coverage:**
- **Strategy Pattern**: Verifies filtering/sorting strategies work correctly
  - `FilterByName`: Alphabetical sorting
  - `FilterByDate`: Date-based sorting
  - `FilterByPopularity`: Popularity-based sorting
  - `EventFilterContext`: Context switching between strategies
  - Immutability: Original arrays aren't mutated during filtering

- **Observer Pattern**: Validates notification system
  - `EmailNotifier`: Receives and logs email notifications
  - `InAppNotifier`: Receives and logs in-app notifications
  - `EventSubject`: Notifies all attached observers
  - Observer attachment/detachment
  - Multiple observers handling

- **Command Pattern**: Tests undo/redo functionality
  - `CreateEventCommand`: Add and remove events
  - `UpdateEventCommand`: Modify and restore event state
  - `CommandInvoker`: Execute, undo, and redo operations
  - History stack management

### 2. `api/clubs.test.ts`
Tests for the Clubs API endpoint (`/app/api/clubs/route.ts`).

**Coverage:**
- **GET /api/clubs**
  - List clubs with default sorting
  - Sort by name, newest, oldest
  - Handle empty club lists
  - Include member counts
  - Error handling

- **POST /api/clubs**
  - Create new club successfully
  - Authentication validation
  - Input validation (name required, length limits)
  - Whitespace trimming
  - Error handling

### 3. `api/events.test.ts`
Tests for the Events API endpoint (`/app/api/events/route.ts`).

**Coverage:**
- **GET /api/events**
  - List events with default sorting
  - Sort by date, name, popularity
  - Handle empty event lists
  - Error handling

- **POST /api/events**
  - Create new event successfully
  - Authentication validation
  - Authorization (admin check)
  - Required field validation
  - Optional fields handling
  - Error handling

## Running Tests

### Install Dependencies
```bash
npm install
# or
pnpm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- design-patterns.test.ts
npm test -- api/clubs.test.ts
npm test -- api/events.test.ts
```

## Test Architecture

### Mocking Strategy
- **Supabase**: All Supabase client calls are mocked to return predictable test data
- **Design Patterns**: In API tests, design patterns are mocked to isolate API logic
- **Console**: Console.log is spied on in design pattern tests to verify logging

### Test Structure
Each test file follows this pattern:
1. **Setup**: Mock external dependencies
2. **Test**: Execute the code under test
3. **Verify**: Assert expected outcomes

### Example Test
```typescript
test('FilterByName sorts events alphabetically', () => {
  const mockEvents = [
    { id: '1', name: 'Event C', ... },
    { id: '2', name: 'Event A', ... },
  ];

  const strategy = new FilterByName();
  const filtered = strategy.filter(mockEvents);

  expect(filtered[0].name).toBe('Event A');
  expect(filtered[1].name).toBe('Event C');
});
```

## What the Tests Demonstrate

### Design Patterns Work
- Strategy Pattern correctly switches between filtering strategies
- Observer Pattern notifies all subscribers of events
- Command Pattern supports execute, undo, and redo operations

### APIs Are Well-Structured
- Proper HTTP status codes (200, 201, 400, 401, 403, 500)
- Input validation for required fields
- Proper error handling with meaningful messages
- Authentication and authorization checks

### Data Handling
- Immutable filtering (original arrays aren't modified)
- Proper data transformations (database format to API format)
- Whitespace trimming
- Optional field handling

## Coverage

Current test suite includes:
- 6 design pattern test suites (18+ test cases)
- 2 API test suites (24+ test cases)
- Total: 42+ test cases

## Common Issues & Debugging

### Tests Won't Run
```bash
# Clear Jest cache
npm test -- --clearCache

# Install dependencies
npm install
```

### Mock Issues
If mocks aren't working:
1. Verify mock paths match actual file paths
2. Check that mocks are defined before imports
3. Clear Jest cache and reinstall

### Timeout Issues
Tests have default 5-second timeout. For slower operations:
```typescript
test('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

## Extending Tests

To add new tests:

1. **For new design patterns**:
   - Add test suite to `design-patterns.test.ts`
   - Test the pattern's key behaviors
   - Verify immutability and isolation

2. **For new API endpoints**:
   - Create new file in `__tests__/api/`
   - Mock Supabase responses
   - Test happy paths and error cases
   - Include validation tests

3. **Example template**:
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should do something', () => {
    // Arrange
    const input = ...;

    // Act
    const result = ...;

    // Assert
    expect(result).toBe(...);
  });
});
```

## Next Steps

- Increase coverage to 80%+
- Add integration tests
- Add E2E tests with real database
- Performance benchmarking
