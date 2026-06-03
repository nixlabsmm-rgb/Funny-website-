# Security Rules Specification

## Data Invariants
1. **Users Profile**: Can only be read by anyone signed in, but can only be created or modified by the user themselves (`request.auth.uid == userId`).
2. **Posts**: Can only be created, deleted, or edited by their author. Any user can, however, update the response counters (`likesCount`, `hahaCount`, `careCount`, `angryCount`, `commentsCount`) in a dedicated counter-update action.
3. **Reactions**: Located under `posts/{postId}/reactions/{userId}`. Can only be written or deleted by the user whose UID matches `{userId}`.
4. **Comments**: Located under `posts/{postId}/comments/{commentId}`. Can only be created by the authenticated comment author and deleted by either the comment author or the post author.

## Dirty Dozen Payloads
We guard against:
1. ID Poisoning (too long or malformed IDs).
2. Users marking themselves as admin (if admin concept existed).
3. Privilege Escalation (overwriting post details of another user).
4. Timestamp manipulation (enforcing `request.time` for creation).
5. Post-creation immutability of `authorId` and `createdAt` keys.

## Test Runner Schema
All authorization is fully verified in the Firestore security rules.
