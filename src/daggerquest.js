// Game constants
const WORLD_WIDTH = 4096;
const WORLD_HEIGHT = 4096;
const WALK_FPS = 30;
const IDLE_FPS = 10;

// Game state
let app;
let worldContainer;
let player;
let backgroundTile;

// Direction mapping for multi-directional movement
const DIRECTIONS = 16;
const ANGLES = Array.from({ length: DIRECTIONS }, (_, i) => {
    const step = 360 / DIRECTIONS;
    const angle = i * step;
    // Normalize to -180..180 range
    return angle > 180 ? angle - 360 : angle;
}).sort((a, b) => a - b);

// Initialize the game
async function init() {
    app = new PIXI.Application();
    await app.init({
        resizeTo: window,
        antialias: true,
        preference: 'webgpu',
    });
    
    document.body.appendChild(app.canvas);
    app.canvas.id = 'gameCanvas';

    // Create world container (holds background + all game objects)
    worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);

    // Load textures
    const textures = await loadTextures();

    // Create tiled dirt background
    await createBackground();

    // Create player
    createPlayer(textures);

    // Add click handler
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', onStageClick);

    // Start game loop
    app.ticker.add(gameLoop);
}

// Create the tiled dirt background
async function createBackground() {
    const dirtTexture = await PIXI.Assets.load('./spritesheets/dirt/dirt-0.webp');

    // Height is doubled so that after 0.5 y-scale it covers the full WORLD_HEIGHT in world coords
    backgroundTile = new PIXI.TilingSprite({
        texture: dirtTexture,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT * 2
    });

    // Rotate the tile pattern ~22.5° to break up grid uniformity
    backgroundTile.tileRotation = Math.PI / 8;

    // Squish vertically by 50% to simulate isometric ground-plane perspective.
    // Height*2 * scale.y=0.5 means the sprite visually fills WORLD_HEIGHT in world coords.
    backgroundTile.scale.y = 0.5;

    backgroundTile.x = 0;
    backgroundTile.y = 0;

    worldContainer.addChildAt(backgroundTile, 0);
}

// Load animation textures
async function loadTextures() {
    const animationTextures = { walk: {}, idle: {} };

    // Load the manifest to know which spritesheets exist
    const manifest = await fetch('./spritesheets/manifest.json').then(r => r.json());
    const manSheets = manifest.man || [];
    
    if (manSheets.length === 0) {
        console.error('No man spritesheets found in manifest!');
        return;
    }
    
    // Load all spritesheets listed in the manifest
    const spritesheets = [];
    for (const sheetPath of manSheets) {
        // Paths in manifest are relative to spritesheets folder, so prepend the folder path
        const fullPath = `./spritesheets/${sheetPath.replace('./', '')}`;
        const spritesheet = await PIXI.Assets.load(fullPath);
        spritesheets.push(spritesheet);
    }
    
    // Parse all frames from all spritesheets
    const framesByDirection = {};
    
    for (const spritesheet of spritesheets) {
        for (const frameName in spritesheet.textures) {
            // Parse frame name: man-walk_135-000
            const match = frameName.match(/man-(\w+)_([-\d.]+)-(\d+)/);
            if (match) {
                const animType = match[1]; // walk, idle, etc.
                const direction = parseFloat(match[2]);
                const frameNum = parseInt(match[3]);
                
                if (!framesByDirection[direction]) {
                    framesByDirection[direction] = { walk: [], idle: [] };
                }
                
                if (!framesByDirection[direction][animType]) {
                    framesByDirection[direction][animType] = [];
                }
                
                framesByDirection[direction][animType][frameNum] = spritesheet.textures[frameName];
            }
        }
    }
    
    // Organize frames into animation textures
    for (const direction in framesByDirection) {
        const dirFrames = framesByDirection[direction];
        
        if (dirFrames.walk && dirFrames.walk.length > 0) {
            // Filter out any undefined entries (in case frames aren't sequential)
            animationTextures.walk[direction] = dirFrames.walk.filter(f => f !== undefined);
        }
        
        if (dirFrames.idle && dirFrames.idle.length > 0) {
            animationTextures.idle[direction] = dirFrames.idle.filter(f => f !== undefined);
        } else if (animationTextures.walk[direction]) {
            // Fall back to first walk frame if no idle animation exists
            animationTextures.idle[direction] = [animationTextures.walk[direction][0]];
        }
    }
    
    // If no textures loaded at all, create a placeholder
    if (Object.keys(animationTextures.walk).length === 0) {
        console.warn('No textures loaded, creating placeholder');
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x00ff00);
        graphics.drawCircle(0, 0, 30);
        graphics.endFill();
        const placeholder = app.renderer.generateTexture(graphics);
        animationTextures.walk[135] = [placeholder];
        animationTextures.idle[135] = [placeholder];
    }

    return animationTextures;
}

// Create the player character
function createPlayer(textures) {
    // Use first available direction
    const firstDirection = Object.keys(textures.idle)[0];
    const idleFrames = textures.idle[firstDirection] || [];
    
    if (idleFrames.length === 0) {
        console.error('No idle frames available!');
        return;
    }

    player = new Player({
        x: WORLD_WIDTH - 250,
        y: WORLD_HEIGHT - 250,
        speed: 250,
        textures: textures
    });

    worldContainer.addChild(player.container);
    player.startIdlePingPong();

    // Position camera on the player immediately
    updateCamera();
}

// Update camera to follow the player, clamped to world bounds
function updateCamera() {
    // Center the camera on the player
    let camX = app.screen.width / 2 - player.x;
    let camY = app.screen.height / 2 - player.y;

    // Clamp so we never show outside the world
    camX = Math.min(0, Math.max(camX, app.screen.width - WORLD_WIDTH));
    camY = Math.min(0, Math.max(camY, app.screen.height - WORLD_HEIGHT));

    worldContainer.x = camX;
    worldContainer.y = camY;
}

// Handle stage clicks
function onStageClick(event) {
    const clickPos = event.data.global;
    // Convert screen coordinates to world coordinates
    const worldX = clickPos.x - worldContainer.x;
    const worldY = clickPos.y - worldContainer.y;
    player.moveToward(worldX, worldY);
}

// Find the closest available direction
function findClosestDirection(angle) {
    // Normalize angle to -180 to 180 range
    let normalized = angle;
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;
    
    let closest = ANGLES[0];
    let minDiff = Infinity;
    
    for (const dir of ANGLES) {
        // Calculate the absolute difference, considering wrap-around
        let diff = Math.abs(normalized - dir);
        
        // Handle wrap-around at -180/180
        if (diff > 180) {
            diff = 360 - diff;
        }
        
        if (diff < minDiff) {
            minDiff = diff;
            closest = dir;
        }
    }
    
    return closest;
}

// Main game loop
function gameLoop(ticker) {
    if (!player) return;

    if (!player.targetPosition) return;
    
    // In PixiJS v8, ticker is an object with deltaTime property
    const delta = ticker.deltaTime || ticker.elapsedMS / 16.67;
    
    player.update(delta);

    // Sync walk animation speed proportionally: full player.speed = WALK_FPS
    if (player.isWalking && player.sprite.totalFrames > 0) {
        console.log(`movement speed: ${player.speed.toFixed(1)} px/s | anim speed: ${(player.sprite.animationSpeed * 60).toFixed(1)} fps`);
    }

    // Pan camera to follow player
    updateCamera();
}

// Start the game when the page loads
window.addEventListener('load', init);
