/**
 * Base class for all game entities (player, enemies, props, etc.)
 * Entities have a position, a container, and an optional animated sprite.
 */
class Entity {
    constructor({ x, y, spriteKey = null, directions = 16, direction = 0, defaultAnimFps = 10 }) {
        this.x = x;
        this.y = y;
        this.spriteKey = spriteKey;
        this.direction = direction;
        this.defaultAnimFps = defaultAnimFps;

        // Number of discrete facing directions and their computed angles
        this.directions = directions;
        this.angles = Array.from({ length: directions }, (_, i) => {
            const step = 360 / directions;
            const angle = i * step;
            return angle > 180 ? angle - 360 : angle;
        }).sort((a, b) => a - b);

        // Animation textures keyed by name, then direction: { animName: { angle: [frames] } }
        this.textures = {};

        // PIXI display objects
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;

        this.sprite = null;
    }

    /**
     * Load spritesheets from the manifest for this entity's spriteKey,
     * parse animation frames by name and direction, and create the animated sprite.
     */
    async loadTextures() {
        if (!this.spriteKey) {
            console.warn('Entity has no spriteKey – skipping texture load');
            return;
        }

        const animationTextures = {};

        // Load the manifest to know which spritesheets exist
        const manifest = await fetch('./spritesheets/manifest.json').then(r => r.json());
        const sheets = manifest[this.spriteKey] || [];

        if (sheets.length === 0) {
            console.error(`No ${this.spriteKey} spritesheets found in manifest!`);
            return;
        }

        // Load all spritesheets listed in the manifest
        const spritesheets = [];
        for (const sheetPath of sheets) {
            const fullPath = `./spritesheets/${sheetPath.replace('./', '')}`;
            const spritesheet = await PIXI.Assets.load(fullPath);
            spritesheets.push(spritesheet);
        }

        // Parse all frames from all spritesheets
        // Frame naming convention: spriteKey-animName_direction-frameNum
        const keyPattern = new RegExp(`${this.spriteKey}-(\\w+)_([\\-\\d.]+)-(\\d+)`);

        for (const spritesheet of spritesheets) {
            for (const frameName in spritesheet.textures) {
                const match = frameName.match(keyPattern);
                if (match) {
                    const animName = match[1];
                    const direction = parseFloat(match[2]);
                    const frameNum = parseInt(match[3]);

                    if (!animationTextures[animName]) {
                        animationTextures[animName] = {};
                    }
                    if (!animationTextures[animName][direction]) {
                        animationTextures[animName][direction] = [];
                    }

                    animationTextures[animName][direction][frameNum] = spritesheet.textures[frameName];
                }
            }
        }

        // Filter out any undefined entries from sparse arrays
        for (const animName in animationTextures) {
            for (const direction in animationTextures[animName]) {
                animationTextures[animName][direction] =
                    animationTextures[animName][direction].filter(f => f !== undefined);
            }
        }

        this.textures = animationTextures;
        this.initSprite();
    }

    /** Create (or re-create) the animated sprite from loaded textures */
    initSprite() {
        // Use the first available animation and direction
        const firstAnim = Object.keys(this.textures)[0];
        if (!firstAnim) return;

        const firstDirection = Object.keys(this.textures[firstAnim])[0];
        const frames = (firstDirection && this.textures[firstAnim][firstDirection]) || [];

        if (frames.length > 0) {
            this.sprite = new PIXI.AnimatedSprite({ textures: frames, updateAnchor: true });
            this.sprite.x = 0;
            this.sprite.y = 0;
            this.sprite.animationSpeed = this.defaultAnimFps / 60;
            this.container.addChild(this.sprite);
            this.direction = parseFloat(firstDirection);
        }
    }

    /**
     * Get frames for a given animation name and direction, with fallback.
     * Returns the frames array, or an empty array if nothing is available.
     */
    getAnimationFrames(animName, direction) {
        const anim = this.textures[animName];
        if (!anim) return [];

        let frames = anim[direction];
        if (frames && frames.length > 0) return frames;

        // Fallback to first available direction for this animation
        const fallbackDir = Object.keys(anim)[0];
        return (fallbackDir && anim[fallbackDir]) || [];
    }

    /** Find the closest facing angle to a given angle in degrees */
    findClosestDirection(angle) {
        let normalized = angle;
        while (normalized > 180) normalized -= 360;
        while (normalized < -180) normalized += 360;

        let closest = this.angles[0];
        let minDiff = Infinity;

        for (const dir of this.angles) {
            let diff = Math.abs(normalized - dir);
            if (diff > 180) diff = 360 - diff;
            if (diff < minDiff) {
                minDiff = diff;
                closest = dir;
            }
        }

        return closest;
    }
}
