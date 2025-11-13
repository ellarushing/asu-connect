# RLS Policy Changes - Side-by-Side Reference

## Quick Reference: What Changed

| Policy Name | Problem | Fix | Impact |
|---|---|---|---|
| Club admins can add members | Recursive query on club_members | Query clubs table instead | Only club creator can add members |
| Club admins can update member roles | Recursive query on club_members | Query clubs table instead | Only club creator can update roles |
| Club admins can remove members | Recursive query on club_members | Query clubs table instead | Only club creator can remove members |
| Authenticated users can create events | Recursive query on club_members | Query clubs table instead | Only club creator can create events |

---

## Policy 1: Adding Members to Clubs

### BEFORE (BROKEN - Recursive)
```sql
CREATE POLICY "Club admins can add members"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_members.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

**Problem**: Queries `club_members` to check if user is admin → triggers this same policy → infinite recursion

### AFTER (FIXED - Non-recursive)
```sql
CREATE POLICY "Club creators can add members"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );
```

**Solution**: Queries `clubs` table instead → clubs table RLS is simple → no recursion

**Who Can Do This**:
- BEFORE: Any user with admin role in the club
- AFTER: Only the club creator

**Use Case**:
- Club creator wants to add a new member to their club

---

## Policy 2: Updating Member Roles

### BEFORE (BROKEN - Recursive)
```sql
CREATE POLICY "Club admins can update member roles"
  ON public.club_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_members.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_members.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

**Problem**: Double recursive query (USING and WITH CHECK) → causes severe recursion

### AFTER (FIXED - Non-recursive)
```sql
CREATE POLICY "Club creators can update member roles"
  ON public.club_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );
```

**Solution**: Both clauses query `clubs` table → no recursion

**Who Can Do This**:
- BEFORE: Any user with admin role in the club
- AFTER: Only the club creator

**Use Case**:
- Club creator promotes a member to admin (or demotes admin to member)

---

## Policy 3: Removing Members from Clubs

### BEFORE (BROKEN - Recursive)
```sql
CREATE POLICY "Club admins can remove members"
  ON public.club_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_members.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

**Problem**: Recursive query → infinite recursion when deleting

### AFTER (FIXED - Non-recursive)
```sql
CREATE POLICY "Club creators can remove members"
  ON public.club_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );
```

**Solution**: Queries `clubs` table → no recursion

**Who Can Do This**:
- BEFORE: Any user with admin role in the club
- AFTER: Only the club creator

**Use Case**:
- Club creator removes a disruptive member

---

## Policy 4: Creating Events

### BEFORE (BROKEN - Recursive)
```sql
CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = events.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

**Problem**: Recursive query on club_members → infinite recursion when creating events

### AFTER (FIXED - Non-recursive)
```sql
CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = events.club_id
      AND created_by = auth.uid()
    )
  );
```

**Solution**: Queries `clubs` table instead → no recursion

**Who Can Do This**:
- BEFORE: Club admin or creator
- AFTER: Only the club creator

**Use Case**:
- Club creator creates an event for their club

---

## Policies That Stay THE SAME (No Changes)

### 1. View Club Members (Already Safe)
```sql
CREATE POLICY "Club members are publicly viewable"
  ON public.club_members
  FOR SELECT
  USING (true);
```
**Why**: Simple public read, no recursion risk ✓

### 2. Users Join Clubs (Already Safe)
```sql
CREATE POLICY "Users can join clubs"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND role = 'member'
  );
```
**Why**: Only checks auth context, no table queries ✓

### 3. Users Remove Themselves (Already Safe)
```sql
CREATE POLICY "Users can remove themselves from clubs"
  ON public.club_members
  FOR DELETE
  USING (auth.uid() = user_id);
```
**Why**: Only checks auth context, no table queries ✓

### 4. All Club Policies (Already Safe)
```sql
-- CREATE/READ/UPDATE/DELETE on clubs table
```
**Why**: Queries don't reference club_members ✓

### 5. All Event Registrations Policies (Already Safe)
```sql
-- CREATE/READ/UPDATE/DELETE on event_registrations table
```
**Why**: Only query events table (simple relationship) ✓

---

## Summary Table

### Authorization Changes

```
Operation                    | Before                  | After
-----------------------------|-------------------------|---------------------------
Add member to club          | Any admin in club       | Club creator only
Update member role          | Any admin in club       | Club creator only
Remove member from club     | Any admin in club       | Club creator only
Create event in club        | Any admin in club       | Club creator only
Join a club                 | Self-join allowed       | ✓ Still allowed
Remove yourself from club   | Self-remove allowed     | ✓ Still allowed
View club members           | Public access           | ✓ Still allowed
View clubs                  | Public access           | ✓ Still allowed
View events                 | Public access           | ✓ Still allowed
```

### Query Targets

```
Policy Name                           | Before            | After
--------------------------------------|-------------------|------------------
Club admins can add members          | club_members 🔴  | clubs ✓
Club admins can update member roles  | club_members 🔴  | clubs ✓
Club admins can remove members       | club_members 🔴  | clubs ✓
Authenticated users can create events| club_members 🔴  | clubs ✓
Users can join clubs                 | N/A               | N/A (unchanged)
Users remove themselves              | N/A               | N/A (unchanged)
All others                          | N/A               | N/A (unchanged)

Legend: 🔴 = Recursive (causes error), ✓ = Safe (no recursion)
```

---

## Migration SQL (What to Execute)

### Step 1: Drop Broken Policies
```sql
DROP POLICY IF EXISTS "Club admins can add members" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can update member roles" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can remove members" ON public.club_members;
```

### Step 2: Create Fixed Policies
```sql
CREATE POLICY "Club creators can add members"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Club creators can update member roles"
  ON public.club_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Club creators can remove members"
  ON public.club_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );
```

### Step 3: Update Events Policy (Fix Recursion)
```sql
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;

CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = events.club_id
      AND created_by = auth.uid()
    )
  );
```

---

## Testing the Changes

### Test 1: Can Club Creator Add Members?
```sql
-- As club creator (auth.uid() = creator)
INSERT INTO public.club_members (club_id, user_id, role)
VALUES ('club-id', 'new-member-id', 'member');

-- Expected: ✓ SUCCESS
```

### Test 2: Can Non-Creator Add Members?
```sql
-- As non-creator user
INSERT INTO public.club_members (club_id, user_id, role)
VALUES ('club-id', 'new-member-id', 'member');

-- Expected: ✗ PERMISSION DENIED
```

### Test 3: Can User Join a Club?
```sql
-- As any authenticated user
INSERT INTO public.club_members (club_id, user_id, role)
VALUES ('club-id', auth.uid(), 'member');

-- Expected: ✓ SUCCESS (unchanged behavior)
```

### Test 4: Can Club Creator Create Events?
```sql
-- As club creator
INSERT INTO public.events (title, event_date, club_id, created_by)
VALUES ('Test Event', NOW(), 'club-id', auth.uid());

-- Expected: ✓ SUCCESS (now works without recursion)
```

---

## FAQ

**Q: Will existing club admins lose access?**
A: If they're not the club creator, yes. Only club creators can manage members now.

**Q: Is this a breaking change?**
A: Yes, but it simplifies authorization and fixes the critical recursion bug.

**Q: Can I preserve the old model?**
A: You'd need to create a separate admins table, but that adds complexity. This simpler model is recommended.

**Q: What about clubs with multiple admins?**
A: Now there's one owner (creator). To have multiple admins, you'd need a separate table structure.

**Q: Will performance improve?**
A: Yes, no more recursive policy evaluation + no infinite recursion timeouts.

**Q: Can I revert this?**
A: Yes, keep the backup and revert. But you'll have the recursion bug again.

**Q: When should I deploy this?**
A: As soon as possible. The infinite recursion is a critical bug.
