/**
 * Gear is the visual representation of an equipped item on a character's body.
 * It is NOT an Entity – it is an overlay that syncs its AnimatedSprite
 * frame-by-frame with the owning character.
 *
 * MEMORY MANAGEMENT:
 *   On equip  → spritesheets are loaded into the PIXI asset cache and
 *                AnimatedSprites are created and added to the character's container.
 *   On unequip → sprites are destroyed, removed from the container, and
 *                all loaded spritesheet assets are unloaded via PIXI.Assets.unload()
 *                so GPU/CPU memory is freed immediately.
 *
 * Spritesheet naming:  {characterKey}_{itemId}_gear          (e.g. "man_crudehelmet_gear")
 * Shadow naming:       {characterKey}_{itemId}_gear_shadow
 * Frame naming:        man_crudehelmet_gear-idle_-22.5-000
 */
class Gear {
    /**
     * @param {object} opts
     * @param {Item}   opts.item - The Item definition this gear visualises
     */
    constructor({ item }) {
        /** The Item definition backing this gear piece */
        this.item = item;

        /** @type {PIXI.AnimatedSprite|null} */
        this.sprite = null;
        /** @type {PIXI.AnimatedSprite|null} */
        this.shadowSprite = null;

        /**
         * Parsed animation textures: { animName: { direction: [frames] } }
         * @private
         */
        this._textures = {};
        /** @private */
        this._shadowTextures = {};

        /** The character this gear is currently equipped on. @private */
        this._character = null;
        /** @private */
        this._spriteKey = null;
        /** All asset paths loaded so we can unload them later. @private */
        this._assetPaths = [];
        /** Ticker callback reference. @private */
        this._tickerFn = null;
        /** Tracks the last texture array seen on the character sprite. @private */
        this._lastCharacterTextures = null;
    }

    // ── Public API ───────────────────────────────────────────────────────

    /**
     * Equip this gear onto a character.  Loads the gear spritesheets,
     * creates overlay sprites, and begins per-frame syncing.
     * @param {Character} character
     */
    async equip(character) {
        // Safety: unequip from previous character first
        if (this._character) {
            await this.unequip();
        }

        this._character = character;
        this._spriteKey = `${character.spriteKey}_${this.item.id}_gear`;

        const manifest = await Item.fetchManifest();

        // Load main gear textures
        await this._loadSheetTextures(manifest, this._spriteKey, this._textures);

        // Load shadow textures (optional – may not exist for every item)
        const shadowKey = `${this._spriteKey}_shadow`;
        await this._loadSheetTextures(manifest, shadowKey, this._shadowTextures);

        // Create the overlay sprites and add them to the character container
        this._createSprites();

        // Start per-frame sync so the gear follows the character's anim/direction/frame
        this._lastCharacterTextures = null;
        this._tickerFn = () => this._sync();
        PIXI.Ticker.shared.add(this._tickerFn);
    }

    /**
     * Unequip this gear, removing all sprites and freeing all spritesheet
     * assets from memory.
     */
    async unequip() {
        // Stop syncing
        if (this._tickerFn) {
            PIXI.Ticker.shared.remove(this._tickerFn);
            this._tickerFn = null;
        }

        // Destroy and remove main sprite
        if (this.sprite) {
            if (this.sprite.parent) this.sprite.parent.removeChild(this.sprite);
            this.sprite.destroy();
            this.sprite = null;
        }

        // Destroy and remove shadow sprite
        if (this.shadowSprite) {
            if (this.shadowSprite.parent) this.shadowSprite.parent.removeChild(this.shadowSprite);
            this.shadowSprite.destroy();
            this.shadowSprite = null;
        }

        // Unload every spritesheet we loaded – this frees GPU textures and cache entries
        for (const path of this._assetPaths) {
            await PIXI.Assets.unload(path);
        }

        // Reset all internal state
        this._textures = {};
        this._shadowTextures = {};
        this._assetPaths = [];
        this._character = null;
        this._spriteKey = null;
        this._lastCharacterTextures = null;
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /**
     * Load spritesheets for a key and parse frames into a textures dict.
     * Frame naming convention: key-animName_direction-frameNum
     * @private
     */
    async _loadSheetTextures(manifest, key, targetObj) {
        const sheets = manifest[key] || [];
        if (sheets.length === 0) return;

        const pattern = new RegExp(`${key}-(\\w+)_([\\-\\d.]+)-(\\d+)`);

        for (const sheetPath of sheets) {
            const fullPath = `./spritesheets/${sheetPath.replace('./', '')}`;
            this._assetPaths.push(fullPath);
            const spritesheet = await PIXI.Assets.load(fullPath);

            for (const frameName in spritesheet.textures) {
                const match = frameName.match(pattern);
                if (!match) continue;

                const animName = match[1];
                const direction = parseFloat(match[2]);
                const frameNum = parseInt(match[3]);

                if (!targetObj[animName]) targetObj[animName] = {};
                if (!targetObj[animName][direction]) targetObj[animName][direction] = [];
                targetObj[animName][direction][frameNum] = spritesheet.textures[frameName];
            }
        }

        // Remove undefined holes left by sparse frameNum indexing
        for (const anim in targetObj) {
            for (const dir in targetObj[anim]) {
                targetObj[anim][dir] = targetObj[anim][dir].filter(f => f !== undefined);
            }
        }
    }

    /**
     * Create gear overlay sprites and insert them into the character's
     * display container at the correct z-positions.
     * @private
     */
    _createSprites() {
        if (!this._character?.sprite) return;

        // Determine which animation + direction the character is currently showing
        const info = this._character._textureMap?.get(this._character.sprite.textures);
        const animName = info?.animName || Object.keys(this._textures)[0];
        if (!animName || !this._textures[animName]) return;

        const direction = info?.direction ?? parseFloat(Object.keys(this._textures[animName])[0]);

        // ── Shadow sprite (inserted right before the character sprite) ───
        if (Object.keys(this._shadowTextures).length > 0) {
            const shadowFrames = this._getFrames(this._shadowTextures, animName, direction);
            if (shadowFrames.length > 0) {
                this.shadowSprite = new PIXI.AnimatedSprite({
                    textures: shadowFrames,
                    updateAnchor: true,
                });
                this.shadowSprite.alpha = 0.5;
                this.shadowSprite.filters = [new PIXI.BlurFilter(4)];

                // Place behind the character's main sprite
                const charSpriteIdx = this._character.container.getChildIndex(this._character.sprite);
                this._character.container.addChildAt(this.shadowSprite, charSpriteIdx);
                this.shadowSprite.gotoAndStop(0);
            }
        }

        // ── Main gear sprite (inserted right after the character sprite) ─
        const frames = this._getFrames(this._textures, animName, direction);
        if (frames.length === 0) return;

        this.sprite = new PIXI.AnimatedSprite({
            textures: frames,
            updateAnchor: true,
        });

        // Place on top of the character's main sprite
        const charSpriteIdx = this._character.container.getChildIndex(this._character.sprite);
        this._character.container.addChildAt(this.sprite, charSpriteIdx + 1);
        this.sprite.gotoAndStop(0);
    }

    /**
     * Called every PIXI tick.  Keeps the gear sprite in lockstep with
     * the character's current animation, direction, and frame index.
     * @private
     */
    _sync() {
        if (!this._character?.sprite || !this.sprite) return;

        // Detect animation / direction change on the character
        if (this._character.sprite.textures !== this._lastCharacterTextures) {
            this._lastCharacterTextures = this._character.sprite.textures;

            const info = this._character._textureMap?.get(this._character.sprite.textures);
            if (info) {
                // Swap gear main textures
                const frames = this._getFrames(this._textures, info.animName, info.direction);
                if (frames.length > 0) {
                    this.sprite.textures = frames;
                }

                // Swap gear shadow textures
                if (this.shadowSprite) {
                    const shadowFrames = this._getFrames(this._shadowTextures, info.animName, info.direction);
                    if (shadowFrames.length > 0) {
                        this.shadowSprite.textures = shadowFrames;
                    }
                }
            }
        }

        // Mirror the character's current frame index
        const charFrame = this._character.sprite.currentFrame;

        const gearFrame = Math.min(charFrame, this.sprite.totalFrames - 1);
        if (this.sprite.currentFrame !== gearFrame) {
            this.sprite.gotoAndStop(gearFrame);
        }

        if (this.shadowSprite) {
            const shadowFrame = Math.min(charFrame, this.shadowSprite.totalFrames - 1);
            if (this.shadowSprite.currentFrame !== shadowFrame) {
                this.shadowSprite.gotoAndStop(shadowFrame);
            }
        }
    }

    /**
     * Look up frames for an animation and direction, with fallback
     * to the first available direction.
     * @private
     */
    _getFrames(textureSet, animName, direction) {
        const anim = textureSet[animName];
        if (!anim) return [];

        const frames = anim[direction];
        if (frames && frames.length > 0) return frames;

        // Fallback: first available direction for this animation
        const fallbackDir = Object.keys(anim)[0];
        return (fallbackDir && anim[fallbackDir]) || [];
    }
}
