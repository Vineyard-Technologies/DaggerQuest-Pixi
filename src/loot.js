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

        /** @type {PIXI.Text|null} Floating name label above the loot */
        this.nameLabel = null;
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
                this.shadowSprite.filters = [SHADOW_BLUR];
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

        // ── Name label ──────────────────────────────────────────────────
        // Labels are built here but live in a wrapper container so they
        // can be reparented to a top-level overlay via attachLabelsTo().
        this._labelWrapper = new PIXI.Container();

        this.nameLabel = new PIXI.Text({
            text: this.item.name,
            style: {
                fontFamily: 'Cinzel, serif',
                fontSize: 14,
                fontWeight: '600',
                fill: 0xFFD700,
                stroke: { color: 0x000000, width: 3 },
                align: 'center',
                padding: 4,
            },
        });
        this.nameLabel.anchor.set(0.5, 1);
        // Position above the sprite
        const labelY = this.sprite.y - (this.sprite.height * this.sprite.anchor.y) - 6;
        this.nameLabel.y = labelY;

        // Black background rectangle behind the text
        // Use a one-frame delay so PIXI.Text has measured with the loaded font
        const padX = 6;
        const padY = 3;
        this._nameLabelBg = new PIXI.Graphics();
        this._nameLabelBg.y = labelY;
        this._labelWrapper.addChild(this._nameLabelBg);
        this._labelWrapper.addChild(this.nameLabel);

        // Rebuild the background rect after the text has been measured
        this._updateLabelBg = () => {
            const lblW = this.nameLabel.width;
            const lblH = this.nameLabel.height;
            this._nameLabelBg.clear();
            this._nameLabelBg.roundRect(-lblW / 2 - padX, -lblH - padY, lblW + padX * 2, lblH + padY * 2, 4);
            this._nameLabelBg.fill({ color: 0x000000, alpha: 0.7 });
        };
        // Run once now and once more next frame to catch late font swaps
        this._updateLabelBg();
        requestAnimationFrame(() => {
            if (this.nameLabel && this._nameLabelBg) {
                this._updateLabelBg();
            }
        });

        // Default: add to our own container (will be reparented by attachLabelsTo)
        this._labelWrapper.x = 0;
        this._labelWrapper.y = 0;
        this.container.addChild(this._labelWrapper);
    }

    /**
     * Move the name label into an external overlay container so it
     * always renders above all other world objects.
     * @param {PIXI.Container} overlayContainer - e.g. area.lootLabelsContainer
     */
    attachLabelsTo(overlayContainer) {
        if (!this._labelWrapper) return;
        // Remove from loot's own container
        if (this._labelWrapper.parent) {
            this._labelWrapper.parent.removeChild(this._labelWrapper);
        }
        // Position at world coords since overlay is at (0,0) in world space
        this._labelWrapper.x = this.x;
        this._labelWrapper.y = this.y;
        overlayContainer.addChild(this._labelWrapper);
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

    /**
     * Clean up the name label along with everything else.
     * @override
     */
    destroy() {
        if (this._labelWrapper) {
            if (this._labelWrapper.parent) this._labelWrapper.parent.removeChild(this._labelWrapper);
            this._labelWrapper.destroy({ children: true });
            this._labelWrapper = null;
            this._nameLabelBg = null;
            this.nameLabel = null;
        }
        super.destroy();
    }
}
