/**
 * Generic loader that reads a plain JSON area definition and calls the
 * appropriate `Area` methods to spawn all objects.
 *
 * Adding a new area only requires a JSON data file – no new TypeScript class.
 */

import { Area, type AreaOptions } from './area';
import { NPC } from './npc';
import { Enemy } from './enemy';
import { Item } from './item';
import type { GearSlot } from './types';
import type { RolledMod } from './mods';

// ── JSON schema types ─────────────────────────────────────────────────────

interface AreaStaticSprite {
    key: string;
    x: number;
    y: number;
    shadow?: boolean;
    collider?: boolean;
}

interface AreaNpcDef {
    x: number;
    y: number;
    spriteKey: string;
    name: string;
    speed?: number;
    interactRange?: number;
    dialog?: string[];
}

interface AreaEnemyDef {
    x: number;
    y: number;
    spriteKey?: string;
    speed?: number;
    health?: number;
    attackRange?: number;
    aggroRange?: number;
    attackDamage?: number;
    attackCooldown?: number;
}

interface AreaItemDef {
    id: string;
    name: string;
    description?: string;
    slot: string;
    baseStats?: Record<string, number>;
    mods?: RolledMod[];
}

interface AreaLootDef {
    x: number;
    y: number;
    sortY?: number;
    item: AreaItemDef;
}

export interface AreaDefinition {
    area: AreaOptions;
    boundaries?: Array<{ x: number; y: number; width: number; height: number }>;
    buildings?: AreaStaticSprite[];
    fences?: AreaStaticSprite[];
    props?: AreaStaticSprite[];
    npcs?: AreaNpcDef[];
    enemies?: AreaEnemyDef[];
    loot?: AreaLootDef[];
}

// ── AreaLoader ────────────────────────────────────────────────────────────

/**
 * Construct an `Area` from a plain `AreaDefinition` object (typically loaded
 * from a JSON file) and populate it with all defined objects.
 */
export class AreaLoader extends Area {
    private readonly _def: AreaDefinition;

    constructor(def: AreaDefinition) {
        super(def.area);
        this._def = def;
    }

    override async spawnObjects(): Promise<void> {
        await Promise.all([
            this._spawnBoundaries(),
            this._spawnStaticSprites(this._def.buildings ?? []),
            this._spawnStaticSprites(this._def.fences ?? []),
            this._spawnStaticSprites(this._def.props ?? []),
            this._spawnNpcs(),
            this._spawnEnemies(),
            this._spawnLoot(),
        ]);
    }

    private _spawnBoundaries(): Promise<void> {
        for (const b of this._def.boundaries ?? []) {
            this.boundaries.push(b);
        }
        return Promise.resolve();
    }

    private async _spawnStaticSprites(defs: AreaStaticSprite[]): Promise<void> {
        await Promise.all(defs.map(d =>
            this.placeStaticSprite(d.key, d.x, d.y, {
                shadow: d.shadow,
                collider: d.collider,
            }),
        ));
    }

    private async _spawnNpcs(): Promise<void> {
        await Promise.all((this._def.npcs ?? []).map(async def => {
            const npc = new NPC({
                x: def.x,
                y: def.y,
                spriteKey: def.spriteKey,
                name: def.name,
                speed: def.speed,
                interactRange: def.interactRange,
                dialog: def.dialog,
            });
            await npc.loadTextures();
            npc.startIdlePingPong();
            this.container.addChild(npc.container);
            this.npcs.push(npc);
        }));
    }

    private async _spawnEnemies(): Promise<void> {
        await Promise.all((this._def.enemies ?? []).map(async def => {
            const enemy = new Enemy(def);
            await enemy.loadTextures();
            this.container.addChild(enemy.container);
            this.enemies.push(enemy);
        }));
    }

    private async _spawnLoot(): Promise<void> {
        await Promise.all((this._def.loot ?? []).map(async ({ x, y, sortY, item: itemDef }) => {
            const item = new Item({
                id: itemDef.id,
                name: itemDef.name,
                description: itemDef.description,
                slot: itemDef.slot as GearSlot,
                baseStats: itemDef.baseStats,
                mods: itemDef.mods,
            });
            const loot = item.createLoot(x, y);
            await loot.loadTextures();
            if (sortY != null) loot.container.sortY = sortY;
            this.container.addChild(loot.container);
            loot.attachLabelsTo(this.lootLabelsContainer);
            this.lootOnGround.push(loot);
        }));
    }
}
