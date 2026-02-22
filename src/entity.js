/**
 * Base class for all game entities (player, enemies, props, etc.)
 * Entities have a position, a container, and an optional animated sprite.
 */
class Entity {
    constructor({ x, y, spriteKey = null, directions = 16, direction = 0, animFps = {} }) {
        this.x = x;
        this.y = y;
        this.spriteKey = spriteKey;
        this.direction = direction;
        this.animFps = animFps;

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

        /**
         * Normalised collision polygon [[x,y], …] (0–1 relative to
         * the sprite's texture dimensions).  Set from COLLISION_POLYS
         * for static objects or CHARACTER_COLLISION_BOX for characters.
         */
        this._collisionPolyNorm = null;
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

        // Build reverse lookup: textures array reference -> { animName, direction }
        this._textureMap = new Map();
        for (const animName in this.textures) {
            for (const direction in this.textures[animName]) {
                this._textureMap.set(this.textures[animName][direction], { animName, direction: parseFloat(direction) });
            }
        }

        // Try to load shadow textures (spriteKey_shadow)
        const shadowKey = `${this.spriteKey}_shadow`;
        const shadowSheets = manifest[shadowKey] || [];

        if (shadowSheets.length > 0) {
            const shadowAnimationTextures = {};
            const shadowKeyPattern = new RegExp(`${shadowKey}-(\\w+)_([\\-\\d.]+)-(\\d+)`);

            for (const sheetPath of shadowSheets) {
                const fullPath = `./spritesheets/${sheetPath.replace('./', '')}`;
                const spritesheet = await PIXI.Assets.load(fullPath);

                for (const frameName in spritesheet.textures) {
                    const match = frameName.match(shadowKeyPattern);
                    if (match) {
                        const animName = match[1];
                        const direction = parseFloat(match[2]);
                        const frameNum = parseInt(match[3]);

                        if (!shadowAnimationTextures[animName]) shadowAnimationTextures[animName] = {};
                        if (!shadowAnimationTextures[animName][direction]) shadowAnimationTextures[animName][direction] = [];
                        shadowAnimationTextures[animName][direction][frameNum] = spritesheet.textures[frameName];
                    }
                }
            }

            for (const animName in shadowAnimationTextures) {
                for (const direction in shadowAnimationTextures[animName]) {
                    shadowAnimationTextures[animName][direction] =
                        shadowAnimationTextures[animName][direction].filter(f => f !== undefined);
                }
            }

            this.shadowTextures = shadowAnimationTextures;
        }

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
            // Create shadow sprite behind the main sprite
            if (this.shadowTextures) {
                const shadowFrames = this.getShadowFrames(firstAnim, parseFloat(firstDirection));
                if (shadowFrames.length > 0) {
                    this.shadowSprite = new PIXI.AnimatedSprite({ textures: shadowFrames, updateAnchor: true });
                    this.shadowSprite.x = 0;
                    this.shadowSprite.y = 0;
                    this.shadowSprite.alpha = 0.5;
                    this.shadowSprite.filters = [new PIXI.BlurFilter(4)];
                    this.container.addChild(this.shadowSprite);
                }
            }

            this.sprite = new PIXI.AnimatedSprite({ textures: frames, updateAnchor: true });
            this.sprite.x = 0;
            this.sprite.y = 0;
            this.sprite.animationSpeed = this.getAnimFps(firstAnim) / 60;
            this.container.addChild(this.sprite);
            this.direction = parseFloat(firstDirection);

            // Register ticker to keep shadow in sync with main sprite
            if (this.shadowSprite) {
                this._lastSpriteTextures = this.sprite.textures;
                this._shadowTickerFn = () => this._syncShadow();
                PIXI.Ticker.shared.add(this._shadowTickerFn);
            }
        }
    }

    /**
     * Get shadow frames for a given animation name and direction, with fallback.
     * Returns the frames array, or an empty array if shadow textures are unavailable.
     */
    getShadowFrames(animName, direction) {
        const anim = this.shadowTextures?.[animName];
        if (!anim) return [];

        let frames = anim[direction];
        if (frames && frames.length > 0) return frames;

        // Fallback to first available direction for this shadow animation
        const fallbackDir = Object.keys(anim)[0];
        return (fallbackDir && anim[fallbackDir]) || [];
    }

    /**
     * Sync the shadow sprite to match the main sprite's current animation and frame.
     * Called every PIXI tick via _shadowTickerFn.
     */
    _syncShadow() {
        if (!this.shadowSprite || !this.sprite) return;

        // When the main sprite's texture set changes, update the shadow to match
        if (this.sprite.textures !== this._lastSpriteTextures) {
            this._lastSpriteTextures = this.sprite.textures;
            const info = this._textureMap?.get(this.sprite.textures);
            if (info) {
                const shadowFrames = this.getShadowFrames(info.animName, info.direction);
                if (shadowFrames.length > 0) {
                    this.shadowSprite.textures = shadowFrames;
                }
            }
        }

        // Always mirror the current frame (clamp to shadow's frame count)
        const frame = Math.min(this.sprite.currentFrame, this.shadowSprite.totalFrames - 1);
        if (this.shadowSprite.currentFrame !== frame) {
            this.shadowSprite.gotoAndStop(frame);
        }
    }

    /**
     * Remove this entity from the scene and clean up the shadow ticker.
     */
    destroy() {
        if (this._shadowTickerFn) {
            PIXI.Ticker.shared.remove(this._shadowTickerFn);
            this._shadowTickerFn = null;
        }
        if (this.container.parent) {
            this.container.parent.removeChild(this.container);
        }
    }

    /** Return the fps for a named animation */
    getAnimFps(animName) {
        return this.animFps[animName] ?? 30;
    }

    // ── Collision helpers ─────────────────────────────────────────────

    /**
     * Set the normalised collision polygon for this entity.
     * Called automatically when the sprite key is looked up or can be
     * assigned manually.
     * @param {Array<[number,number]>} normPoly
     */
    setCollisionPoly(normPoly) {
        this._collisionPolyNorm = normPoly;
    }

    /**
     * Get the current world-space collision polygon.
     * Uses the sprite's current texture dimensions and anchor.
     * @returns {Array<{x:number, y:number}>|null}
     */
    getWorldCollisionPoly() {
        if (!this._collisionPolyNorm) return null;
        if (!this.sprite) return null;

        const texture = this.sprite.texture;
        if (!texture) return null;

        const w = texture.width;
        const h = texture.height;
        const ax = this.sprite.anchor?.x ?? 0;
        const ay = this.sprite.anchor?.y ?? 0;

        return polyToWorld(this._collisionPolyNorm, this.x, this.y, w, h, ax, ay);
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
