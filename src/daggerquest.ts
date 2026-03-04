import * as PIXI from 'pixi.js';
import state from './state';
import { Farm } from './farm';
import { Man, Woman } from './classes';
import { UI } from './ui';
import { bus } from './events';
import { HOVER_OUTLINE } from './outlineFilter';
import { Entity } from './entity';
import type { Loot } from './loot';
import { NPC } from './npc';
import type { Player } from './player';

type PlayerClass = new (opts: { x: number; y: number }) => Player;

// Ensure the game is only playable when embedded in an iframe on DaggerQuest.com.
// Block direct access (top-level browsing) and embedding on unauthorized sites.
function enforceFrameOrigin(): void {
    // Skip enforcement for local development.
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return;

    const allowedOrigins = ['https://daggerquest.com', 'https://www.daggerquest.com'];

    // If running as the top-level page (not in an iframe), redirect to DaggerQuest.com.
    if (window.self === window.top) {
        window.location.replace('https://daggerquest.com');
        throw new Error('DaggerQuest must be played at DaggerQuest.com');
    }

    // If in an iframe, verify the parent origin is allowed.
    // Use postMessage handshake: the parent must respond to prove its origin.
    let verified = false;
    window.addEventListener('message', (event: MessageEvent) => {
        if (allowedOrigins.includes(event.origin) && event.data === 'daggerquest-origin-ok') {
            verified = true;
        }
    });
    window.parent.postMessage('daggerquest-origin-check', '*');
    // Give the parent a short window to respond before blocking.
    setTimeout(() => {
        if (!verified) {
            state.app?.destroy(true, { children: true });
            window.location.replace('https://daggerquest.com');
        }
    }, 2000);
}

// Initialize the game
async function init(): Promise<void> {
    enforceFrameOrigin();

    state.app = new PIXI.Application();
    await state.app.init({
        resizeTo: window,
        antialias: true,
        preference: 'webgpu',
        background: '#000000',
        backgroundAlpha: 1,
    });

    document.body.appendChild(state.app.canvas);
    state.app.canvas.id = 'daggerquestCanvas';

    document.addEventListener('contextmenu', (e: Event) => e.preventDefault());

    await Promise.all([
        document.fonts.load('600 14px Cinzel'),
        document.fonts.load('600 14px Grenze'),
        document.fonts.load('italic 600 14px Grenze'),
    ]);

    state.area = new Farm();
    state.app.stage.addChild(state.area.container);
    await state.area.createBackground();
    await state.area.spawnObjects();

    await createPlayer(Woman);

    state.ui = new UI();
    await state.ui.load();
    state.app.stage.addChild(state.ui.container);

    bus.on('item-equipped',   ({ slot, item }) => state.ui!.setEquippedItem(slot, item));
    bus.on('item-unequipped', ({ slot })       => state.ui!.clearEquippedItem(slot));

    state.app.stage.eventMode = 'static';
    state.app.stage.hitArea = state.app.screen;
    state.app.stage.on('pointerdown', onPointerDown);
    state.app.stage.on('pointermove', onPointerMove);
    state.app.stage.on('pointerup', onPointerUp);
    state.app.stage.on('pointerupoutside', onPointerUp);

    state.app.ticker.add(gameLoop);

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!state.player) return;
        if (e.key === 'c' || e.key === 'C') {
            state.ui!.toggleEquippedMenu();
        }
        if (e.key === 'i' || e.key === 'I') {
            state.ui!.toggleInventoryMenu();
        }
    });

    // Debug module – only loaded during development, excluded from production builds.
    // Activate from the browser console with: debug()
    if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).debug = async () => {
            const { initDebug } = await import('./debug');
            initDebug();
        };
    }
}

async function createPlayer(PlayerClassCtor: PlayerClass): Promise<void> {
    state.player = new PlayerClassCtor({
        x: state.area!.playerStartX,
        y: state.area!.playerStartY,
    });

    await state.player.loadTextures();

    state.area!.container.addChild(state.player.container);
    await state.player.loadDefaultGear();
    state.player.startIdlePingPong();

    updateCamera();
}

function updateCamera(): void {
    const app = state.app!;
    const player = state.player!;
    const area = state.area!;

    let camX = app.screen.width / 2 - player.x;
    let camY = app.screen.height / 2 - player.y;

    camX = Math.min(0, Math.max(camX, app.screen.width - area.width));
    camY = Math.min(0, Math.max(camY, app.screen.height - area.height));

    area.container.x = camX;
    area.container.y = camY;
}

function findLootAtPosition(screenX: number, screenY: number): Loot | null {
    if (!state.area?.lootOnGround) return null;

    for (const loot of state.area.lootOnGround) {
        if (!loot.sprite) continue;

        if (loot.nameLabel) {
            const labelBounds = loot.nameLabel.getBounds();
            if (screenX >= labelBounds.x && screenX <= labelBounds.x + labelBounds.width &&
                screenY >= labelBounds.y && screenY <= labelBounds.y + labelBounds.height) {
                return loot;
            }
        }

        const bounds = loot.sprite.getBounds();
        if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
            screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
            return loot;
        }
    }
    return null;
}

function findHoverableAtPosition(screenX: number, screenY: number): Entity | null {
    const loot = findLootAtPosition(screenX, screenY);
    if (loot) return loot;

    if (state.area?.enemies) {
        for (const enemy of state.area.enemies) {
            if (!enemy.sprite || enemy.isAlive === false) continue;
            const b = enemy.sprite.getBounds();
            if (screenX >= b.x && screenX <= b.x + b.width &&
                screenY >= b.y && screenY <= b.y + b.height) {
                return enemy;
            }
        }
    }

    if (state.area?.npcs) {
        for (const npc of state.area.npcs) {
            if (!npc.sprite) continue;

            const dialogBounds = npc.getDialogBounds();
            if (dialogBounds) {
                if (screenX >= dialogBounds.x && screenX <= dialogBounds.x + dialogBounds.width &&
                    screenY >= dialogBounds.y && screenY <= dialogBounds.y + dialogBounds.height) {
                    return npc;
                }
            }

            const b = npc.sprite.getBounds();
            if (screenX >= b.x && screenX <= b.x + b.width &&
                screenY >= b.y && screenY <= b.y + b.height) {
                return npc;
            }
        }
    }

    return null;
}

function updateHoverOutline(): void {
    const overUI = state.ui && state.ui.hitTest(state.pointerScreenX, state.pointerScreenY);
    const target = overUI ? null : findHoverableAtPosition(state.pointerScreenX, state.pointerScreenY);

    if (target === state.hoveredEntity) return;

    if (state.hoveredEntity && state.hoveredEntity.sprite) {
        state.hoveredEntity.sprite.filters = state.hoveredEntity.sprite.filters
            ? state.hoveredEntity.sprite.filters.filter((f: PIXI.Filter) => f !== HOVER_OUTLINE)
            : [];
        if (state.hoveredEntity.sprite.filters.length === 0) {
            state.hoveredEntity.sprite.filters = null;
        }
    }

    state.hoveredEntity = target;

    if (state.hoveredEntity && state.hoveredEntity.sprite) {
        const existing = state.hoveredEntity.sprite.filters || [];
        state.hoveredEntity.sprite.filters = [...existing, HOVER_OUTLINE];
    }
}

function onPointerDown(event: PIXI.FederatedPointerEvent): void {
    if (event.button === 2) return;

    if (state.ui && state.ui.isDragging) return;

    if (state.ui && state.ui.hitTest(event.data.global.x, event.data.global.y)) return;

    const pos = event.data.global;
    state.pointerScreenX = pos.x;
    state.pointerScreenY = pos.y;

    const loot = findLootAtPosition(state.pointerScreenX, state.pointerScreenY);
    if (loot) {
        endActiveNpcInteraction();
        const dx = loot.x - state.player!.x;
        const dy = loot.y - state.player!.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= state.player!.pickupRange) {
            state.pendingLootPickup = null;
            state.player!.pickupAndEquip(loot);
            return;
        }

        state.pendingLootPickup = loot;
        state.player!.moveToward(loot.x, loot.y);
        return;
    }

    const clickedNpc = findNpcAtPosition(state.pointerScreenX, state.pointerScreenY);
    if (clickedNpc) {
        state.pendingLootPickup = null;

        if (clickedNpc.isInteracting) {
            const next = clickedNpc.advanceDialog();
            if (next) {
                clickedNpc.showDialog(next);
            }
            return;
        }

        endActiveNpcInteraction();

        const dist = state.player!.distanceTo(clickedNpc);
        if (dist <= clickedNpc.interactRange) {
            startNpcInteraction(clickedNpc);
            return;
        }

        state.pendingNpcInteraction = clickedNpc;
        state.player!.moveToward(clickedNpc.x, clickedNpc.y);
        return;
    }

    state.pendingLootPickup = null;
    endActiveNpcInteraction();

    state.pointerHeld = true;
    movePlayerToPointer();
}

function onPointerMove(event: PIXI.FederatedPointerEvent): void {
    const pos = event.data.global;
    state.pointerScreenX = pos.x;
    state.pointerScreenY = pos.y;
}

function onPointerUp(): void {
    state.pointerHeld = false;
}

function findNpcAtPosition(screenX: number, screenY: number): NPC | null {
    if (!state.area?.npcs) return null;
    for (const npc of state.area.npcs) {
        if (!npc.sprite) continue;

        const dialogBounds = npc.getDialogBounds();
        if (dialogBounds) {
            if (screenX >= dialogBounds.x && screenX <= dialogBounds.x + dialogBounds.width &&
                screenY >= dialogBounds.y && screenY <= dialogBounds.y + dialogBounds.height) {
                return npc;
            }
        }

        const b = npc.sprite.getBounds();
        if (screenX >= b.x && screenX <= b.x + b.width &&
            screenY >= b.y && screenY <= b.y + b.height) {
            return npc;
        }
    }
    return null;
}

function startNpcInteraction(npc: NPC): void {
    const text = npc.interact();
    if (text) {
        npc.showDialog(text);
        state.player!.targetPosition = null;
        state.player!.stopWalkAnimation();
        state.player!.faceEntity(npc);
    }
}

function endActiveNpcInteraction(): void {
    state.pendingNpcInteraction = null;
    if (!state.area?.npcs) return;
    for (const npc of state.area.npcs) {
        if (npc.isInteracting) {
            npc.endInteraction();
        }
    }
}

function movePlayerToPointer(): void {
    const worldX = state.pointerScreenX - state.area!.container.x;
    const worldY = state.pointerScreenY - state.area!.container.y;
    state.player!.moveToward(worldX, worldY);
}

function gameLoop(ticker: PIXI.Ticker): void {
    if (!state.player) return;

    updateHoverOutline();

    if (state.pointerHeld) {
        movePlayerToPointer();
        state.pendingLootPickup = null;
        state.pendingNpcInteraction = null;
    }

    const delta = ticker.deltaTime;
    state.player.update(delta);
    state.player.container.zIndex = state.player.y;

    if (state.pendingLootPickup) {
        if (!state.pendingLootPickup.sprite || !state.area!.lootOnGround.includes(state.pendingLootPickup)) {
            state.pendingLootPickup = null;
        } else {
            const dx = state.pendingLootPickup.x - state.player.x;
            const dy = state.pendingLootPickup.y - state.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const stopped = !state.player.targetPosition;
            const range = stopped
                ? state.player.pickupRange * 2
                : state.player.pickupRange;

            if (dist <= range) {
                const loot = state.pendingLootPickup;
                state.pendingLootPickup = null;
                state.player.pickupAndEquip(loot);
            } else if (stopped) {
                state.pendingLootPickup = null;
            }
        }
    }

    if (state.pendingNpcInteraction) {
        const npc = state.pendingNpcInteraction;
        const dist = state.player.distanceTo(npc);
        if (dist <= npc.interactRange) {
            state.pendingNpcInteraction = null;
            startNpcInteraction(npc);
        } else if (!state.player.targetPosition) {
            state.pendingNpcInteraction = null;
        }
    }

    if (state.area) {
        state.area.update(delta);
    }

    updateCamera();

    if (state.ui) {
        state.ui.layout(state.app!.screen.width, state.app!.screen.height);
        state.ui.update(state.player, ticker.elapsedMS);
    }
}

window.addEventListener('load', init);
