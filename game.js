// Game constants
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const PLAYER_SPEED = 150; // pixels per second
const ANIMATION_FPS = 12;

// Game state
let app;
let player;
let playerSprite;
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
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
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

    // Load textures - for now we'll use a placeholder
    await loadTextures();

    // Create player
    createPlayer();

    // Add click handler
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', onStageClick);

    console.log('Game ready! Click anywhere to move the man.');

    // Start game loop
    app.ticker.add(gameLoop);
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
        console.log(`Loaded spritesheet ${fullPath}`);
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
            console.log(`Loaded ${animationTextures.walk[direction].length} walk frames for direction ${direction}`);
        }
        
        if (dirFrames.idle && dirFrames.idle.length > 0) {
            animationTextures.idle[direction] = dirFrames.idle.filter(f => f !== undefined);
            console.log(`Loaded ${animationTextures.idle[direction].length} idle frames for direction ${direction}`);
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
    
    console.log(`Loaded animations for ${Object.keys(animationTextures.walk).length} directions`);
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
    
    playerSprite = new PIXI.AnimatedSprite(idleFrames);
    playerSprite.anchor.set(0.5, 0.7); // Anchor at bottom-center
    playerSprite.x = GAME_WIDTH / 2;
    playerSprite.y = GAME_HEIGHT / 2;
    playerSprite.animationSpeed = ANIMATION_FPS / 60;
    startIdlePingPong();
    
    app.stage.addChild(playerSprite);
    
    player = {
        x: playerSprite.x,
        y: playerSprite.y,
        sprite: playerSprite
    };
    
    currentDirection = parseFloat(firstDirection);
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
    playerSprite.animationSpeed = ANIMATION_FPS / 60;
    playerSprite.gotoAndPlay(0);
    
    playerSprite.onComplete = () => {
        if (!isWalking) {
            idlePingPongForward = !idlePingPongForward;
            if (idlePingPongForward) {
                playerSprite.animationSpeed = ANIMATION_FPS / 60;
                playerSprite.gotoAndPlay(0);
            } else {
                playerSprite.animationSpeed = -(ANIMATION_FPS / 60);
                playerSprite.gotoAndPlay(playerSprite.totalFrames - 1);
            }
        }
    };
}

// Handle stage clicks
function onStageClick(event) {
    const clickPos = event.data.global;
    targetPosition = {
        x: clickPos.x,
        y: clickPos.y
    };
    
    // Calculate direction to target
    const dx = targetPosition.x - player.x;
    const dy = targetPosition.y - player.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Find closest direction
    currentDirection = findClosestDirection(angle);
    
    console.log(`Moving to (${clickPos.x.toFixed(0)}, ${clickPos.y.toFixed(0)}) at angle ${angle.toFixed(1)}° using direction ${currentDirection}`);
    
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
        // Save position, anchor, and current frame
        const savedX = playerSprite.x;
        const savedY = playerSprite.y;
        const savedAnchorX = playerSprite.anchor.x;
        const savedAnchorY = playerSprite.anchor.y;
        const savedFrame = isWalking ? playerSprite.currentFrame : 0;
        
        // Change textures
        playerSprite.textures = walkFrames;
        playerSprite.loop = true;
        
        // Restore position and anchor immediately
        playerSprite.anchor.set(savedAnchorX, savedAnchorY);
        playerSprite.x = savedX;
        playerSprite.y = savedY;
        
        // Update player object
        player.x = savedX;
        player.y = savedY;
        
        // Resume from the same frame (clamped to new animation length), clear ping pong callback
        playerSprite.onComplete = null;
        playerSprite.animationSpeed = ANIMATION_FPS / 60;
        const resumeFrame = savedFrame % walkFrames.length;
        playerSprite.gotoAndPlay(resumeFrame);
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
            // Save position and anchor
            const savedX = playerSprite.x;
            const savedY = playerSprite.y;
            const savedAnchorX = playerSprite.anchor.x;
            const savedAnchorY = playerSprite.anchor.y;
            
            playerSprite.textures = idleFrames;
            
            // Restore position and anchor immediately
            playerSprite.anchor.set(savedAnchorX, savedAnchorY);
            playerSprite.x = savedX;
            playerSprite.y = savedY;
            
            startIdlePingPong();
            
            // Update player object
            player.x = savedX;
            player.y = savedY;
        }
    }
}

// Main game loop
function gameLoop(ticker) {
    if (!targetPosition) return;
    
    // In PixiJS v8, ticker is an object with deltaTime property
    const delta = ticker.deltaTime || ticker.elapsedMS / 16.67;
    
    // Safety check for NaN
    if (isNaN(player.x) || isNaN(player.y)) {
        console.error('Player position is NaN! Resetting to center.');
        player.x = GAME_WIDTH / 2;
        player.y = GAME_HEIGHT / 2;
        playerSprite.x = player.x;
        playerSprite.y = player.y;
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
    
    // Move towards target
    const speed = PLAYER_SPEED * (delta / 60);
    const ratio = Math.min(speed / distance, 1);
    
    player.x += dx * ratio;
    player.y += dy * ratio;
    
    // Update sprite position
    playerSprite.x = player.x;
    playerSprite.y = player.y;
}

// Start the game when the page loads
window.addEventListener('load', init);
