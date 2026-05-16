# Security Spec for TradeEdge

## Data Invariants
- A setup must belong to the user (`userId == request.auth.uid`).
- A journal trade must belong to the user (`userId == request.auth.uid`).
- Profile config must belong to the user.
- Only authenticated users can read/write data in their own `users/{userId}` paths.

## Dirty Dozen Payloads
1. Create setup with different userId.
2. Read setups belonging to another user.
3. Update setup status but not owner, attempting identity swap.
4. Inject string into PNL USD in trade journal.
5. Missing required fields in Profile.
6. Create trade with invalid status.
7. Oauth token unverified read.
...

## Test Runner
See `firestore.rules.test.ts`.
