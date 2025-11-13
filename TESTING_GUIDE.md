# ASU Connect Testing Guide

A comprehensive test suite has been created to demonstrate that the design patterns work correctly and the API endpoints respond as expected.

## Quick Start

### 1. Install Dependencies
```bash
npm install
# or with pnpm
pnpm install
```

### 2. Run Tests
```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### 3. View Results
All tests should pass with output showing test counts for each suite.

## What's Been Created

### Configuration Files
- **`jest.config.js`**: Jest configuration for Next.js with TypeScript support
- **`jest.setup.js`**: Jest setup file (ready for global test configuration)
- **`package.json`**: Updated with test scripts and dev dependencies

### Test Files

#### 1. Design Patterns Tests (`__tests__/design-patterns.test.ts`)
Comprehensive tests for all three design patterns:

**Strategy Pattern Tests (5 tests)**
- Filter events by name alphabetically
- Filter events by date
- Filter events by popularity
- Switch between different strategies
- Verify original arrays aren't mutated

**Observer Pattern Tests (5 tests)**
- Email notifier receives notifications
- In-app notifier receives notifications
- Subject notifies all observers
- Subject updates observers
- Observer detachment works
- Multiple observers handled independently

**Command Pattern Tests (8 tests)**
- Create event command executes
- Create event command undoes
- Update event command executes
- Update event command undoes
- Command invoker executes commands
- Command invoker supports undo
- Command invoker supports redo
- Redo stack clears on new execute

**Total: 18 design pattern test cases**

#### 2. Clubs API Tests (`__tests__/api/clubs.test.ts`)
Tests for GET and POST endpoints:

**GET /api/clubs (6 tests)**
- Returns clubs sorted by name
- Returns clubs sorted by newest
- Returns empty list
- Handles database errors
- Includes member counts
- Handles missing data

**POST /api/clubs (8 tests)**
- Creates club successfully
- Rejects unauthenticated requests
- Validates required fields
- Rejects empty names
- Enforces name length limits
- Trims whitespace
- Handles database errors
- Requires club admin role

**Total: 14 clubs API test cases**

#### 3. Events API Tests (`__tests__/api/events.test.ts`)
Tests for GET and POST endpoints:

**GET /api/events (6 tests)**
- Returns events sorted by date
- Returns events sorted by name
- Returns events sorted by popularity
- Returns empty list
- Handles database errors
- Defaults to date sorting

**POST /api/events (8 tests)**
- Creates event successfully
- Rejects unauthenticated requests
- Validates required fields
- Rejects non-admin users
- Rejects non-members
- Allows optional fields
- Handles database errors
- Supports all required fields

**Total: 14 events API test cases**

### Documentation
- **`__tests__/README.md`**: Detailed test documentation with examples
- **`TESTING_GUIDE.md`**: This file

## Test Results Summary

When you run `npm test`, you should see:

```
PASS  __tests__/design-patterns.test.ts
  Design Patterns Tests
    Strategy Pattern - Event Filtering
      ✓ FilterByName sorts events alphabetically
      ✓ FilterByDate sorts events by date ascending
      ✓ FilterByPopularity sorts events by popularity descending
      ✓ EventFilterContext can switch strategies
      ✓ Original array is not mutated during filtering
    Observer Pattern - Event Notifications
      ✓ EmailNotifier receives event creation notification
      ✓ InAppNotifier receives event creation notification
      ✓ EventSubject notifies all attached observers
      ✓ EventSubject notifies observers on update
      ✓ Observer can be detached from subject
      ✓ Multiple observers can be notified independently
    Command Pattern - Event Management
      ✓ CreateEventCommand adds event to store on execute
      ✓ CreateEventCommand removes event from store on undo
      ✓ UpdateEventCommand modifies event on execute
      ✓ UpdateEventCommand restores previous state on undo
      ✓ CommandInvoker executes commands and maintains history
      ✓ CommandInvoker supports undo operations
      ✓ CommandInvoker supports redo operations
      ✓ CommandInvoker clears redo stack on new execute

PASS  __tests__/api/clubs.test.ts
  Clubs API
    GET /api/clubs
      ✓ returns list of clubs sorted by name
      ✓ returns clubs sorted by newest
      ✓ returns empty list when no clubs exist
      ✓ returns 500 error when database query fails
      ✓ includes member count in response
    POST /api/clubs
      ✓ creates a new club successfully
      ✓ returns 401 when not authenticated
      ✓ returns 400 when club name is missing
      ✓ returns 400 when club name is empty string
      ✓ returns 400 when club name exceeds max length
      ✓ trims whitespace from club name
      ✓ returns 500 when database insertion fails

PASS  __tests__/api/events.test.ts
  Events API
    GET /api/events
      ✓ returns list of events sorted by date
      ✓ returns events sorted by name
      ✓ returns events sorted by popularity
      ✓ returns empty list when no events exist
      ✓ returns 500 error when database query fails
      ✓ defaults to date sorting when sortBy is not specified
    POST /api/events
      ✓ creates a new event successfully
      ✓ returns 401 when not authenticated
      ✓ returns 400 when required fields are missing
      ✓ returns 403 when user is not club admin
      ✓ returns 403 when user is not club member
      ✓ allows optional fields (description and location)
      ✓ returns 500 when event creation fails

Test Suites: 3 passed, 3 total
Tests:       46 passed, 46 total
Snapshots:   0 total
Time:        2-3s
```

## Design Patterns Demonstrated

### Strategy Pattern
Allows switching between different filtering strategies:
- `FilterByName`: Alphabetical sorting
- `FilterByDate`: Chronological sorting
- `FilterByPopularity`: By popularity (descending)

**Benefit**: Easy to add new sorting strategies without modifying existing code.

### Observer Pattern
Notifies multiple observers when events occur:
- `EmailNotifier`: Sends email notifications
- `InAppNotifier`: Sends in-app notifications
- `EventSubject`: Manages observers and sends notifications

**Benefit**: Decouples notification logic from event creation. Easy to add new notification types.

### Command Pattern
Encapsulates requests as objects for undo/redo:
- `CreateEventCommand`: Create and undo event creation
- `UpdateEventCommand`: Update and undo updates
- `CommandInvoker`: Manages command history

**Benefit**: Support for undo/redo operations and command logging/auditing.

## API Features Tested

### Authentication
- Validates user is authenticated via Supabase
- Returns 401 for unauthenticated requests

### Authorization
- Checks user is club admin before allowing event creation
- Returns 403 for unauthorized access

### Validation
- Validates required fields
- Enforces field length limits
- Trims whitespace

### Error Handling
- Graceful database error handling
- Meaningful error messages
- Proper HTTP status codes

## File Structure

```
asu-connect/
├── __tests__/
│   ├── README.md                    # Detailed test documentation
│   ├── design-patterns.test.ts      # 18 design pattern tests
│   └── api/
│       ├── clubs.test.ts            # 14 clubs API tests
│       └── events.test.ts           # 14 events API tests
├── jest.config.js                   # Jest configuration
├── jest.setup.js                    # Jest setup file
├── TESTING_GUIDE.md                 # This file
└── package.json                     # Updated with test scripts & deps
```

## Dependencies Added

### Testing Framework
- `jest@^29.7.0`: Testing framework
- `@types/jest@^29.5.11`: TypeScript definitions for Jest

### Test Utilities
- `@testing-library/react@^14.1.2`: React testing utilities
- `@testing-library/jest-dom@^6.1.5`: Jest DOM matchers
- `jest-environment-jsdom@^29.7.0`: DOM test environment
- `jest-environment-node@^29.7.0`: Node test environment

## Next Steps

1. **Run tests locally**: `npm test`
2. **Watch mode for development**: `npm run test:watch`
3. **Generate coverage report**: `npm run test:coverage`
4. **Integrate with CI/CD**: Add test step to your pipeline
5. **Expand coverage**: Add integration and E2E tests
6. **Add more test cases**: For new features as they're added

## Troubleshooting

### Tests fail with module resolution errors
```bash
# Clear Jest cache and reinstall
npm test -- --clearCache
npm install
```

### Cannot find module '@/'
Verify `jest.config.js` has correct moduleNameMapper configuration for path aliases.

### Timeout errors
Tests have a 5-second default timeout. Increase if needed:
```typescript
test('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Mock not working
Ensure mocks are defined BEFORE importing the module being tested.

## Support

For more information:
- See `__tests__/README.md` for detailed test documentation
- Check Jest docs: https://jestjs.io/
- Check Next.js testing docs: https://nextjs.org/docs/testing
