// Game constants
const DEBUG = true;
const WORLD_WIDTH = 4096;
const WORLD_HEIGHT = 4096;
const WALK_FPS = 30;
const IDLE_FPS = 10;

// Game state
let app;
let worldContainer;
let playerContainer;
let playerBase;
let player;
let playerSprite;
let backgroundTile;
let targetPosition = null;
let isWalking = false;
let currentDirection = 135; // Default direction

// Direction mapping for 8-directional movement
const DIRECTIONS = [-157.5, -135, -112.5, -90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180];

// Animation textures cache
let animationTextures = {
    walk: {},
    idle: {}
};

// Ping pong idle state
let idlePingPongForward = true;

// Initialize the game
async function init() {
    // Create Pixi Application (v8 API)
    app = new PIXI.Application();
    await app.init({
        resizeTo: window,
        background: 0x3d5a4c,
        antialias: true,
        preference: 'webgpu',
        // deviceOptions: {
        //     requiredLimits: {
        //         maxTextureDimension2D: 16384
        //     }
        // }
    });
    
    document.body.appendChild(app.canvas);
    app.canvas.id = 'gameCanvas';

    // Create world container (holds background + all game objects)
    worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);

    // Load textures - for now we'll use a placeholder
    await loadTextures();

    // Create tiled dirt background
    await createBackground();

    // Create player
    createPlayer();

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
}

// Create the player character
function createPlayer() {
    // Use first available direction
    const firstDirection = Object.keys(animationTextures.idle)[0];
    const idleFrames = animationTextures.idle[firstDirection] || [];
    
    if (idleFrames.length === 0) {
        console.error('No idle frames available!');
        return;
    }

    // Container that holds the base diamond + man sprite, positioned in world space
    playerContainer = new PIXI.Container();
    playerContainer.x = WORLD_WIDTH - 250;
    playerContainer.y = WORLD_HEIGHT - 250;

    // Man sprite — updateAnchor reads each frame's per-frame origin data automatically
    playerSprite = new PIXI.AnimatedSprite({ textures: idleFrames, updateAnchor: true });
    playerSprite.x = 0;
    playerSprite.y = -50;
    playerSprite.animationSpeed = IDLE_FPS / 60;

    // Red square base — always matches the man sprite's width
    const halfSize = playerSprite.width / 2;
    playerBase = new PIXI.Graphics();
    playerBase.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
    playerBase.fill({ color: 0xff2222, alpha: 0.85 });
    playerBase.stroke({ color: 0xaa0000, width: 1.5 });
    playerContainer.addChild(playerBase);
    playerContainer.addChild(playerSprite);
    playerBase.visible = DEBUG;

    startIdlePingPong();
    worldContainer.addChild(playerContainer);
    
    player = {
        x: playerContainer.x,
        y: playerContainer.y,
        speed: 250,           // pixels per second (vertical is always half)
        dynamicResizing: false // if true, base resizes to match sprite each frame
    };
    
    currentDirection = parseFloat(firstDirection);

    // Position camera on the player immediately
    updateCamera();
}

// Start idle ping pong animation on the player sprite
function startIdlePingPong() {
    const idleFrames = animationTextures.idle[currentDirection]
        || animationTextures.idle[Object.keys(animationTextures.idle)[0]]
        || [];
    
    if (idleFrames.length <= 1) {
        playerSprite.gotoAndStop(0);
        return;
    }
    
    idlePingPongForward = true;
    playerSprite.loop = false;
    playerSprite.animationSpeed = IDLE_FPS / 60;
    playerSprite.gotoAndPlay(0);
    
    playerSprite.onComplete = () => {
        if (!isWalking) {
            idlePingPongForward = !idlePingPongForward;
            if (idlePingPongForward) {
                playerSprite.animationSpeed = IDLE_FPS / 60;
                playerSprite.gotoAndPlay(0);
            } else {
                playerSprite.animationSpeed = -(IDLE_FPS / 60);
                playerSprite.gotoAndPlay(playerSprite.totalFrames - 1);
            }
        }
    };
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
    targetPosition = {
        x: worldX,
        y: worldY
    };
    
    // Calculate direction to target
    const dx = targetPosition.x - player.x;
    const dy = targetPosition.y - player.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Find closest direction
    currentDirection = findClosestDirection(angle);
    
    // Start walking animation
    startWalkAnimation();
}

// Find the closest available direction
function findClosestDirection(angle) {
    // Normalize angle to -180 to 180 range
    let normalized = angle;
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;
    
    let closest = DIRECTIONS[0];
    let minDiff = Infinity;
    
    for (const dir of DIRECTIONS) {
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

// Start walk animation
function startWalkAnimation() {
    // Get walk frames for the current direction, or fall back to any available direction
    let walkFrames = animationTextures.walk[currentDirection];
    
    if (!walkFrames || walkFrames.length === 0) {
        console.warn(`No frames for direction ${currentDirection}, using fallback`);
        const availableDirections = Object.keys(animationTextures.walk);
        if (availableDirections.length > 0) {
            walkFrames = animationTextures.walk[availableDirections[0]];
        }
    }
    
    if (walkFrames && walkFrames.length > 0) {
        const savedFrame = isWalking ? playerSprite.currentFrame : 0;
        playerSprite.textures = walkFrames;
        playerSprite.loop = true;
        playerSprite.onComplete = null;
        playerSprite.animationSpeed = WALK_FPS / 60;
        playerSprite.gotoAndPlay(savedFrame % walkFrames.length);
        isWalking = true;
    } else {
        console.warn('No walk frames available');
    }
}

// Stop walk animation and show idle
function stopWalkAnimation() {
    if (isWalking) {
        isWalking = false;
        
        // Get idle frames for the current direction, or fall back to any available direction
        let idleFrames = animationTextures.idle[currentDirection];
        
        if (!idleFrames || idleFrames.length === 0) {
            const availableDirections = Object.keys(animationTextures.idle);
            if (availableDirections.length > 0) {
                idleFrames = animationTextures.idle[availableDirections[0]];
            }
        }
        
        if (idleFrames && idleFrames.length > 0) {
            playerSprite.textures = idleFrames;
            startIdlePingPong();
        }
    }
}

// Main game loop
function gameLoop(ticker) {
    // Optionally sync the base size/position to the sprite each frame
    if (player && player.dynamicResizing && playerBase && playerSprite) {
        playerBase.width = playerSprite.width;
        playerBase.height = playerSprite.height / 2;
        // Bottom of sprite = playerSprite.y + playerSprite.height * (1 - anchor.y)
        const spriteBottom = playerSprite.y + playerSprite.height * (1 - playerSprite.anchor.y);
        playerBase.y = spriteBottom - playerBase.height / 2;
    }

    if (!targetPosition) return;
    
    // In PixiJS v8, ticker is an object with deltaTime property
    const delta = ticker.deltaTime || ticker.elapsedMS / 16.67;
    
    // Safety check for NaN
    if (isNaN(player.x) || isNaN(player.y)) {
        console.error('Player position is NaN! Resetting to start.');
        player.x = WORLD_WIDTH - 250;
        player.y = WORLD_HEIGHT - 250;
        playerContainer.x = player.x;
        playerContainer.y = player.y;
        targetPosition = null;
        stopWalkAnimation();
        return;
    }
    
    const dx = targetPosition.x - player.x;
    const dy = targetPosition.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if we've reached the target
    if (distance < 5) {
        targetPosition = null;
        stopWalkAnimation();
        return;
    }
    
    // Elliptical speed: full speed horizontal, half speed vertical, smooth blend for all angles
    const angle = Math.atan2(dy, dx);
    const effectiveSpeed = Math.sqrt(
        Math.pow(player.speed * Math.cos(angle), 2) +
        Math.pow((player.speed / 2) * Math.sin(angle), 2)
    );
    const speed = effectiveSpeed * (delta / 60);
    const ratio = Math.min(speed / distance, 1);
    
    player.x += dx * ratio;
    player.y += dy * ratio;

    // Sync walk animation speed proportionally: full player.speed = WALK_FPS
    if (isWalking && playerSprite.totalFrames > 0) {
        console.log(`movement speed: ${effectiveSpeed.toFixed(1)} px/s | anim speed: ${(playerSprite.animationSpeed * 60).toFixed(1)} fps`);
    }
    
    // Update sprite position
    playerContainer.x = player.x;
    playerContainer.y = player.y;

    // Pan camera to follow player
    updateCamera();
}

// Start the game when the page loads
window.addEventListener('load', init);
