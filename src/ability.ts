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
