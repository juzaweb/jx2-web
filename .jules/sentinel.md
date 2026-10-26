# Sentinel Security Journal

## 2026-03-31 - Missing Authentication on Character REST API Endpoints
**Vulnerability:** Character REST routes (`/users/:userId/characters`) allowed unauthenticated clients to read, create, or delete characters for arbitrary user IDs.
**Learning:** Route definitions under `server/src/routes/character.routes.js` lacked authentication middleware checking bearer session tokens and matching token user IDs against requested parameters.
**Prevention:** Always attach an authorization middleware on user-scoped API routes to verify session tokens and match `userId`.
