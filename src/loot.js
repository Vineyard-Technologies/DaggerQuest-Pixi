/**
 * Loot is a world entity that represents a dropped item on the ground.
 * It extends Entity so it lives in the PIXI scene graph with a position,
 * container, and animated sprite.
 *
 * Loot spritesheets use a "static" animation with multiple facing directions
 * so that adjacent drops don't all point the same way.  On construction a
 * random direction is chosen from the available angles.
 *
 * Spritesheet naming: {itemId}_loot  (e.g. "crudehelmet_loot")
 * Frame naming:       crudehelmet_loot-static_-22.5-000
 */
class Loot extends Entity {
    /**
     * @param {object} opts
     * @param {Item}   opts.item - The Item definition this loot represents
     * @param {number} opts.x    - World X
     * @param {number} opts.y    - World Y
     */
    constructor({ item, x, y }) {
        super({
            x,
            y,
            spriteKey: `${item.id}_loot`,
            directions: 16,
            animFps: {},
        });
        /** The Item definition backing this loot drop */
        this.item = item;
    }

    /**
     * Override initSprite to pick a random facing direction and display
     * a static (non-animating) frame so each drop looks unique.
     */
    initSprite() {
        // Prefer the "static" animation; fall back to whatever is first
        const animName = this.textures['static']
            ? 'static'
            : Object.keys(this.textures)[0];
        if (!animName) return;

        const anim = this.textures[animName];
        const availableDirections = Object.keys(anim).map(Number);
        if (availableDirections.length === 0) return;

        // Pick a random direction so drops look varied on the ground
        const randomDir = availableDirections[
            Math.floor(Math.random() * availableDirections.length)
        ];
        const frames = anim[randomDir];
        if (!frames || frames.length === 0) return;

        // Shadow (if available)
        if (this.shadowTextures) {
            const shadowFrames = this.getShadowFrames(animName, randomDir);
            if (shadowFrames.length > 0) {
                this.shadowSprite = new PIXI.AnimatedSprite({
                    textures: shadowFrames,
                    updateAnchor: true,
                });
                this.shadowSprite.alpha = 0.5;
                this.shadowSprite.filters = [new PIXI.BlurFilter(4)];
                this.container.addChild(this.shadowSprite);
                this.shadowSprite.gotoAndStop(0);
            }
        }

        // Main sprite – static, no animation playback
        this.sprite = new PIXI.AnimatedSprite({
            textures: frames,
            updateAnchor: true,
        });
        this.container.addChild(this.sprite);
        this.sprite.gotoAndStop(0);
        this.direction = randomDir;
    }

    /**
     * Remove this loot from the world and clean up.
     * Returns the backing Item so the caller can add it to an inventory, etc.
     * @returns {Item}
     */
    pickup() {
        const item = this.item;
        this.destroy();
        return item;
    }
}
