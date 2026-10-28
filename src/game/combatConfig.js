/**
 * Base combat numbers shared by the player entity, the combat loop and the
 * character sheet. Keeping them in one place is what makes the sheet display
 * the same values the game actually rolls instead of a parallel set of formulas.
 */
/** Attack power before buffs; `computeDamage` subtracts the defender's defence. */
export const BASE_ATTACK = 24;
/** Defence subtracted from incoming attack power. */
export const BASE_DEFENSE = 6;
/** Chance [0..1] that a hit critically strikes. */
export const BASE_CRIT_RATE = 0.12;
/** Damage multiplier applied on a critical strike (1.5 = +50%). */
export const BASE_CRIT_DAMAGE = 1.5;
/**
 * Milliseconds between two normal attacks (see Combat.performAttack).
 *
 * Slowed from 400ms so a plain swing stops out-pacing every weapon skill on
 * sustained damage: at 400ms a swing was worth 2.5x the best single-target art
 * per second. Kept under the smallest skill cooldown (1500ms) and under the PvP
 * i-frame floor (PVP_HIT_COOLDOWN_MS = 750ms), which the server also applies to
 * a cast, so neither the skill pace nor duels are dragged down with it.
 */
export const ATTACK_INTERVAL_MS = 600;
/** Attack-speed multiplier: 1 = base cadence, 1.5 = 50% faster. */
export const BASE_ATTACK_SPEED = 1;
