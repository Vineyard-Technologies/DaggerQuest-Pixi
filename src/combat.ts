/**
 * CombatResolver – translates attacker + defender stats into final damage.
 *
 * Damage formula
 * ──────────────
 * 1. Determine the raw damage from the attacker's matching damage stat.
 * 2. Subtract a flat portion derived from the defender's `armor`.
 * 3. Multiply by `(1 − resistance)` where resistance is clamped to [0, 0.95].
 * 4. Ensure the result is never negative.
 *
 * Recognised damage types correspond to the `CharacterStats` damage keys.
 */

import type { CharacterStats } from './types';

/** All damage types supported by the combat system. */
export const DAMAGE_TYPES = [
    'slash',
    'smash',
    'stab',
    'cold',
    'fire',
    'lightning',
    'arcane',
    'corrupt',
    'holy',
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

/** Map each damage type to its corresponding attacker stat key. */
const DAMAGE_STAT: Record<DamageType, keyof CharacterStats> = {
    slash:     'slashDamage',
    smash:     'smashDamage',
    stab:      'stabDamage',
    cold:      'coldDamage',
    fire:      'fireDamage',
    lightning: 'lightningDamage',
    arcane:    'arcaneDamage',
    corrupt:   'corruptDamage',
    holy:      'holyDamage',
};

/** Map each damage type to its corresponding defender resistance stat key. */
const RESISTANCE_STAT: Partial<Record<DamageType, keyof CharacterStats>> = {
    slash:     'physicalResistance',
    smash:     'physicalResistance',
    stab:      'physicalResistance',
    cold:      'coldResistance',
    fire:      'fireResistance',
    lightning: 'lightningResistance',
    arcane:    'arcaneResistance',
    corrupt:   'corruptResistance',
    holy:      'holyResistance',
};

export class CombatResolver {
    /**
     * Calculate the final damage dealt to a defender.
     *
     * @param attackerStats - Stats of the attacking character.
     * @param defenderStats - Stats of the defending character.
     * @param damageType    - Type of damage being applied.
     * @param baseDamage    - Optional explicit base damage; falls back to the
     *                        attacker's matching damage stat.
     * @returns Final damage value (≥ 0).
     */
    static resolve(
        attackerStats: CharacterStats,
        defenderStats: CharacterStats,
        damageType: DamageType,
        baseDamage?: number,
    ): number {
        const raw = baseDamage ?? (attackerStats[DAMAGE_STAT[damageType]] as number);

        // Flat armour reduction (physical only; contributes proportionally)
        const armorReduction = damageType === 'slash' || damageType === 'smash' || damageType === 'stab'
            ? defenderStats.armor * 0.5
            : 0;

        const afterArmor = Math.max(0, raw - armorReduction);

        // Elemental / type resistance
        const resistKey = RESISTANCE_STAT[damageType];
        const resistance = resistKey ? Math.min(0.95, Math.max(0, defenderStats[resistKey] as number / 100)) : 0;

        return Math.max(0, afterArmor * (1 - resistance));
    }
}
