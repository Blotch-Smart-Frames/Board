# check-firestore-rules

Audit Firestore security rules after any database/Firestore-related code change.

## When to trigger

Run this skill automatically after modifying any of:

- `src/services/*Service.ts` — service files that read/write Firestore
- `src/queries/firestoreRefs.ts` — collection/document reference definitions
- `src/types/board.ts` — data model types
- Any file that calls Firestore functions (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `getDocs`, `getDoc`, `collection`, `doc`)

## What to check

1. **Read `firestore.rules`** and **the changed service code** side by side.

2. For each Firestore operation in the changed code, verify the rules permit it:
   - **Collection path**: Does a `match` rule exist for the full collection/subcollection path used in code?
   - **Operation type**: Does the rule allow the operation (`read`, `create`, `update`, `delete`, `write`) that the code performs?
   - **Auth context**: Does the code run in a context where `request.auth` will satisfy the rule's conditions (e.g., board member vs board owner vs comment author)?
   - **New collections/subcollections**: If code references a collection path not covered by any `match` rule, flag it — all access will be denied by default.

3. Check for **permission gaps** introduced by the change:
   - A function deleting docs it didn't delete before (e.g., board owner deleting other users' comments)
   - A function writing to a subcollection that only allows `read` and `create` (no `update`/`delete`)
   - Batch operations that touch multiple collections with different permission requirements
   - New fields being written that should have validation rules

4. Check for **over-permissive rules**:
   - Does any rule grant broader access than the code actually needs?
   - Are `write` shortcuts (`allow write`) used where more granular `create`, `update`, `delete` rules would be safer?

## Output

Report one of:

- **No changes needed** — briefly explain why the rules already cover the new code
- **Rules update required** — list each gap found, the affected `match` path, and propose the minimal rule change to fix it. Apply the fix to `firestore.rules`.
