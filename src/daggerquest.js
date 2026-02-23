// Game state
let app;
let area;
let player;
let ui;

// Input state
let pointerHeld = false;
let pointerScreenX = 0;
let pointerScreenY = 0;

// Hover outline state
let hoveredEntity = null;

/**
 * When the player clicks loot that is out of pickup range, we store it here
 * so the player walks toward it and auto-picks it up once close enough.
 * This handles items sitting on top of collidable surfaces (e.g. tables)
 * where the collision polygon prevents the player from reaching normal
 * pickup range.
 */
let pendingLootPickup = null;

// Initialize the game
async function init() {
    app = new PIXI.Application();
    // Using 'webgl2' to work around a WebGPU buffer destruction bug.
    // See: https://github.com/Vineyard-Technologies/DaggerQuest/issues/1
    await app.init({
        resizeTo: window,
        antialias: true,
        preference: 'webgpu',
        background: '#000000',
        backgroundAlpha: 1,
    });
    
    document.body.appendChild(app.canvas);
    app.canvas.id = 'daggerquestCanvas';

    // Prevent the browser context menu so right-click can be used for UI interactions
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Preload fonts so PIXI.Text measurements are correct from the start
    await Promise.all([
        document.fonts.load('600 14px Cinzel'),
        document.fonts.load('600 14px Grenze'),
        document.fonts.load('italic 600 14px Grenze'),
    ]);

    // Create the area and add its container to the stage
    area = new Farm();
    app.stage.addChild(area.container);
    await area.createBackground();
    await area.spawnObjects();

    // Create player
    await createPlayer(Woman);

    // Create HUD (health & mana orbs)
    ui = new UI();
    await ui.load();
    app.stage.addChild(ui.container);

    // Add pointer handlers for continuous click-to-move
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', onPointerDown);
    app.stage.on('pointermove', onPointerMove);
    app.stage.on('pointerup', onPointerUp);
    app.stage.on('pointerupoutside', onPointerUp);

    // Start game loop
    app.ticker.add(gameLoop);

    // Keyboard handlers for debug: H = lose 10 health, M = lose 10 mana
    // Menu toggles: C = equipped menu, I = inventory menu
    window.addEventListener('keydown', (e) => {
        if (!player) return;
        if (e.key === 'h' || e.key === 'H') {
            player.currentHealth = Math.max(0, player.currentHealth - 10);
        }
        if (e.key === 'm' || e.key === 'M') {
            player.currentMana = Math.max(0, player.currentMana - 10);
        }
        if (e.key === 'c' || e.key === 'C') {
            ui.toggleEquippedMenu();
        }
        if (e.key === 'i' || e.key === 'I') {
            ui.toggleInventoryMenu();
        }
    });
}

// Update camera to follow the player, clamped to world bounds
function updateCamera() {
    // Center the camera on the player
    let camX = app.screen.width / 2 - player.x;
    let camY = app.screen.height / 2 - player.y;

    // Clamp so we never show outside the world
    camX = Math.min(0, Math.max(camX, app.screen.width - area.width));
    camY = Math.min(0, Math.max(camY, app.screen.height - area.height));

    area.container.x = camX;
    area.container.y = camY;
}

/**
 * Check if a screen position hits any loot on the ground.
 * Uses screen-space coordinates because getBounds() returns global bounds.
 * @param {number} screenX - Screen X (pointer position)
 * @param {number} screenY - Screen Y (pointer position)
 * @returns {Loot|null}
 */
function findLootAtPosition(screenX, screenY) {
    if (!area?.lootOnGround) return null;

    for (const loot of area.lootOnGround) {
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
    if (area?.enemies) {
        for (const enemy of area.enemies) {
            if (!enemy.sprite || enemy.isAlive === false) continue;
            const b = enemy.sprite.getBounds();
            if (screenX >= b.x && screenX <= b.x + b.width &&
                screenY >= b.y && screenY <= b.y + b.height) {
                return enemy;
            }
        }
    }

    // Check NPCs
    if (area?.npcs) {
        for (const npc of area.npcs) {
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
    const overUI = ui && ui.hitTest(pointerScreenX, pointerScreenY);
    const target = overUI ? null : findHoverableAtPosition(pointerScreenX, pointerScreenY);

    if (target === hoveredEntity) return;

    // Remove outline from previous entity
    if (hoveredEntity && hoveredEntity.sprite) {
        hoveredEntity.sprite.filters = hoveredEntity.sprite.filters
            ? hoveredEntity.sprite.filters.filter(f => f !== HOVER_OUTLINE)
            : [];
        if (hoveredEntity.sprite.filters.length === 0) {
            hoveredEntity.sprite.filters = null;
        }
    }

    hoveredEntity = target;

    // Apply outline to new entity
    if (hoveredEntity && hoveredEntity.sprite) {
        const existing = hoveredEntity.sprite.filters || [];
        hoveredEntity.sprite.filters = [...existing, HOVER_OUTLINE];
    }
}

// Pointer handlers for continuous movement
function onPointerDown(event) {
    // Ignore right-clicks – those are used for UI slot interactions
    if (event.button === 2) return;

    // Ignore left-clicks while dragging an item in the UI
    if (ui && ui.isDragging) return;

    // Ignore clicks that land on the UI (menus, orbs, etc.)
    if (ui && ui.hitTest(event.data.global.x, event.data.global.y)) return;

    const pos = event.data.global;
    pointerScreenX = pos.x;
    pointerScreenY = pos.y;

    const worldX = pointerScreenX - area.container.x;
    const worldY = pointerScreenY - area.container.y;

    // Check if the click landed on a loot drop
    const loot = findLootAtPosition(pointerScreenX, pointerScreenY);
    if (loot) {
        const dx = loot.x - player.x;
        const dy = loot.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= player.pickupRange) {
            // Already in range – pick up immediately
            pendingLootPickup = null;
            player.pickupAndEquip(loot);
            return;
        }

        // Out of range – walk toward the loot and pick up when close enough.
        // This handles items on top of collidable surfaces (e.g. tables).
        pendingLootPickup = loot;
        player.moveToward(loot.x, loot.y);
        return;
    }

    // Clicked somewhere else – cancel any pending pickup
    pendingLootPickup = null;

    pointerHeld = true;
    movePlayerToPointer();
}

function onPointerMove(event) {
    const pos = event.data.global;
    pointerScreenX = pos.x;
    pointerScreenY = pos.y;
}

function onPointerUp() {
    pointerHeld = false;
}

function movePlayerToPointer() {
    const worldX = pointerScreenX - area.container.x;
    const worldY = pointerScreenY - area.container.y;
    player.moveToward(worldX, worldY);
}

// Main game loop
function gameLoop(ticker) {
    if (!player) return;

    // Update hover outline each frame
    updateHoverOutline();

    // Continuously update target while pointer is held
    if (pointerHeld) {
        movePlayerToPointer();
        // Cancel any walk-to-pickup if the player is now dragging to move
        pendingLootPickup = null;
    }

    // In PixiJS v8, ticker is an object with deltaTime property
    const delta = ticker.deltaTime || ticker.elapsedMS / 16.67;
    player.update(delta);

    // ── Pending loot pickup (walk-to-pickup) ────────────────────────
    // Runs after player.update() so collision resolution has already
    // occurred this frame and targetPosition is null if blocked.
    if (pendingLootPickup) {
        // Loot may have been picked up or destroyed by something else
        if (!pendingLootPickup.sprite || !area.lootOnGround.includes(pendingLootPickup)) {
            pendingLootPickup = null;
        } else {
            const dx = pendingLootPickup.x - player.x;
            const dy = pendingLootPickup.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Use an extended range (2×) when the player has stopped moving,
            // which typically means collision blocked further approach.
            const stopped = !player.targetPosition;
            const range = stopped
                ? player.pickupRange * 2
                : player.pickupRange;

            if (dist <= range) {
                const loot = pendingLootPickup;
                pendingLootPickup = null;
                player.pickupAndEquip(loot);
            } else if (stopped) {
                // Stopped but still too far – give up
                pendingLootPickup = null;
            }
        }
    }

    // Update area entities (enemies, NPCs)
    if (area) {
        area.update(delta);
    }

    // Pan camera to follow player (always, so window resizes are reflected)
    updateCamera();

    // Update HUD orbs
    if (ui) {
        ui.layout(app.screen.width, app.screen.height);
        ui.update(player, ticker.elapsedMS);
    }
}

// Start the game when the page loads
window.addEventListener('load', init);
