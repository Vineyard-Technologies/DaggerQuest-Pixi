import { Item } from './item';
import { GearSlot } from './types';
import { ModType } from './types';

// ── Mainhand ────────────────────────────────────────────────────────────────

class SimpleSword extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'simplesword',
            name: 'Simple Sword',
            description: 'The first of many',
            slot: GearSlot.MainHand,
            baseStats: { slashDamage: 3 },
            allowedClasses: ['chevalier'],
            modTables: [ModType.Stat],
            level,
        });
    }
}

class SimpleMace extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'simplemace',
            name: 'Simple Mace',
            description: 'Blunt but effective',
            slot: GearSlot.MainHand,
            baseStats: { smashDamage: 4 },
            allowedClasses: ['chevalier'],
            modTables: [ModType.Stat],
            level,
        });
    }
}

class Greatsword extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'greatsword',
            name: 'Greatsword',
            description: 'A massive blade demanding two hands',
            slot: GearSlot.MainHand,
            baseStats: { slashDamage: 6 },
            allowedClasses: ['vanguard'],
            modTables: [ModType.Stat],
            twoHanded: true,
            level,
        });
    }
}

// ── Offhand ─────────────────────────────────────────────────────────────────

class SimpleShield extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'simpleshield',
            name: 'Simple Shield',
            description: 'No respite for the scorned',
            slot: GearSlot.OffHand,
            baseStats: { armor: 5 },
            allowedClasses: ['chevalier'],
            modTables: [ModType.Stat],
            level,
        });
    }
}

class OrnateShield extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'ornateshield',
            name: 'Ornate Shield',
            description: 'Gilded edges belie its strength',
            slot: GearSlot.OffHand,
            baseStats: { armor: 8 },
            allowedClasses: ['chevalier'],
            modTables: [ModType.Stat],
            level,
        });
    }
}

// ── Head ─────────────────────────────────────────────────────────────────────

class SimpleHelmet extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'simplehelmet',
            name: 'Simple Helmet',
            description: 'A modest guard for the skull',
            slot: GearSlot.Head,
            baseStats: { armor: 3 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

class CrudeHelmet extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'crudehelmet',
            name: 'Crude Helmet',
            description: 'Hammered from scrap iron',
            slot: GearSlot.Head,
            baseStats: { armor: 5 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

// ── Chest ───────────────────────────────────────────────────────────────────

class SimpleShirt extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'simpleshirt',
            name: 'Simple Shirt',
            description: 'Deep in the midst, you conceal him',
            slot: GearSlot.Chest,
            baseStats: { maxHealth: 2 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

class LeatherJacket extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'leatherjacket',
            name: 'Leather Jacket',
            description: 'Tough hide, loosely stitched',
            slot: GearSlot.Chest,
            baseStats: { armor: 4, maxHealth: 3 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

class MaraudersStraps extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'maraudersstraps',
            name: "Marauder's Straps",
            description: 'Stripped from a brigand captain',
            slot: GearSlot.Chest,
            baseStats: { armor: 6, maxHealth: 5 },
            modTables: [ModType.Stat, ModType.Special],
            level,
        });
    }
}

// ── Legs ─────────────────────────────────────────────────────────────────────

class SimplePants extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'simplepants',
            name: 'Simple Pants',
            description: 'Whoso is simple, let him perish!',
            slot: GearSlot.Legs,
            baseStats: { manaRegen: 1 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

class Leggings extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'leggings',
            name: 'Leggings',
            description: 'A snug fit beneath plate',
            slot: GearSlot.Legs,
            baseStats: { armor: 2, manaRegen: 1 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

// ── Hands ────────────────────────────────────────────────────────────────────

class SimpleGloves extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'simplegloves',
            name: 'Simple Gloves',
            description: 'Worn but warm',
            slot: GearSlot.Hands,
            baseStats: { armor: 1 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

class MaraudersBracers extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'maraudersbracers',
            name: "Marauder's Bracers",
            description: 'Trophy of a vanquished raider',
            slot: GearSlot.Hands,
            baseStats: { armor: 3, slashDamage: 1 },
            modTables: [ModType.Stat, ModType.Special],
            level,
        });
    }
}

// ── Feet ─────────────────────────────────────────────────────────────────────

class StrappedBoots extends Item {
    constructor({ level = 1 }: { level?: number } = {}) {
        super({
            id: 'strappedboots',
            name: 'Strapped Boots',
            description: 'Tied tight for the road ahead',
            slot: GearSlot.Feet,
            baseStats: { speed: 10 },
            modTables: [ModType.Stat],
            level,
        });
    }
}

// ── Factory ─────────────────────────────────────────────────────────────────

const ITEM_CLASSES: Record<string, new (opts?: { level?: number }) => Item> = {
    simplesword: SimpleSword,
    simplemace: SimpleMace,
    greatsword: Greatsword,
    simpleshield: SimpleShield,
    ornateshield: OrnateShield,
    simplehelmet: SimpleHelmet,
    crudehelmet: CrudeHelmet,
    simpleshirt: SimpleShirt,
    leatherjacket: LeatherJacket,
    maraudersstraps: MaraudersStraps,
    simplepants: SimplePants,
    leggings: Leggings,
    simplegloves: SimpleGloves,
    maraudersbracers: MaraudersBracers,
    strappedboots: StrappedBoots,
};

function createItem(id: string, level: number = 1): Item {
    const ItemClass = ITEM_CLASSES[id];
    if (!ItemClass) throw new Error(`Unknown item type: "${id}"`);
    return new ItemClass({ level });
}

export {
    SimpleSword, SimpleMace, Greatsword,
    SimpleShield, OrnateShield,
    SimpleHelmet, CrudeHelmet,
    SimpleShirt, LeatherJacket, MaraudersStraps,
    SimplePants, Leggings,
    SimpleGloves, MaraudersBracers,
    StrappedBoots,
    createItem,
};
