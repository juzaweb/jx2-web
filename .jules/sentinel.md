# Sentinel Security Journal

## 2026-03-31 - Privilege Escalation via Username Prefix
**Vulnerability:** Public user registration allowed any account whose username started with `admin_` to automatically receive `admin` role and GM privileges.
**Learning:** `userDb.register` and `userDb.isAdmin` relied on `cleanUsername.startsWith("admin_")` as a shorthand for admin status, exposing GM command tokens and administrative WebSocket actions to publicly registered users.
**Prevention:** Roles must be explicitly assigned via administrative grants or parameter checks, never inferred from arbitrary user-controlled string prefixes in public input formats.

## 2026-03-31 - Missing Authentication on Character REST API Endpoints
**Vulnerability:** Character REST routes (`/users/:userId/characters`) allowed unauthenticated clients to read, create, or delete characters for arbitrary user IDs.
**Learning:** Route definitions under `server/src/routes/character.routes.js` lacked authentication middleware checking bearer session tokens and matching token user IDs against requested parameters.
**Prevention:** Always attach an authorization middleware on user-scoped API routes to verify session tokens and match `userId`.
