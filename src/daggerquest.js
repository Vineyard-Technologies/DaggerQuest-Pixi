// Game state
let app;
let area;
let player;

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

    // Create the area and add its container to the stage
    area = new Farm();
    app.stage.addChild(area.container);
    await area.createBackground();

    // Create player
    await createPlayer();

    // Add pointer handlers for continuous click-to-move
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', onPointerDown);
    app.stage.on('pointermove', onPointerMove);
    app.stage.on('pointerup', onPointerUp);
    app.stage.on('pointerupoutside', onPointerUp);

    // Start game loop
    app.ticker.add(gameLoop);
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

// Pointer handlers for continuous movement
function onPointerDown(event) {
    pointerHeld = true;
    const pos = event.data.global;
    pointerScreenX = pos.x;
    pointerScreenY = pos.y;
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

    if (!player.targetPosition) return;
    
    // In PixiJS v8, ticker is an object with deltaTime property
    const delta = ticker.deltaTime || ticker.elapsedMS / 16.67;
    
    player.update(delta);

    // Pan camera to follow player
    updateCamera();
}

// Start the game when the page loads
window.addEventListener('load', init);
