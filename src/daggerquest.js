// Game state
let app;
let area;
let player;
let ui;

// Input state
let pointerHeld = false;
let pointerScreenX = 0;
let pointerScreenY = 0;

// Initialize the game
async function init() {
    app = new PIXI.Application();
    await app.init({
        resizeTo: window,
        antialias: true,
        preference: 'webgpu',
    });
    
    document.body.appendChild(app.canvas);
    app.canvas.id = 'daggerquestCanvas';

    // Prevent the browser context menu so right-click can be used for UI interactions
    document.addEventListener('contextmenu', (e) => e.preventDefault());

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

        // getBounds() returns global (screen-space) coordinates
        const bounds = loot.sprite.getBounds();
        if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
            screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
            return loot;
        }
    }
    return null;
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

    // Check if the click landed on a loot drop within pickup range
    const loot = findLootAtPosition(pointerScreenX, pointerScreenY);
    if (loot) {
        const dx = loot.x - player.x;
        const dy = loot.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= player.pickupRange) {
            // Pick up and equip – don't move toward the click
            player.pickupAndEquip(loot);
            return;
        }
    }

    pointerHeld = true;
    movePlayerToPointer();
}

function onPointerMove(event) {
    if (!pointerHeld) return;
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

    // Continuously update target while pointer is held
    if (pointerHeld) {
        movePlayerToPointer();
    }

    // In PixiJS v8, ticker is an object with deltaTime property
    const delta = ticker.deltaTime || ticker.elapsedMS / 16.67;
    player.update(delta);

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
