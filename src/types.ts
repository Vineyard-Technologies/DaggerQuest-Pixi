/**
 * Shared enums, types, and type guards used across the DaggerQuest codebase.
 */

// ── Gear Slot Enum ────────────────────────────────────────────────────────

/** All valid equipment slot positions. */
export const enum GearSlot {
    Head     = 'head',
    Chest    = 'chest',
    Hands    = 'hands',
    Legs     = 'legs',
    Feet     = 'feet',
    MainHand = 'mainhand',
    OffHand  = 'offhand',
    Neck     = 'neck',
    Ring     = 'ring',
    Ring2    = 'ring2',
}

// ── Enemy AI State Enum ───────────────────────────────────────────────────

/** Possible states in the enemy AI state machine. */
export const enum EnemyState {
    Idle   = 'idle',
    Chase  = 'chase',
    Attack = 'attack',
}

// ── Mod Type Enum ─────────────────────────────────────────────────────────

/** Categories of item modifiers. */
export const enum ModType {
    Stat    = 'stat',
    Ability = 'ability',
    Special = 'special',
}

// ── UI Source Enum ─────────────────────────────────────────────────────────

/** Origin of a UI drag or hit-test interaction. */
export const enum UISource {
    Equipped  = 'equipped',
    Inventory = 'inventory',
}

// ── Character Stats ───────────────────────────────────────────────────────

/** All numeric stats a character can possess. */
export interface CharacterStats {
    level: number;
    experience: number;
    actionSpeed: number;
    pickupRange: number;
    attackRange: number;
    currentHealth: number;
    maxHealth: number;
    healthRegen: number;
    currentMana: number;
    maxMana: number;
    manaRegen: number;
    armor: number;
    slashDamage: number;
    smashDamage: number;
    stabDamage: number;
    coldDamage: number;
    fireDamage: number;
    lightningDamage: number;
    arcaneDamage: number;
    corruptDamage: number;
    holyDamage: number;
    physicalResistance: number;
    coldResistance: number;
    fireResistance: number;
    lightningResistance: number;
    arcaneResistance: number;
    corruptResistance: number;
    holyResistance: number;
    flinchResistance: number;
}

/** All keys of CharacterStats – useful for dynamic stat lookup. */
export type CharacterStatKey = keyof CharacterStats;

/** Default values for every character stat. */
export const DEFAULT_CHARACTER_STATS: Readonly<CharacterStats> = {
    level: 1,
    experience: 0,
    actionSpeed: 1,
    pickupRange: 150,
    attackRange: 50,
    currentHealth: 100,
    maxHealth: 100,
    healthRegen: 1,
    currentMana: 100,
    maxMana: 100,
    manaRegen: 1,
    armor: 0,
    slashDamage: 0,
    smashDamage: 0,
    stabDamage: 0,
    coldDamage: 0,
    fireDamage: 0,
    lightningDamage: 0,
    arcaneDamage: 0,
    corruptDamage: 0,
    holyDamage: 0,
    physicalResistance: 0,
    coldResistance: 0,
    fireResistance: 0,
    lightningResistance: 0,
    arcaneResistance: 0,
    corruptResistance: 0,
    holyResistance: 0,
    flinchResistance: 0,
} as const;

/** Set of valid character stat keys for runtime checking. */
export const CHARACTER_STAT_KEYS: ReadonlySet<string> = new Set<string>(
    Object.keys(DEFAULT_CHARACTER_STATS),
);

// ── Type Guards ───────────────────────────────────────────────────────────

/** Narrow `T | undefined | null` to `T`. */
export function isDefined<T>(value: T | undefined | null): value is T {
    return value != null;
}

/** Runtime check: is the given key a valid CharacterStatKey? */
export function isCharacterStatKey(key: string): key is CharacterStatKey {
    return CHARACTER_STAT_KEYS.has(key);
}
