/**
 * Generic loader that reads a plain JSON area definition and calls the
 * appropriate `Area` methods to spawn all objects.
 *
 * Adding a new area only requires a JSON data file – no new TypeScript class.
 */

import { Area, type AreaOptions } from './area';
import { createNPC } from './npc';
import { createEnemy } from './enemy';
import { createItem } from './items';

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
}

interface AreaEnemyDef {
    x: number;
    y: number;
    spriteKey?: string;
}

interface AreaLootDef {
    x: number;
    y: number;
    sortY?: number;
    id: string;
}

export interface AreaDefinition {
    area: AreaOptions;
    boundaries?: Array<{ x: number; y: number; width: number; height: number }>;
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
        ...(def.props ?? []).map(d =>
            area.placeStaticSprite(d.key, d.x, d.y, { shadow: d.shadow, collider: d.collider }),
        ),
        ...(def.npcs ?? []).map(async npcDef => {
            const npc = createNPC(npcDef.spriteKey, npcDef.x, npcDef.y);
            await npc.loadTextures();
            npc.startIdlePingPong();
            area.container.addChild(npc.container);
            area.npcs.push(npc);
        }),
        ...(def.enemies ?? []).map(async enemyDef => {
            const enemy = createEnemy(enemyDef.spriteKey!, enemyDef.x, enemyDef.y, area.level);
            await enemy.loadTextures();
            area.container.addChild(enemy.container);
            area.enemies.push(enemy);
        }),
        ...(def.loot ?? []).map(async ({ x, y, sortY, id }) => {
            const item = createItem(id, area.level);
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
