import { ModType } from './types';

export interface ModDefinition {
    readonly id: string;
    readonly name: string;
    readonly stat: string | null;
    readonly type: ModType;
    readonly min: number;
    readonly max: number;
    readonly weight: number;
    readonly format: string;
}

export interface RolledMod {
    modId: string;
    value: number;
}

const MOD_POOL: readonly ModDefinition[] = [
    { id: 'flat_armor', name: 'Armor', stat: 'armor', type: ModType.Stat, min: 1, max: 15, weight: 10, format: '+{value} Armor' },
    { id: 'flat_max_health', name: 'Max Health', stat: 'maxHealth', type: ModType.Stat, min: 2, max: 30, weight: 10, format: '+{value} Max Health' },
    { id: 'flat_max_mana', name: 'Max Mana', stat: 'maxMana', type: ModType.Stat, min: 2, max: 30, weight: 10, format: '+{value} Max Mana' },
    { id: 'flat_health_regen', name: 'Health Regen', stat: 'healthRegen', type: ModType.Stat, min: 1, max: 5, weight: 6, format: '+{value} Health Regen' },
    { id: 'flat_mana_regen', name: 'Mana Regen', stat: 'manaRegen', type: ModType.Stat, min: 1, max: 5, weight: 6, format: '+{value} Mana Regen' },
    { id: 'flat_slash_damage', name: 'Slash Damage', stat: 'slashDamage', type: ModType.Stat, min: 1, max: 12, weight: 8, format: '+{value} Slash Damage' },
    { id: 'flat_smash_damage', name: 'Smash Damage', stat: 'smashDamage', type: ModType.Stat, min: 1, max: 12, weight: 8, format: '+{value} Smash Damage' },
    { id: 'flat_stab_damage', name: 'Stab Damage', stat: 'stabDamage', type: ModType.Stat, min: 1, max: 12, weight: 8, format: '+{value} Stab Damage' },
    { id: 'flat_cold_damage', name: 'Cold Damage', stat: 'coldDamage', type: ModType.Stat, min: 1, max: 10, weight: 5, format: '+{value} Cold Damage' },
    { id: 'flat_fire_damage', name: 'Fire Damage', stat: 'fireDamage', type: ModType.Stat, min: 1, max: 10, weight: 5, format: '+{value} Fire Damage' },
    { id: 'flat_lightning_damage', name: 'Lightning Damage', stat: 'lightningDamage', type: ModType.Stat, min: 1, max: 10, weight: 5, format: '+{value} Lightning Damage' },
    { id: 'flat_arcane_damage', name: 'Arcane Damage', stat: 'arcaneDamage', type: ModType.Stat, min: 1, max: 10, weight: 4, format: '+{value} Arcane Damage' },
    { id: 'flat_corrupt_damage', name: 'Corrupt Damage', stat: 'corruptDamage', type: ModType.Stat, min: 1, max: 10, weight: 3, format: '+{value} Corrupt Damage' },
    { id: 'flat_holy_damage', name: 'Holy Damage', stat: 'holyDamage', type: ModType.Stat, min: 1, max: 10, weight: 3, format: '+{value} Holy Damage' },
    { id: 'flat_physical_resist', name: 'Physical Resistance', stat: 'physicalResistance', type: ModType.Stat, min: 1, max: 8, weight: 5, format: '+{value} Physical Resistance' },
    { id: 'flat_cold_resist', name: 'Cold Resistance', stat: 'coldResistance', type: ModType.Stat, min: 1, max: 8, weight: 5, format: '+{value} Cold Resistance' },
    { id: 'flat_fire_resist', name: 'Fire Resistance', stat: 'fireResistance', type: ModType.Stat, min: 1, max: 8, weight: 5, format: '+{value} Fire Resistance' },
    { id: 'flat_lightning_resist', name: 'Lightning Resistance', stat: 'lightningResistance', type: ModType.Stat, min: 1, max: 8, weight: 5, format: '+{value} Lightning Resistance' },
    { id: 'flat_arcane_resist', name: 'Arcane Resistance', stat: 'arcaneResistance', type: ModType.Stat, min: 1, max: 8, weight: 4, format: '+{value} Arcane Resistance' },
    { id: 'flat_corrupt_resist', name: 'Corrupt Resistance', stat: 'corruptResistance', type: ModType.Stat, min: 1, max: 8, weight: 4, format: '+{value} Corrupt Resistance' },
    { id: 'flat_holy_resist', name: 'Holy Resistance', stat: 'holyResistance', type: ModType.Stat, min: 1, max: 8, weight: 4, format: '+{value} Holy Resistance' },
    { id: 'flat_speed', name: 'Movement Speed', stat: 'speed', type: ModType.Stat, min: 5, max: 40, weight: 4, format: '+{value} Movement Speed' },
    { id: 'flat_action_speed', name: 'Action Speed', stat: 'actionSpeed', type: ModType.Stat, min: 1, max: 3, weight: 3, format: '+{value} Action Speed' },
    { id: 'flat_pickup_range', name: 'Pickup Range', stat: 'pickupRange', type: ModType.Stat, min: 10, max: 60, weight: 3, format: '+{value} Pickup Range' },
    { id: 'flat_attack_range', name: 'Attack Range', stat: 'attackRange', type: ModType.Stat, min: 5, max: 30, weight: 3, format: '+{value} Attack Range' },
    { id: 'ability_cooldown_reduction', name: 'Cooldown Reduction', stat: null, type: ModType.Ability, min: 1, max: 15, weight: 3, format: '-{value}% Cooldown' },
    { id: 'ability_damage_boost', name: 'Ability Damage', stat: null, type: ModType.Ability, min: 1, max: 20, weight: 3, format: '+{value}% Ability Damage' },
    { id: 'ability_mana_efficiency', name: 'Mana Efficiency', stat: null, type: ModType.Ability, min: 1, max: 15, weight: 3, format: '-{value}% Mana Cost' },
    { id: 'special_life_on_hit', name: 'Life on Hit', stat: null, type: ModType.Special, min: 1, max: 5, weight: 2, format: '+{value} Life on Hit' },
    { id: 'special_mana_on_hit', name: 'Mana on Hit', stat: null, type: ModType.Special, min: 1, max: 5, weight: 2, format: '+{value} Mana on Hit' },
    { id: 'special_thorns', name: 'Thorns', stat: null, type: ModType.Special, min: 1, max: 8, weight: 2, format: '+{value} Thorns Damage' },
    { id: 'special_life_steal', name: 'Life Steal', stat: null, type: ModType.Special, min: 1, max: 5, weight: 1, format: '+{value}% Life Steal' },
    { id: 'special_crit_chance', name: 'Critical Chance', stat: null, type: ModType.Special, min: 1, max: 10, weight: 2, format: '+{value}% Critical Chance' },
    { id: 'special_crit_damage', name: 'Critical Damage', stat: null, type: ModType.Special, min: 5, max: 30, weight: 2, format: '+{value}% Critical Damage' },
    { id: 'special_dodge', name: 'Dodge Chance', stat: null, type: ModType.Special, min: 1, max: 8, weight: 2, format: '+{value}% Dodge Chance' },
    { id: 'special_flinch_resist', name: 'Flinch Resistance', stat: 'flinchResistance', type: ModType.Special, min: 1, max: 10, weight: 3, format: '+{value} Flinch Resistance' },
];

const MOD_COUNT_WEIGHTS = [30, 28, 20, 12, 6, 3, 1] as const;

function weightedRandomIndex(weights: readonly number[]): number {
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) { roll -= weights[i]!; if (roll <= 0) return i; }
    return weights.length - 1;
}

function rollModValue(min: number, max: number, exponent = 2): number {
    const t = Math.pow(Math.random(), exponent);
    return Math.round(min + t * (max - min));
}

function rollMods({ maxMods = 6, valueExponent = 2, pool }: { maxMods?: number; valueExponent?: number; pool?: readonly ModDefinition[] } = {}): RolledMod[] {
    const countWeights = MOD_COUNT_WEIGHTS.slice(0, maxMods + 1);
    const count = weightedRandomIndex(countWeights);
    if (count === 0) return [];
    const available = [...(pool ?? MOD_POOL)];
    const chosen: RolledMod[] = [];
    for (let i = 0; i < count && available.length > 0; i++) {
        const weights = available.map(m => m.weight);
        const idx = weightedRandomIndex(weights);
        const modDef = available.splice(idx, 1)[0]!;
        const value = rollModValue(modDef.min, modDef.max, valueExponent);
        chosen.push({ modId: modDef.id, value });
    }
    return chosen;
}

function getModDefinition(modId: string): ModDefinition | undefined {
    return MOD_POOL.find(m => m.id === modId);
}

function formatMod(rolledMod: RolledMod): string {
    const def = getModDefinition(rolledMod.modId);
    if (!def) return `Unknown mod: ${rolledMod.modId}`;
    return def.format.replace('{value}', String(rolledMod.value));
}

function aggregateModStats(mods: readonly RolledMod[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const rolled of mods) {
        const def = getModDefinition(rolled.modId);
        if (!def || !def.stat) continue;
        result[def.stat] = (result[def.stat] || 0) + rolled.value;
    }
    return result;
}

export { MOD_POOL, MOD_COUNT_WEIGHTS, weightedRandomIndex, rollModValue, rollMods, getModDefinition, formatMod, aggregateModStats };
