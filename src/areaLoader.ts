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

// ── loadArea ──────────────────────────────────────────────────────────────

/**
 * Build an `Area` from a plain `AreaDefinition` (typically loaded from a
 * JSON file), spawn every object described in the definition, and return
 * the fully-initialised area ready for use.
 */
export async function loadArea(def: AreaDefinition): Promise<Area> {
    const area = new Area(def.area);

    await area.createBackground();

    for (const b of def.boundaries ?? []) {
        area.boundaries.push(b);
    }

    await Promise.all([
        ...(def.buildings ?? []).map(d =>
            area.placeStaticSprite(d.key, d.x, d.y, { shadow: d.shadow, collider: d.collider }),
        ),
        ...(def.fences ?? []).map(d =>
            area.placeStaticSprite(d.key, d.x, d.y, { shadow: d.shadow, collider: d.collider }),
        ),
        ...(def.props ?? []).map(d =>
            area.placeStaticSprite(d.key, d.x, d.y, { shadow: d.shadow, collider: d.collider }),
        ),
        ...(def.npcs ?? []).map(async npcDef => {
            const npc = new NPC({
                x: npcDef.x,
                y: npcDef.y,
                spriteKey: npcDef.spriteKey,
                name: npcDef.name,
                speed: npcDef.speed,
                interactRange: npcDef.interactRange,
                dialog: npcDef.dialog,
            });
            await npc.loadTextures();
            npc.startIdlePingPong();
            area.container.addChild(npc.container);
            area.npcs.push(npc);
        }),
        ...(def.enemies ?? []).map(async enemyDef => {
            const enemy = new Enemy(enemyDef);
            await enemy.loadTextures();
            area.container.addChild(enemy.container);
            area.enemies.push(enemy);
        }),
        ...(def.loot ?? []).map(async ({ x, y, sortY, item: itemDef }) => {
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
            area.container.addChild(loot.container);
            loot.attachLabelsTo(area.lootLabelsContainer);
            area.lootOnGround.push(loot);
        }),
    ]);

    return area;
}
