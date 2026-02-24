import * as PIXI from 'pixi.js';
import state from './state.js';
import { Farm } from './farm.js';
import { Man, Woman } from './classes.js';
import { UI } from './ui.js';
import { HOVER_OUTLINE } from './outlineFilter.js';
import './debug.js';

// Initialize the game
async function init() {
    state.app = new PIXI.Application();
    // Using 'webgl2' to work around a WebGPU buffer destruction bug.
    // See: https://github.com/Vineyard-Technologies/DaggerQuest/issues/1
    await state.app.init({
        resizeTo: window,
        antialias: true,
        preference: 'webgpu',
        background: '#000000',
        backgroundAlpha: 1,
    });
    
    document.body.appendChild(state.app.canvas);
    state.app.canvas.id = 'daggerquestCanvas';

    // Prevent the browser context menu so right-click can be used for UI interactions
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Preload fonts so PIXI.Text measurements are correct from the start
    await Promise.all([
        document.fonts.load('600 14px Cinzel'),
        document.fonts.load('600 14px Grenze'),
        document.fonts.load('italic 600 14px Grenze'),
    ]);

    // Create the area and add its container to the stage
    state.area = new Farm();
    state.app.stage.addChild(state.area.container);
    await state.area.createBackground();
    await state.area.spawnObjects();

    // Create player
    await createPlayer(Woman);

    // Create HUD (health & mana orbs)
    state.ui = new UI();
    await state.ui.load();
    state.app.stage.addChild(state.ui.container);

    // Add pointer handlers for continuous click-to-move
    state.app.stage.eventMode = 'static';
    state.app.stage.hitArea = state.app.screen;
    state.app.stage.on('pointerdown', onPointerDown);
    state.app.stage.on('pointermove', onPointerMove);
    state.app.stage.on('pointerup', onPointerUp);
    state.app.stage.on('pointerupoutside', onPointerUp);

    // Start game loop
    state.app.ticker.add(gameLoop);

    // Keyboard handlers for debug: H = lose 10 health, M = lose 10 mana
    // Menu toggles: C = equipped menu, I = inventory menu
    window.addEventListener('keydown', (e) => {
        if (!state.player) return;
        if (e.key === 'h' || e.key === 'H') {
            state.player.currentHealth = Math.max(0, state.player.currentHealth - 10);
        }
        if (e.key === 'm' || e.key === 'M') {
            state.player.currentMana = Math.max(0, state.player.currentMana - 10);
        }
        if (e.key === 'c' || e.key === 'C') {
            state.ui.toggleEquippedMenu();
        }
        if (e.key === 'i' || e.key === 'I') {
            state.ui.toggleInventoryMenu();
        }
    });
}

// Create the player character
async function createPlayer(PlayerClass) {
    state.player = new PlayerClass({
        x: state.area.playerStartX,
        y: state.area.playerStartY,
    });

    await state.player.loadTextures();

    state.area.container.addChild(state.player.container);
    await state.player.loadDefaultGear();
    state.player.startIdlePingPong();

    // Position camera on the player immediately
    updateCamera();
}

// Update camera to follow the player, clamped to world bounds
function updateCamera() {
    // Center the camera on the player
    let camX = state.app.screen.width / 2 - state.player.x;
    let camY = state.app.screen.height / 2 - state.player.y;

    // Clamp so we never show outside the world
    camX = Math.min(0, Math.max(camX, state.app.screen.width - state.area.width));
    camY = Math.min(0, Math.max(camY, state.app.screen.height - state.area.height));

    state.area.container.x = camX;
    state.area.container.y = camY;
}

/**
 * Check if a screen position hits any loot on the ground.
 * Uses screen-space coordinates because getBounds() returns global bounds.
 * @param {number} screenX - Screen X (pointer position)
 * @param {number} screenY - Screen Y (pointer position)
 * @returns {Loot|null}
 */
function findLootAtPosition(screenX, screenY) {
    if (!state.area?.lootOnGround) return null;

    for (const loot of state.area.lootOnGround) {
        if (!loot.sprite) continue;

        // Check the name label first (larger click target above the sprite)
        if (loot.nameLabel) {
            const labelBounds = loot.nameLabel.getBounds();
            if (screenX >= labelBounds.x && screenX <= labelBounds.x + labelBounds.width &&
                screenY >= labelBounds.y && screenY <= labelBounds.y + labelBounds.height) {
                return loot;
            }
        }

        // Then check the sprite itself
        const bounds = loot.sprite.getBounds();
        if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
            screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
            return loot;
        }
    }
    return null;
}

/**
 * Find any hoverable entity (loot, enemy, or NPC) at screen position.
 * Returns the entity or null.
 */
function findHoverableAtPosition(screenX, screenY) {
    // Check loot first (smallest, on top visually)
    const loot = findLootAtPosition(screenX, screenY);
    if (loot) return loot;

    // Check enemies
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

    // Check NPCs
    if (state.area?.npcs) {
        for (const npc of state.area.npcs) {
            if (!npc.sprite) continue;
            const b = npc.sprite.getBounds();
            if (screenX >= b.x && screenX <= b.x + b.width &&
                screenY >= b.y && screenY <= b.y + b.height) {
                return npc;
            }
        }
    }

    return null;
}

/**
 * Apply or remove the outline filter based on what the mouse is hovering.
 */
function updateHoverOutline() {
    // Don't show hover outlines when the pointer is over UI
    const overUI = state.ui && state.ui.hitTest(state.pointerScreenX, state.pointerScreenY);
    const target = overUI ? null : findHoverableAtPosition(state.pointerScreenX, state.pointerScreenY);

    if (target === state.hoveredEntity) return;

    // Remove outline from previous entity
    if (state.hoveredEntity && state.hoveredEntity.sprite) {
        state.hoveredEntity.sprite.filters = state.hoveredEntity.sprite.filters
            ? state.hoveredEntity.sprite.filters.filter(f => f !== HOVER_OUTLINE)
            : [];
        if (state.hoveredEntity.sprite.filters.length === 0) {
            state.hoveredEntity.sprite.filters = null;
        }
    }

    state.hoveredEntity = target;

    // Apply outline to new entity
    if (state.hoveredEntity && state.hoveredEntity.sprite) {
        const existing = state.hoveredEntity.sprite.filters || [];
        state.hoveredEntity.sprite.filters = [...existing, HOVER_OUTLINE];
    }
}

// Pointer handlers for continuous movement
function onPointerDown(event) {
    // Ignore right-clicks – those are used for UI slot interactions
    if (event.button === 2) return;

    // Ignore left-clicks while dragging an item in the UI
    if (state.ui && state.ui.isDragging) return;

    // Ignore clicks that land on the UI (menus, orbs, etc.)
    if (state.ui && state.ui.hitTest(event.data.global.x, event.data.global.y)) return;

    const pos = event.data.global;
    state.pointerScreenX = pos.x;
    state.pointerScreenY = pos.y;

    const worldX = state.pointerScreenX - state.area.container.x;
    const worldY = state.pointerScreenY - state.area.container.y;

    // Check if the click landed on a loot drop
    const loot = findLootAtPosition(state.pointerScreenX, state.pointerScreenY);
    if (loot) {
        const dx = loot.x - state.player.x;
        const dy = loot.y - state.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= state.player.pickupRange) {
            // Already in range – pick up immediately
            state.pendingLootPickup = null;
            state.player.pickupAndEquip(loot);
            return;
        }

        // Out of range – walk toward the loot and pick up when close enough.
        // This handles items on top of collidable surfaces (e.g. tables).
        state.pendingLootPickup = loot;
        state.player.moveToward(loot.x, loot.y);
        return;
    }

    // Clicked somewhere else – cancel any pending pickup
    state.pendingLootPickup = null;

    state.pointerHeld = true;
    movePlayerToPointer();
}

function onPointerMove(event) {
    const pos = event.data.global;
    state.pointerScreenX = pos.x;
    state.pointerScreenY = pos.y;
}

function onPointerUp() {
    state.pointerHeld = false;
}

function movePlayerToPointer() {
    const worldX = state.pointerScreenX - state.area.container.x;
    const worldY = state.pointerScreenY - state.area.container.y;
    state.player.moveToward(worldX, worldY);
}

// Main game loop
function gameLoop(ticker) {
    if (!state.player) return;

    // Update hover outline each frame
    updateHoverOutline();

    // Continuously update target while pointer is held
    if (state.pointerHeld) {
        movePlayerToPointer();
        // Cancel any walk-to-pickup if the player is now dragging to move
        state.pendingLootPickup = null;
    }

    // In PixiJS v8, ticker is an object with deltaTime property
    const delta = ticker.deltaTime || ticker.elapsedMS / 16.67;
    state.player.update(delta);

    // ── Pending loot pickup (walk-to-pickup) ────────────────────────
    // Runs after player.update() so collision resolution has already
    // occurred this frame and targetPosition is null if blocked.
    if (state.pendingLootPickup) {
        // Loot may have been picked up or destroyed by something else
        if (!state.pendingLootPickup.sprite || !state.area.lootOnGround.includes(state.pendingLootPickup)) {
            state.pendingLootPickup = null;
        } else {
            const dx = state.pendingLootPickup.x - state.player.x;
            const dy = state.pendingLootPickup.y - state.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Use an extended range (2×) when the player has stopped moving,
            // which typically means collision blocked further approach.
            const stopped = !state.player.targetPosition;
            const range = stopped
                ? state.player.pickupRange * 2
                : state.player.pickupRange;

            if (dist <= range) {
                const loot = state.pendingLootPickup;
                state.pendingLootPickup = null;
                state.player.pickupAndEquip(loot);
            } else if (stopped) {
                // Stopped but still too far – give up
                state.pendingLootPickup = null;
            }
        }
    }

    // Update area entities (enemies, NPCs)
    if (state.area) {
        state.area.update(delta);
    }

    // Pan camera to follow player (always, so window resizes are reflected)
    updateCamera();

    // Update HUD orbs
    if (state.ui) {
        state.ui.layout(state.app.screen.width, state.app.screen.height);
        state.ui.update(state.player, ticker.elapsedMS);
    }
}

// Start the game when the page loads
window.addEventListener('load', init);
