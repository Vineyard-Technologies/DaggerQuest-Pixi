import * as PIXI from 'pixi.js';
import state from './state';
import { createFarm } from './farm';
import { createPlayer } from './classes';
import { UI } from './ui';
import { bus } from './events';
import { releaseTrackedCPUData } from './assets';
import { HOVER_OUTLINE } from './outlineFilter';
import { Entity } from './entity';
import type { Loot } from './loot';
import { NPC } from './npc';
import { Enemy } from './enemy';
import { waitForLogin, setLoadingProgress, hideOverlays, showLoadingOverlay } from './login';
import { waitForCharacterSelect, hideCharacterSelect } from './characterSelect';

// Ensure the game is only playable when embedded in an iframe on DaggerQuest.com.
// Block direct access (top-level browsing) and embedding on unauthorized sites.
function enforceFrameOrigin(): void {
    // Skip enforcement for local development.
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return;

    // If running as the top-level page (not in an iframe), redirect to DaggerQuest.com.
    // Unauthorized embedding is already blocked by the CSP frame-ancestors header.
    if (window.self === window.top) {
        window.location.replace('https://daggerquest.com');
        throw new Error('DaggerQuest must be played at DaggerQuest.com');
    }
}

// Initialize the game
async function init(): Promise<void> {
    enforceFrameOrigin();

    // Wait for the user to log in before loading the heavy game assets.
    await waitForLogin();

    // Let the player choose (or create) a character.
    const selectedChar = await waitForCharacterSelect();
    hideCharacterSelect();

    showLoadingOverlay();
    setLoadingProgress(5, 'Initializing engine…');

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

    setLoadingProgress(15, 'Loading fonts…');

    await Promise.all([
        document.fonts.load('600 14px Cinzel'),
        document.fonts.load('600 14px Grenze'),
        document.fonts.load('italic 600 14px Grenze'),
    ]);

    setLoadingProgress(30, 'Building world…');

    state.area = await createFarm();
    state.app.stage.addChild(state.area.container);

    setLoadingProgress(60, 'Creating player…');

    await initPlayer(selectedChar.className);

    setLoadingProgress(80, 'Preparing UI…');

    state.ui = new UI();
    await state.ui.load();
    state.app.stage.addChild(state.ui.container);

    bus.on('item-equipped',   ({ slot, item }) => state.ui!.setEquippedItem(slot, item));
    bus.on('item-unequipped', ({ slot })       => state.ui!.clearEquippedItem(slot));
    bus.on('player-died',     ()               => { endActiveNpcInteraction(); state.ui!.showDeathScreen(); });
    bus.on('enemy-killed',    ({ xpReward })   => { if (state.player?.isAlive) state.player.gainExperience(xpReward); });

    state.app.stage.eventMode = 'static';
    state.app.stage.hitArea = state.app.screen;
    state.app.stage.on('pointerdown', onPointerDown);
    state.app.stage.on('pointermove', onPointerMove);
    state.app.stage.on('pointerup', onPointerUp);
    state.app.stage.on('pointerupoutside', onPointerUp);

    state.app.ticker.add(gameLoop);

    setLoadingProgress(100, 'Ready!');
    // Brief pause so the user sees 100 % before the overlay fades out.
    await new Promise(r => setTimeout(r, 400));
    hideOverlays();

    // After the first render uploads textures to GPU, free CPU-side image data.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            releaseTrackedCPUData(state.app!.renderer);
        });
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!state.player) return;
        if (state.player.isCasting) return;
        if (e.key === 'c' || e.key === 'C') {
            state.ui!.toggleEquippedMenu();
        }
        if (e.key === 'i' || e.key === 'I') {
            state.ui!.toggleInventoryMenu();
        }
    });

    // Debug module – only loaded during development, excluded from production builds.
    // Activate/deactivate with F1, or from the browser console with debug() / exitdebug()
    if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).debug = async () => {
            const { initDebug } = await import('./debug');
            initDebug();
        };
        (window as unknown as Record<string, unknown>).exitdebug = async () => {
            const { exitDebug } = await import('./debug');
            exitDebug();
        };
        window.addEventListener('keydown', async (e: KeyboardEvent) => {
            if (e.key === 'F1') {
                e.preventDefault();
                if (window.DEBUG?.active) {
                    const { exitDebug } = await import('./debug');
                    exitDebug();
                } else {
                    const { initDebug } = await import('./debug');
                    initDebug();
                }
            }
        });
    }
}

async function initPlayer(spriteKey: string): Promise<void> {
    state.player = createPlayer(
        spriteKey,
        state.area!.playerStartX,
        state.area!.playerStartY,
    );

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

function findEnemyAtPosition(screenX: number, screenY: number): Enemy | null {
    if (!state.area?.enemies) return null;
    for (const enemy of state.area.enemies) {
        if (!enemy.sprite || !enemy.isAlive) continue;
        const b = enemy.sprite.getBounds();
        if (screenX >= b.x && screenX <= b.x + b.width &&
            screenY >= b.y && screenY <= b.y + b.height) {
            return enemy;
        }
    }
    return null;
}

function updateHoverOutline(): void {
    const overUI = state.ui && state.ui.hitTest(state.input.pointerScreenX, state.input.pointerScreenY);
    const target = overUI ? null : findHoverableAtPosition(state.input.pointerScreenX, state.input.pointerScreenY);

    if (target === state.input.hoveredEntity) return;

    if (state.input.hoveredEntity && state.input.hoveredEntity.sprite) {
        state.input.hoveredEntity.sprite.filters = state.input.hoveredEntity.sprite.filters
            ? state.input.hoveredEntity.sprite.filters.filter((f: PIXI.Filter) => f !== HOVER_OUTLINE)
            : [];
        if (state.input.hoveredEntity.sprite.filters.length === 0) {
            state.input.hoveredEntity.sprite.filters = null;
        }
    }

    state.input.hoveredEntity = target;

    if (state.input.hoveredEntity && state.input.hoveredEntity.sprite) {
        const existing = state.input.hoveredEntity.sprite.filters || [];
        state.input.hoveredEntity.sprite.filters = [...existing, HOVER_OUTLINE];
    }
}

function onPointerDown(event: PIXI.FederatedPointerEvent): void {
    if (event.button === 2) return;

    if (state.ui && state.ui.isDragging) return;

    if (state.ui && state.ui.hitTest(event.data.global.x, event.data.global.y)) return;

    if (!state.player || !state.player.isAlive) return;

    // Block all input while the player is executing a basic attack
    if (state.player.isCasting) return;

    const pos = event.data.global;
    state.input.pointerScreenX = pos.x;
    state.input.pointerScreenY = pos.y;

    // Check for enemy click — initiate basic attack
    const clickedEnemy = findEnemyAtPosition(state.input.pointerScreenX, state.input.pointerScreenY);
    if (clickedEnemy) {
        state.input.pendingLootPickup = null;
        state.input.pendingNpcInteraction = null;
        endActiveNpcInteraction();

        const dist = state.player!.distanceTo(clickedEnemy);
        const range = state.player!.basicAbility?.range ?? state.player!.attackRange;
        if (dist <= range) {
            state.input.pendingAttackTarget = null;
            state.player!.performBasicAttack(clickedEnemy);
            return;
        }

        state.input.pendingAttackTarget = clickedEnemy;
        state.player!.moveToward(clickedEnemy.x, clickedEnemy.y);
        return;
    }

    const loot = findLootAtPosition(state.input.pointerScreenX, state.input.pointerScreenY);
    if (loot) {
        endActiveNpcInteraction();
        state.input.pendingAttackTarget = null;
        const dx = loot.x - state.player!.x;
        const dy = loot.y - state.player!.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= state.player!.pickupRange) {
            state.input.pendingLootPickup = null;
            state.player!.pickupAndEquip(loot);
            return;
        }

        state.input.pendingLootPickup = loot;
        state.player!.moveToward(loot.x, loot.y);
        return;
    }

    const clickedNpc = findNpcAtPosition(state.input.pointerScreenX, state.input.pointerScreenY);
    if (clickedNpc) {
        state.input.pendingLootPickup = null;
        state.input.pendingAttackTarget = null;

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

        state.input.pendingNpcInteraction = clickedNpc;
        state.player!.moveToward(clickedNpc.x, clickedNpc.y);
        return;
    }

    state.input.pendingLootPickup = null;
    state.input.pendingAttackTarget = null;
    endActiveNpcInteraction();

    state.input.pointerHeld = true;
    if (state.player && state.player.isAlive) {
        movePlayerToPointer();
    }
}

function onPointerMove(event: PIXI.FederatedPointerEvent): void {
    const pos = event.data.global;
    state.input.pointerScreenX = pos.x;
    state.input.pointerScreenY = pos.y;
}

function onPointerUp(): void {
    state.input.pointerHeld = false;
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
    state.input.pendingNpcInteraction = null;
    if (!state.area?.npcs) return;
    for (const npc of state.area.npcs) {
        if (npc.isInteracting) {
            npc.endInteraction();
        }
    }
}

function movePlayerToPointer(): void {
    const worldX = state.input.pointerScreenX - state.area!.container.x;
    const worldY = state.input.pointerScreenY - state.area!.container.y;
    state.player!.moveToward(worldX, worldY);
}

function gameLoop(ticker: PIXI.Ticker): void {
    if (!state.player) return;

    updateHoverOutline();

    const casting = state.player.isCasting;

    if (!casting && state.input.pointerHeld && state.player.isAlive) {
        movePlayerToPointer();
        state.input.pendingLootPickup = null;
        state.input.pendingNpcInteraction = null;
        state.input.pendingAttackTarget = null;
    }

    const delta = ticker.deltaTime;
    state.sessionUptimeMs += ticker.deltaMS;
    state.player.update(delta);
    state.player.container.zIndex = state.player.y;

    if (!casting && state.input.pendingAttackTarget) {
        const target = state.input.pendingAttackTarget;
        if (!target.isAlive) {
            state.input.pendingAttackTarget = null;
        } else {
            const dist = state.player.distanceTo(target);
            const range = state.player.basicAbility?.range ?? state.player.attackRange;
            if (dist <= range) {
                state.input.pendingAttackTarget = null;
                state.player.performBasicAttack(target);
            } else if (!state.player.targetPosition) {
                state.input.pendingAttackTarget = null;
            }
        }
    }

    if (!casting && state.input.pendingLootPickup) {
        if (!state.input.pendingLootPickup.sprite || !state.area!.lootOnGround.includes(state.input.pendingLootPickup)) {
            state.input.pendingLootPickup = null;
        } else {
            const dx = state.input.pendingLootPickup.x - state.player.x;
            const dy = state.input.pendingLootPickup.y - state.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const stopped = !state.player.targetPosition;
            const range = stopped
                ? state.player.pickupRange * 2
                : state.player.pickupRange;

            if (dist <= range) {
                const loot = state.input.pendingLootPickup;
                state.input.pendingLootPickup = null;
                state.player.pickupAndEquip(loot);
            } else if (stopped) {
                state.input.pendingLootPickup = null;
            }
        }
    }

    if (!casting && state.input.pendingNpcInteraction) {
        const npc = state.input.pendingNpcInteraction;
        const dist = state.player.distanceTo(npc);
        if (dist <= npc.interactRange) {
            state.input.pendingNpcInteraction = null;
            startNpcInteraction(npc);
        } else if (!state.player.targetPosition) {
            state.input.pendingNpcInteraction = null;
        }
    }

    if (state.area) {
        state.area.update(delta);
    }

    // Update projectiles, removing dead ones
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i]!;
        if (!proj.update(delta)) {
            proj.destroy();
            state.projectiles.splice(i, 1);
        }
    }

    updateCamera();

    if (state.ui) {
        state.ui.layout(state.app!.screen.width, state.app!.screen.height);
        state.ui.update(state.player, ticker.elapsedMS);
    }
}

window.addEventListener('load', init);
