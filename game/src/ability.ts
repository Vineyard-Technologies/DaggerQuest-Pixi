/**
 * Ability system – open-ended actions that any Character can perform.
 *
 * An ability wraps an arbitrary execute callback so it can represent
 * anything: a melee swing, a ranged spell, a buff, a summon, movement
 * abilities, etc.  The only shared concerns are identity, cooldown
 * tracking, and an optional range hint used by AI.
 */

import type { Character } from './character';

// ── Types ─────────────────────────────────────────────────────────────────

/** Context supplied to an ability's execute callback. */
export interface AbilityContext {
    /** The character using the ability. */
    caster: Character;
    /** Optional target character (may be omitted for self-cast / AoE). */
    target?: Character;
}

/**
 * Static definition of an ability.
 *
 * Definitions are plain objects so they can be shared, serialised, or
 * composed from data files.  The `execute` callback is where all
 * game-play effects happen – it is deliberately unconstrained.
 */
export interface AbilityDef {
    /** Unique identifier (e.g. "basic_attack", "fireball"). */
    id: string;
    /** Human-readable display name. */
    name: string;
    /** Minimum time between uses, in milliseconds. */
    cooldown: number;
    /**
     * Effective range of the ability in world units.
     * AI uses this to decide when the ability can be attempted.
     * Use 0 for self-targeted abilities with no range requirement.
     */
    range: number;
    /** Called when the ability fires – do whatever you want here. */
    execute: (ctx: AbilityContext) => void;
}

// ── Runtime instance ──────────────────────────────────────────────────────

/**
 * A live ability instance attached to a character.
 * Wraps an `AbilityDef` and tracks per-instance cooldown state.
 */
export class Ability {
    readonly def: AbilityDef;
    private lastUseTime: number = 0;

    constructor(def: AbilityDef) {
        this.def = def;
    }

    get id(): string { return this.def.id; }
    get name(): string { return this.def.name; }
    get cooldown(): number { return this.def.cooldown; }
    get range(): number { return this.def.range; }

    /** Whether the cooldown has elapsed and the ability can fire. */
    isReady(): boolean {
        return performance.now() - this.lastUseTime >= this.def.cooldown;
    }

    /** Milliseconds remaining before the ability is ready; 0 if ready. */
    remainingCooldown(): number {
        return Math.max(0, this.def.cooldown - (performance.now() - this.lastUseTime));
    }

    /**
     * Attempt to use the ability.
     * @returns `true` if the ability executed, `false` if still on cooldown.
     */
    use(ctx: AbilityContext): boolean {
        if (!this.isReady()) return false;
        this.lastUseTime = performance.now();
        this.def.execute(ctx);
        return true;
    }
}

// ── Player Ability (active, keyed to Q/W/E/R/T) ──────────────────────────

/** Keys that map to player abilities. */
export const ABILITY_KEYS = ['Q', 'W', 'E', 'R', 'T'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];

/** Definition for a player-activated ability with animation and mana cost. */
export interface PlayerAbilityDef extends AbilityDef {
    /** Animation name to play on the caster (e.g. 'groundslam'). */
    animName: string;
    /** Ability icon key inside the class's ability spritesheet. */
    iconKey: string;
    /** Mana cost to cast the ability. */
    manaCost: number;
}

/** Runtime instance of a player ability. Extends Ability with mana checks. */
export class PlayerAbility extends Ability {
    declare readonly def: PlayerAbilityDef;

    constructor(def: PlayerAbilityDef) {
        super(def);
    }

    get animName(): string { return this.def.animName; }
    get iconKey(): string { return this.def.iconKey; }
    get manaCost(): number { return this.def.manaCost; }

    /** Check readiness including mana. */
    canUse(caster: Character): boolean {
        return this.isReady() && caster.currentMana >= this.manaCost;
    }

    /** Use the ability, deducting mana. */
    override use(ctx: AbilityContext): boolean {
        if (!this.canUse(ctx.caster)) return false;
        ctx.caster.currentMana -= this.manaCost;
        return super.use(ctx);
    }
}

// ── Prayer (toggle, keyed to A/S/D/F/G) ──────────────────────────────────

/** Keys that map to prayers. */
export const PRAYER_KEYS = ['A', 'S', 'D', 'F', 'G'] as const;
export type PrayerKey = typeof PRAYER_KEYS[number];

/** Level required to unlock each ability/prayer slot. Applies to all classes. */
export const SLOT_UNLOCK_LEVELS: Readonly<Record<string, number>> = {
    Q: 2,
    A: 4,
    W: 6,
    S: 8,
    E: 10,
    D: 12,
    R: 14,
    F: 16,
    T: 18,
    G: 20,
} as const;

/** Static definition of a prayer toggle. */
export interface PrayerDef {
    id: string;
    name: string;
    /** Ability icon key inside the class's ability spritesheet. */
    iconKey: string;
    /** Called when the prayer is activated. */
    onActivate: (caster: Character) => void;
    /** Called when the prayer is deactivated. */
    onDeactivate: (caster: Character) => void;
}

/** Runtime instance of a prayer toggle. */
export class Prayer {
    readonly def: PrayerDef;
    active: boolean = false;

    constructor(def: PrayerDef) {
        this.def = def;
    }

    get id(): string { return this.def.id; }
    get name(): string { return this.def.name; }
    get iconKey(): string { return this.def.iconKey; }

    toggle(caster: Character): void {
        if (this.active) {
            this.active = false;
            this.def.onDeactivate(caster);
        } else {
            this.active = true;
            this.def.onActivate(caster);
        }
    }
}
