# Quick Start - Tests

Get started with testing ASU Connect in 3 steps.

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Run Tests
```bash
npm test
```

## Step 3: View Results
You should see:
```
Test Suites: 3 passed, 3 total
Tests:       46 passed, 46 total
```

---

## Common Commands

| Command | What it does |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests and re-run on file changes |
| `npm run test:coverage` | Generate coverage report |
| `npm test -- design-patterns.test.ts` | Run specific test file |
| `npm test -- -t "Strategy"` | Run tests matching name |

---

## Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `__tests__/design-patterns.test.ts` | 18 | Design patterns (Strategy, Observer, Command) |
| `__tests__/api/clubs.test.ts` | 14 | Clubs API (GET, POST) |
| `__tests__/api/events.test.ts` | 14 | Events API (GET, POST) |

---

## What's Tested

### Design Patterns (18 tests)
- Strategy Pattern: Sort by name, date, popularity
- Observer Pattern: Email/in-app notifications
- Command Pattern: Execute, undo, redo

### Clubs API (14 tests)
- GET: List, sort, empty list, errors
- POST: Create, auth, validate, errors

### Events API (14 tests)
- GET: List, sort, empty list, errors
- POST: Create, auth, authorization, errors

---

## Documentation

- **`TESTING_GUIDE.md`** - Complete testing guide
- **`TEST_SETUP_SUMMARY.md`** - Setup details
- **`__tests__/README.md`** - Test documentation
- **`__tests__/EXAMPLES.md`** - Code examples

---

## Total Tests

| Category | Count |
|----------|-------|
| Design Patterns | 18 |
| API Endpoints | 28 |
| **Total** | **46** |

---

## Success Criteria

All tests pass when you run `npm test`:
- ✓ 46 passed
- ✓ 0 failed
- ✓ 2-3 seconds execution time

---

## Need Help?

1. **Tests won't run**: `npm test -- --clearCache` then `npm install`
2. **Learn patterns**: Read `__tests__/EXAMPLES.md`
3. **Add more tests**: Copy existing test and modify
4. **Coverage report**: `npm run test:coverage`

---

## Next Steps

1. Run tests: `npm test`
2. Watch mode: `npm run test:watch`
3. Expand coverage: Add more test cases
4. CI/CD: Integrate tests into pipeline
5. Deploy: Tests run on every commit

---

**That's it!** You now have a working test suite for ASU Connect.
