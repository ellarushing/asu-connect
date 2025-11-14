# Database Field Mismatch Analysis

## Executive Summary

The API routes are trying to use database fields that don't exist in the base schema. This will cause runtime errors if the migration scripts haven't been applied to Supabase.

**Critical Fields Missing from Base Schema:**
1. `events.category` - Added in migration 003
2. `events.is_free` - Added in migration 003
3. `events.price` - Added in migration 003
4. `club_members.status` - Added in APPLY_THIS_TO_SUPABASE.sql

---

## Detailed Findings

### 1. Events API Route (`/app/api/events/route.ts`)

**Problem**: The POST endpoint tries to insert `category`, `is_free`, and `price` fields that don't exist in the base schema.

**Lines 148, 209-211**:
```typescript
const { title, description, event_date, location, club_id, category, is_free, price } = body;

// Later in INSERT:
category: category || null,
is_free: isFree,
price: !isFree && price ? price : null,
```

**Impact**:
- POST /api/events will fail with Supabase error: "column 'category' does not exist"
- GET /api/events filtering by category/pricing (lines 59-68) will also fail

**Dependencies**: Requires migration `003_add_event_categories_pricing.sql` to be applied.

---

### 2. Club Membership API Route (`/app/api/clubs/[id]/membership/route.ts`)

**Problem**: Multiple endpoints query and write to the `status` field which doesn't exist in base schema.

**Lines with status field usage:**
- Line 12: TypeScript interface defines `status: string`
- Line 42: `SELECT 'role, status'` - reads status field
- Line 89: `SELECT 'role, status'` - reads status field
- Line 95: Checks `if (existingMembership.status === 'pending')`
- Line 114: `INSERT ... status: 'pending'` - writes status field
- Line 116: `SELECT 'role, status'` - reads status field
- Line 202: `UPDATE { status: newStatus }` - writes status field
- Line 205: `.eq('status', 'pending')` - filters by status

**Impact**:
- GET /api/clubs/[id]/membership will fail
- POST /api/clubs/[id]/membership will fail with "column 'status' does not exist"
- PATCH /api/clubs/[id]/membership will fail
- All membership features are broken without this field

**Dependencies**: Requires `APPLY_THIS_TO_SUPABASE.sql` to be applied (lines 393-398).

---

### 3. Pending Membership API Route (`/app/api/clubs/[id]/membership/pending/route.ts`)

**Problem**: Queries the `status` field for filtering pending requests.

**Lines with status field usage:**
- Line 14: TypeScript interface defines `status: string`
- Line 68: `SELECT '..., status, ...'` - reads status field
- Line 76: `.eq('status', 'pending')` - filters by status

**Impact**:
- GET /api/clubs/[id]/membership/pending will fail
- Club admins cannot view pending membership requests

**Dependencies**: Requires `APPLY_THIS_TO_SUPABASE.sql` to be applied.

---

## Migration Dependencies

### Base Schema (001_initial_schema.sql)
✅ **Already Applied** (based on git history)
- Creates: clubs, events, club_members, event_registrations tables
- **DOES NOT** include: category, is_free, price, status fields

### Migration 003 (003_add_event_categories_pricing.sql)
❓ **Status Unknown**
- Adds: events.category, events.is_free, events.price
- Required by: Events API filtering and creation

### APPLY_THIS_TO_SUPABASE.sql
❓ **Status Unknown**
- Comprehensive migration that includes:
  - All base tables
  - Event filters (category, is_free, price)
  - Event flagging system (event_flags table)
  - **Club membership approval (status column)**
- This is the "complete setup" script

---

## Recommended Solutions

### Option 1: Make API Code Resilient (Immediate Fix)

Modify the API routes to handle missing fields gracefully. This allows the app to work even if migrations aren't applied yet.

#### Changes for `/app/api/events/route.ts`:

**1. Make GET endpoint resilient to missing filter fields:**

```typescript
// Line 56-68: Wrap in try-catch and make filters optional
try {
  // Apply category filter - only if column exists
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  // Apply pricing filter - only if columns exist
  if (pricing === 'free') {
    query = query.eq('is_free', true);
  } else if (pricing === 'paid') {
    query = query.eq('is_free', false);
  }
} catch (filterError) {
  console.warn('Filter columns may not exist yet. Skipping filters.', filterError);
  // Continue without filters
}
```

**2. Make POST endpoint only use new fields if they exist:**

```typescript
// Line 200-212: Conditionally insert new fields
const insertData: any = {
  title,
  description: description || null,
  event_date,
  location: location || null,
  club_id,
  created_by: user.id,
};

// Only add new fields if they were provided (assumes migration was run)
if (category !== undefined) {
  insertData.category = category || null;
}
if (is_free !== undefined) {
  insertData.is_free = isFree;
}
if (price !== undefined && !isFree) {
  insertData.price = price;
}

const { data: newEvent, error: insertError } = await supabase
  .from('events')
  .insert(insertData)
  .select()
  .single();
```

#### Changes for `/app/api/clubs/[id]/membership/route.ts`:

**1. Make GET endpoint handle missing status field:**

```typescript
// Line 40-45: Select only if status exists, otherwise return null
const { data: membership } = await supabase
  .from('club_members')
  .select('role, status')  // Keep this
  .eq('club_id', clubId)
  .eq('user_id', user.id)
  .maybeSingle();  // Use maybeSingle() instead of single() to avoid error

// Add fallback for missing status
if (membership && !('status' in membership)) {
  membership.status = 'approved';  // Default legacy memberships to approved
}

return NextResponse.json({
  membership: membership || null,
});
```

**2. Make POST endpoint handle missing status field:**

```typescript
// Line 108-117: Conditionally include status
const insertData: any = {
  club_id: clubId,
  user_id: user.id,
  role: 'member',
};

// Only set status if the column exists (check if migration was applied)
// For now, always try to set it but handle the error gracefully
try {
  insertData.status = 'pending';

  const { data: membership, error: insertError } = await supabase
    .from('club_members')
    .insert(insertData)
    .select('role, status')
    .single();

  if (insertError) throw insertError;

  return NextResponse.json({
    membership,
    message: 'Membership request submitted successfully',
  }, { status: 201 });
} catch (error) {
  // If status column doesn't exist, try without it
  if (error.message?.includes('status')) {
    delete insertData.status;
    const { data: membership, error: retryError } = await supabase
      .from('club_members')
      .insert(insertData)
      .select('role')
      .single();

    if (retryError) throw retryError;

    return NextResponse.json({
      membership: { ...membership, status: 'approved' },
      message: 'Successfully joined club',
    }, { status: 201 });
  }
  throw error;
}
```

**3. Make PATCH endpoint handle missing status field:**

Similar pattern - wrap in try-catch and provide fallback behavior.

---

### Option 2: Schema Validation on Startup (Preventive)

Create a startup check that verifies required database columns exist before the app starts.

**Create `/lib/database-check.ts`:**

```typescript
import { createClient } from '@/utils/supabase/server';

interface SchemaRequirement {
  table: string;
  columns: string[];
  description: string;
}

const REQUIRED_SCHEMA: SchemaRequirement[] = [
  {
    table: 'events',
    columns: ['category', 'is_free', 'price'],
    description: 'Event filtering and pricing features',
  },
  {
    table: 'club_members',
    columns: ['status'],
    description: 'Club membership approval workflow',
  },
];

export async function checkDatabaseSchema(): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const supabase = await createClient();

    for (const requirement of REQUIRED_SCHEMA) {
      // Query information_schema to check if columns exist
      const { data, error } = await supabase.rpc('check_columns', {
        table_name: requirement.table,
        column_names: requirement.columns,
      });

      if (error) {
        warnings.push(
          `Unable to verify schema for ${requirement.table}: ${error.message}`
        );
        continue;
      }

      const missingColumns = requirement.columns.filter(
        (col) => !data?.includes(col)
      );

      if (missingColumns.length > 0) {
        errors.push(
          `Missing columns in ${requirement.table}: ${missingColumns.join(', ')} (required for: ${requirement.description})`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      errors: ['Failed to perform database schema check'],
      warnings: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
```

**Add SQL function in Supabase:**

```sql
-- Run this in Supabase SQL Editor
CREATE OR REPLACE FUNCTION check_columns(table_name TEXT, column_names TEXT[])
RETURNS TEXT[] AS $$
DECLARE
  existing_columns TEXT[];
BEGIN
  SELECT ARRAY_AGG(column_name::TEXT)
  INTO existing_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = table_name
    AND column_name = ANY(column_names);

  RETURN existing_columns;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Add to root layout (`/app/layout.tsx`):**

```typescript
import { checkDatabaseSchema } from '@/lib/database-check';

export default async function RootLayout({ children }) {
  // Check schema on app start
  if (process.env.NODE_ENV === 'development') {
    const schemaCheck = await checkDatabaseSchema();

    if (!schemaCheck.valid) {
      console.error('❌ DATABASE SCHEMA ERRORS:');
      schemaCheck.errors.forEach((err) => console.error(`  - ${err}`));
      console.error('\n⚠️  Please run the following migrations:');
      console.error('  1. supabase/migrations/003_add_event_categories_pricing.sql');
      console.error('  2. Apply the membership status column from APPLY_THIS_TO_SUPABASE.sql');
    }

    if (schemaCheck.warnings.length > 0) {
      console.warn('⚠️  DATABASE SCHEMA WARNINGS:');
      schemaCheck.warnings.forEach((warn) => console.warn(`  - ${warn}`));
    }
  }

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

### Option 3: Clear Migration Instructions (Documentation)

Create a clear migration guide for developers.

**Create `/MIGRATION_GUIDE.md`:**

```markdown
# Database Migration Guide

## Required Migrations

Before running the application, you MUST apply these database migrations in Supabase:

### Step 1: Apply Event Features Migration

Location: `supabase/migrations/003_add_event_categories_pricing.sql`

This adds:
- Event category filtering
- Free/paid event pricing
- Price field for paid events

**How to apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/003_add_event_categories_pricing.sql`
3. Copy the entire contents
4. Paste and run in SQL Editor

### Step 2: Apply Membership Approval Feature

Location: `APPLY_THIS_TO_SUPABASE.sql` (lines 393-431)

This adds:
- `status` column to `club_members` table
- Approval workflow (pending/approved/rejected)
- Updated RLS policies

**How to apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy lines 393-431 from `APPLY_THIS_TO_SUPABASE.sql`
3. Paste and run in SQL Editor

### Verification

After applying migrations, verify with this SQL:

```sql
-- Check events table has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name IN ('category', 'is_free', 'price');

-- Check club_members has status column
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'club_members'
AND column_name = 'status';
```

You should see all 4 columns listed.

## What Happens If Migrations Aren't Applied?

The following features will fail:
- ❌ Creating events with categories or pricing
- ❌ Filtering events by category or price
- ❌ Club membership approval workflow
- ❌ Viewing pending membership requests
- ❌ Joining clubs (will fail to set status)

## Emergency Rollback

If you need to rollback these features:

```sql
-- Remove event features
ALTER TABLE public.events
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS is_free,
  DROP COLUMN IF EXISTS price;

-- Remove membership approval
ALTER TABLE public.club_members
  DROP COLUMN IF EXISTS status;
```

Then update API code to not use these fields.
```

---

## Recommended Action Plan

1. **Immediate (Before next deployment):**
   - ✅ Verify which migrations have been applied to Supabase
   - ✅ Apply missing migrations (003 and status column)
   - ✅ Test all API endpoints

2. **Short-term (This sprint):**
   - ✅ Add Option 1 resilient code changes as a safety measure
   - ✅ Create MIGRATION_GUIDE.md for team reference

3. **Long-term (Next sprint):**
   - ✅ Implement Option 2 schema validation
   - ✅ Add automated migration checks to CI/CD
   - ✅ Consider using a migration tool like Prisma or Drizzle

---

## Testing Checklist

After applying migrations, test these endpoints:

### Events API
- [ ] GET /api/events - Should return all events
- [ ] GET /api/events?category=Academic - Should filter by category
- [ ] GET /api/events?pricing=free - Should filter by free events
- [ ] POST /api/events - Should create event with category and pricing

### Membership API
- [ ] GET /api/clubs/[id]/membership - Should return membership with status
- [ ] POST /api/clubs/[id]/membership - Should create pending membership
- [ ] PATCH /api/clubs/[id]/membership - Should approve/reject membership
- [ ] GET /api/clubs/[id]/membership/pending - Should list pending requests

---

## File Reference

**API Routes:**
- `/Users/ellarushing/Downloads/asu-connect/app/api/events/route.ts`
- `/Users/ellarushing/Downloads/asu-connect/app/api/clubs/[id]/membership/route.ts`
- `/Users/ellarushing/Downloads/asu-connect/app/api/clubs/[id]/membership/pending/route.ts`

**Migration Files:**
- `/Users/ellarushing/Downloads/asu-connect/supabase/migrations/001_initial_schema.sql` (base)
- `/Users/ellarushing/Downloads/asu-connect/supabase/migrations/003_add_event_categories_pricing.sql` (events)
- `/Users/ellarushing/Downloads/asu-connect/APPLY_THIS_TO_SUPABASE.sql` (comprehensive)

**Schema Documentation:**
- Base schema: Lines 1-224 in 001_initial_schema.sql
- Event features: Lines 1-17 in 003_add_event_categories_pricing.sql
- Membership status: Lines 393-431 in APPLY_THIS_TO_SUPABASE.sql
