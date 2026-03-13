import type * as PIXI from 'pixi.js';
import type { Area } from './area';
import type { Player } from './player';
import type { UI } from './ui';
import type { Entity } from './entity';
import type { Enemy } from './enemy';
import type { Loot } from './loot';
import type { NPC } from './npc';
import type { Projectile } from './projectile';
import { Inventory } from './inventory';

// ── Pending-interaction discriminated union ──────────────────────────────
// Replaces three nullable fields with a single tagged union so only one
// pending interaction can be active at a time.

type PendingInteraction =
    | { readonly kind: 'none' }
    | { readonly kind: 'loot';   readonly target: Loot }
    | { readonly kind: 'npc';    readonly target: NPC }
    | { readonly kind: 'attack'; readonly target: Enemy };

const PENDING_NONE: PendingInteraction = { kind: 'none' } as const;

interface InputState {
    pointerHeld: boolean;
    pointerScreenX: number;
    pointerScreenY: number;
    hoveredEntity: Entity | null;
    pending: PendingInteraction;
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
        pending: PENDING_NONE,
    },
    sessionUptimeMs: 0,
} satisfies GameState;

export default state;
export { PENDING_NONE };
export type { GameState, InputState, PendingInteraction };
