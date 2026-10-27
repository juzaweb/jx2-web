/**
 * Skill catalog and rules — backward-compatible entry point.
 *
 * The implementation lives in `./skills/`. This file stays so the many existing
 * importers (`./skills.js`, and the server's `src/game/skills.js`) keep working
 * unchanged. New code may import `./skills/index.js` directly.
 *
 * IMPORTANT: this module and everything it re-exports must stay free of Phaser
 * and DOM access — the Node server imports it.
 */

export * from "./skills/index.js";
