/**
 * Shared configuration constants for DaggerQuest.
 *
 * Centralises all magic numbers so they can be tuned in one place.
 */

// ── UI ────────────────────────────────────────────────────────────────────

/** Pixel size (width & height) of an equipment / inventory slot tile. */
export const SLOT_SIZE = 90;

/** Maximum pixel size of an item icon inside a slot. */
export const SLOT_ICON_MAX = 62;

/** Border thickness (nine-slice) for slot frames (equipment & inventory). */
export const SLOT_BORDER = 14;

/** Border thickness (nine-slice) for ability slot frames. */
export const ABILITY_SLOT_BORDER = 11;

/** Pixel size (width & height) of an ability slot tile. */
export const ABILITY_SLOT_SIZE = 82;

/** Outer margin used when positioning HUD elements near the screen edges. */
export const HUD_MARGIN = 20;

/** Pixel radius of the health / mana orb sprites. */
export const ORB_RADIUS = 105;

/** Font size used for item names in tooltips. */
export const TOOLTIP_NAME_FONT_SIZE = 18;

/** Font size used for stat / mod lines in tooltips. */
export const TOOLTIP_STAT_FONT_SIZE = 15;

/** Font size used for the flavour-text description in tooltips. */
export const TOOLTIP_DESC_FONT_SIZE = 14;

/** Inner content width of item tooltips. */
export const TOOLTIP_INNER_WIDTH = 220;

/** Padding inside item tooltips. */
export const TOOLTIP_PADDING = 12;

// ── Progression ───────────────────────────────────────────────────────────

/** XP required to advance from level `n` to `n+1`. */
export function xpForLevel(n: number): number {
    return n * 100;
}

/** Stat bonuses awarded per level gained. */
export const LEVEL_UP_BONUSES: Readonly<Record<string, number>> = {
    maxHealth: 5,
    maxMana: 2,
};

/** Base XP an enemy awards = its level × this multiplier. */
export const ENEMY_XP_MULTIPLIER = 25;

// ── Collision ─────────────────────────────────────────────────────────────

/** Default character collision box width in world pixels. */
export const CHARACTER_COLLISION_WIDTH = 60;

/** Default character collision box height in world pixels. */
export const CHARACTER_COLLISION_HEIGHT = 30;
