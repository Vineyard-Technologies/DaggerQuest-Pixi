import type * as PIXI from 'pixi.js';
import type { Area } from './area';
import type { Player } from './player';
import type { UI } from './ui';
import type { Entity } from './entity';
import type { Loot } from './loot';
import type { NPC } from './npc';
import type { Projectile } from './projectile';
import { Inventory } from './inventory';

interface InputState {
    pointerHeld: boolean;
    pointerScreenX: number;
    pointerScreenY: number;
    hoveredEntity: Entity | null;
    pendingLootPickup: Loot | null;
    pendingNpcInteraction: NPC | null;
}

interface GameState {
    app: PIXI.Application | null;
    area: Area | null;
    player: Player | null;
    ui: UI | null;
    inventory: Inventory;
    projectiles: Projectile[];
    input: InputState;
    sessionUptimeMs: number;
}

const state: GameState = {
    app: null,
    area: null,
    player: null,
    ui: null,
    inventory: new Inventory(25),
    projectiles: [],
    input: {
        pointerHeld: false,
        pointerScreenX: 0,
        pointerScreenY: 0,
        hoveredEntity: null,
        pendingLootPickup: null,
        pendingNpcInteraction: null,
    },
    sessionUptimeMs: 0,
} satisfies GameState;

export default state;
export type { GameState, InputState };
