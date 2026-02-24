/**
 * Item Mod System
 *
 * Items can roll up to 6 random mods when created. Each mod applies a
 * stat modifier, ability tweak, or special on-hit / on-event effect.
 *
 * Rarity rules:
 *   - Fewer mods is common; more mods is exponentially rarer.
 *   - Within each mod, higher rolled values are rarer (weighted toward low end).
 *
 * World-placed items (e.g. farm.js table loot) can supply pre-baked mods
 * to skip random generation.
 */

// ── Mod Pool ─────────────────────────────────────────────────────────────
// Each entry defines one possible mod that can appear on an item.
//   id      – unique identifier
//   name    – display label
//   stat    – the Character property this mod affects (null for specials)
//   type    – 'stat' | 'ability' | 'special'
//   min/max – inclusive roll range (integers)
//   weight  – relative likelihood of being chosen from the pool (higher = more common)
//   format  – display string; {value} is replaced with the rolled number

const MOD_POOL = [
    // ── Defensive / survival ──
    { id: 'flat_armor',             name: 'Armor',                stat: 'armor',              type: 'stat', min: 1, max: 15,  weight: 10, format: '+{value} Armor' },
    { id: 'flat_max_health',        name: 'Max Health',           stat: 'maxHealth',          type: 'stat', min: 2, max: 30,  weight: 10, format: '+{value} Max Health' },
    { id: 'flat_max_mana',          name: 'Max Mana',             stat: 'maxMana',            type: 'stat', min: 2, max: 30,  weight: 10, format: '+{value} Max Mana' },
    { id: 'flat_health_regen',      name: 'Health Regen',         stat: 'healthRegen',        type: 'stat', min: 1, max: 5,   weight: 6,  format: '+{value} Health Regen' },
    { id: 'flat_mana_regen',        name: 'Mana Regen',           stat: 'manaRegen',          type: 'stat', min: 1, max: 5,   weight: 6,  format: '+{value} Mana Regen' },

    // ── Physical damage ──
    { id: 'flat_slash_damage',      name: 'Slash Damage',         stat: 'slashDamage',        type: 'stat', min: 1, max: 12,  weight: 8,  format: '+{value} Slash Damage' },
    { id: 'flat_smash_damage',      name: 'Smash Damage',         stat: 'smashDamage',        type: 'stat', min: 1, max: 12,  weight: 8,  format: '+{value} Smash Damage' },
    { id: 'flat_stab_damage',       name: 'Stab Damage',          stat: 'stabDamage',         type: 'stat', min: 1, max: 12,  weight: 8,  format: '+{value} Stab Damage' },

    // ── Elemental damage ──
    { id: 'flat_cold_damage',       name: 'Cold Damage',          stat: 'coldDamage',         type: 'stat', min: 1, max: 10,  weight: 5,  format: '+{value} Cold Damage' },
    { id: 'flat_fire_damage',       name: 'Fire Damage',          stat: 'fireDamage',         type: 'stat', min: 1, max: 10,  weight: 5,  format: '+{value} Fire Damage' },
    { id: 'flat_lightning_damage',  name: 'Lightning Damage',     stat: 'lightningDamage',    type: 'stat', min: 1, max: 10,  weight: 5,  format: '+{value} Lightning Damage' },
    { id: 'flat_arcane_damage',     name: 'Arcane Damage',        stat: 'arcaneDamage',       type: 'stat', min: 1, max: 10,  weight: 4,  format: '+{value} Arcane Damage' },
    { id: 'flat_corrupt_damage',    name: 'Corrupt Damage',       stat: 'corruptDamage',      type: 'stat', min: 1, max: 10,  weight: 3,  format: '+{value} Corrupt Damage' },
    { id: 'flat_holy_damage',       name: 'Holy Damage',          stat: 'holyDamage',         type: 'stat', min: 1, max: 10,  weight: 3,  format: '+{value} Holy Damage' },

    // ── Resistances ──
    { id: 'flat_physical_resist',   name: 'Physical Resistance',  stat: 'physicalResistance', type: 'stat', min: 1, max: 8,   weight: 5,  format: '+{value} Physical Resistance' },
    { id: 'flat_cold_resist',       name: 'Cold Resistance',      stat: 'coldResistance',     type: 'stat', min: 1, max: 8,   weight: 5,  format: '+{value} Cold Resistance' },
    { id: 'flat_fire_resist',       name: 'Fire Resistance',      stat: 'fireResistance',     type: 'stat', min: 1, max: 8,   weight: 5,  format: '+{value} Fire Resistance' },
    { id: 'flat_lightning_resist',  name: 'Lightning Resistance', stat: 'lightningResistance',type: 'stat', min: 1, max: 8,   weight: 5,  format: '+{value} Lightning Resistance' },
    { id: 'flat_arcane_resist',     name: 'Arcane Resistance',    stat: 'arcaneResistance',   type: 'stat', min: 1, max: 8,   weight: 4,  format: '+{value} Arcane Resistance' },
    { id: 'flat_corrupt_resist',    name: 'Corrupt Resistance',   stat: 'corruptResistance',  type: 'stat', min: 1, max: 8,   weight: 4,  format: '+{value} Corrupt Resistance' },
    { id: 'flat_holy_resist',       name: 'Holy Resistance',      stat: 'holyResistance',     type: 'stat', min: 1, max: 8,   weight: 4,  format: '+{value} Holy Resistance' },

    // ── Utility ──
    { id: 'flat_speed',             name: 'Movement Speed',       stat: 'speed',              type: 'stat', min: 5, max: 40,  weight: 4,  format: '+{value} Movement Speed' },
    { id: 'flat_action_speed',      name: 'Action Speed',         stat: 'actionSpeed',        type: 'stat', min: 1, max: 3,   weight: 3,  format: '+{value} Action Speed' },
    { id: 'flat_pickup_range',      name: 'Pickup Range',         stat: 'pickupRange',        type: 'stat', min: 10, max: 60, weight: 3,  format: '+{value} Pickup Range' },
    { id: 'flat_attack_range',      name: 'Attack Range',         stat: 'attackRange',        type: 'stat', min: 5, max: 30,  weight: 3,  format: '+{value} Attack Range' },

    // ── Ability mods ──
    { id: 'ability_cooldown_reduction', name: 'Cooldown Reduction',  stat: null, type: 'ability',  min: 1, max: 15,  weight: 3, format: '-{value}% Cooldown' },
    { id: 'ability_damage_boost',       name: 'Ability Damage',      stat: null, type: 'ability',  min: 1, max: 20,  weight: 3, format: '+{value}% Ability Damage' },
    { id: 'ability_mana_efficiency',    name: 'Mana Efficiency',     stat: null, type: 'ability',  min: 1, max: 15,  weight: 3, format: '-{value}% Mana Cost' },

    // ── Special / event-driven mods ──
    { id: 'special_life_on_hit',        name: 'Life on Hit',         stat: null, type: 'special',  min: 1, max: 5,   weight: 2, format: '+{value} Life on Hit' },
    { id: 'special_mana_on_hit',        name: 'Mana on Hit',         stat: null, type: 'special',  min: 1, max: 5,   weight: 2, format: '+{value} Mana on Hit' },
    { id: 'special_thorns',             name: 'Thorns',              stat: null, type: 'special',  min: 1, max: 8,   weight: 2, format: '+{value} Thorns Damage' },
    { id: 'special_life_steal',         name: 'Life Steal',          stat: null, type: 'special',  min: 1, max: 5,   weight: 1, format: '+{value}% Life Steal' },
    { id: 'special_crit_chance',        name: 'Critical Chance',     stat: null, type: 'special',  min: 1, max: 10,  weight: 2, format: '+{value}% Critical Chance' },
    { id: 'special_crit_damage',        name: 'Critical Damage',     stat: null, type: 'special',  min: 5, max: 30,  weight: 2, format: '+{value}% Critical Damage' },
    { id: 'special_dodge',              name: 'Dodge Chance',        stat: null, type: 'special',  min: 1, max: 8,   weight: 2, format: '+{value}% Dodge Chance' },
    { id: 'special_flinch_resist',      name: 'Flinch Resistance',   stat: 'flinchResistance', type: 'special',  min: 1, max: 10,  weight: 3, format: '+{value} Flinch Resistance' },
];


// ── Mod-count weights ────────────────────────────────────────────────────
// Index = number of mods. Value = relative weight (higher = more common).
// 0 mods is most likely; 6 mods is extremely rare.

const MOD_COUNT_WEIGHTS = [
    30,  // 0 mods
    28,  // 1 mod
    20,  // 2 mods
    12,  // 3 mods
    6,   // 4 mods
    3,   // 5 mods
    1,   // 6 mods
];


// ── Rolling helpers ──────────────────────────────────────────────────────

/**
 * Pick a random index given an array of weights.
 * @param {number[]} weights
 * @returns {number} chosen index
 */
function weightedRandomIndex(weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return i;
    }
    return weights.length - 1;
}

/**
 * Roll a value between min and max (inclusive), biased toward the low end.
 * Uses a power-curve: the higher the exponent, the rarer high values are.
 * @param {number} min
 * @param {number} max
 * @param {number} [exponent=2] - Controls skew (2 = moderate, 3 = heavy)
 * @returns {number} integer value
 */
function rollModValue(min, max, exponent = 2) {
    // Math.random()^exponent  →  skewed toward 0
    const t = Math.pow(Math.random(), exponent);
    return Math.round(min + t * (max - min));
}

/**
 * Roll a random set of mods for an item.
 * @param {object} [options]
 * @param {number} [options.maxMods=6]     - Cap on number of mods
 * @param {number} [options.valueExponent=2] - Skew for value rolls (higher = rarer high values)
 * @returns {Array<{modId: string, value: number}>}
 */
function rollMods({ maxMods = 6, valueExponent = 2 } = {}) {
    // 1. Decide how many mods
    const countWeights = MOD_COUNT_WEIGHTS.slice(0, maxMods + 1);
    const count = weightedRandomIndex(countWeights);
    if (count === 0) return [];

    // 2. Pick `count` unique mods from the pool (weighted by pool weight)
    const available = [...MOD_POOL];
    const chosen = [];

    for (let i = 0; i < count && available.length > 0; i++) {
        const weights = available.map(m => m.weight);
        const idx = weightedRandomIndex(weights);
        const modDef = available.splice(idx, 1)[0];

        const value = rollModValue(modDef.min, modDef.max, valueExponent);
        chosen.push({ modId: modDef.id, value });
    }

    return chosen;
}

/**
 * Look up the full mod definition from a rolled mod's id.
 * @param {string} modId
 * @returns {object|undefined}
 */
function getModDefinition(modId) {
    return MOD_POOL.find(m => m.id === modId);
}

/**
 * Format a rolled mod for display.
 * @param {{modId: string, value: number}} rolledMod
 * @returns {string} e.g. "+5 Armor"
 */
function formatMod(rolledMod) {
    const def = getModDefinition(rolledMod.modId);
    if (!def) return `Unknown mod: ${rolledMod.modId}`;
    return def.format.replace('{value}', rolledMod.value);
}

/**
 * Aggregate all stat contributions from an array of rolled mods.
 * Returns an object keyed by Character stat property names.
 * Only includes mods with type 'stat' (or specials that map to stats).
 * @param {Array<{modId: string, value: number}>} mods
 * @returns {object} e.g. { armor: 5, maxHealth: 10 }
 */
function aggregateModStats(mods) {
    const result = {};
    for (const rolled of mods) {
        const def = getModDefinition(rolled.modId);
        if (!def || !def.stat) continue;
        result[def.stat] = (result[def.stat] || 0) + rolled.value;
    }
    return result;
}

export {
    MOD_POOL, MOD_COUNT_WEIGHTS,
    weightedRandomIndex, rollModValue, rollMods,
    getModDefinition, formatMod, aggregateModStats,
};
