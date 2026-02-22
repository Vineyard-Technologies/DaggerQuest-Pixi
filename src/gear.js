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
 *
 * DEFAULT GEAR:
 *   Default gear covers the character's naked body when no real item is
 *   equipped in a slot.  It has no backing Item and is constructed with a
 *   direct spriteKeyBase and slot instead.
 *   Spritesheet naming:  {characterKey}_{slot}default_gear
 */

/**
 * Z-order for gear slots, from back (lowest) to front (highest).
 * Gear with a lower value renders behind gear with a higher value.
 */
const GEAR_SLOT_Z_ORDER = {
    feet:     0,
    legs:     1,
    chest:    2,
    neck:     3,
    hands:    4,
    offhand:  5,
    mainhand: 6,
    head:     7,
};

class Gear {
    /**
     * @param {object} opts
     * @param {Item}   [opts.item]          - The Item definition (omit for default gear)
     * @param {string} [opts.slot]          - Equipment slot (required when item is omitted)
     * @param {string} [opts.spriteKeyBase] - Direct sprite key base, e.g. 'headdefault'
     *                                        (omit to derive from item.id)
     * @param {boolean} [opts.isDefault]    - Whether this is default (body-cover) gear
     */
    constructor({ item = null, slot = null, spriteKeyBase = null, isDefault = false } = {}) {
        /** The Item definition backing this gear piece (null for default gear) */
        this.item = item;

        /** Equipment slot this gear occupies */
        this.slot = slot || (item && item.slot) || null;

        /** Whether this is default body-cover gear */
        this.isDefault = isDefault;

        /** @private Base key used to build the full spriteKey on equip */
        this._spriteKeyBase = spriteKeyBase || (item && item.id) || null;

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
        /** The anim name the gear is currently displaying. @private */
        this._currentAnimName = null;
        /** The direction the gear is currently displaying. @private */
        this._currentDirection = null;
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
        this._spriteKey = `${character.spriteKey}_${this._spriteKeyBase}_gear`;

        const manifest = await Item.fetchManifest();

        // Load main gear textures
        await this._loadSheetTextures(manifest, this._spriteKey, this._textures);

        // Load shadow textures (optional – may not exist for every item)
        const shadowKey = `${this._spriteKey}_shadow`;
        await this._loadSheetTextures(manifest, shadowKey, this._shadowTextures);

        // Create the overlay sprites and add them to the character container
        this._createSprites();

        // Start per-frame sync so the gear follows the character's anim/direction/frame
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
        this._currentAnimName = null;
        this._currentDirection = null;
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
            const fullPath = `./images/spritesheets/${sheetPath.replace('./', '')}`;
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
     * display container at the correct z-position based on slot order.
     * @private
     */
    _createSprites() {
        if (!this._character?.sprite) return;

        // Determine which animation + direction the character is currently showing
        const info = this._character._textureMap?.get(this._character.sprite.textures);
        const animName = info?.animName || Object.keys(this._textures)[0];
        if (!animName || !this._textures[animName]) return;

        const direction = info?.direction ?? parseFloat(Object.keys(this._textures[animName])[0]);

        // Calculate the correct insertion index above the character sprite
        // based on this gear's slot z-order relative to other equipped gear.
        const insertIdx = this._getInsertIndex();

        // ── Shadow sprite (inserted at the same base index, pushing main up) ──
        if (Object.keys(this._shadowTextures).length > 0) {
            const shadowFrames = this._getFrames(this._shadowTextures, animName, direction);
            if (shadowFrames.length > 0) {
                this.shadowSprite = new PIXI.AnimatedSprite({
                    textures: shadowFrames,
                    updateAnchor: true,
                });
                this.shadowSprite.alpha = 0.5;
                this.shadowSprite.filters = [new PIXI.BlurFilter(4)];
                this._character.container.addChildAt(this.shadowSprite, insertIdx);
                this.shadowSprite.gotoAndStop(0);
            }
        }

        // ── Main gear sprite ─────────────────────────────────────────────
        const frames = this._getFrames(this._textures, animName, direction);
        if (frames.length === 0) return;

        this.sprite = new PIXI.AnimatedSprite({
            textures: frames,
            updateAnchor: true,
        });

        // If a shadow was added it pushed indices up by 1
        const mainIdx = this.shadowSprite
            ? this._character.container.getChildIndex(this.shadowSprite) + 1
            : insertIdx;
        this._character.container.addChildAt(this.sprite, mainIdx);
        this.sprite.gotoAndStop(0);
    }

    /**
     * Determine the display-list index at which this gear's sprites should
     * be inserted inside the character container, so that slots are layered
     * from feet (back) to head (front).
     * @private
     * @returns {number}
     */
    _getInsertIndex() {
        const container = this._character.container;
        const myZ = GEAR_SLOT_Z_ORDER[this.slot] ?? 0;

        // Start right after the character's own sprite
        const charIdx = container.getChildIndex(this._character.sprite);
        let idx = charIdx + 1;

        // Walk forward through existing gear sprites; stop when we find
        // a gear piece whose slot z-order is >= ours.
        const equippedGear = this._character.equippedGear || {};
        const gearBySprite = new Map();
        for (const g of Object.values(equippedGear)) {
            if (g.sprite) gearBySprite.set(g.sprite, g);
            if (g.shadowSprite) gearBySprite.set(g.shadowSprite, g);
        }

        for (let i = charIdx + 1; i < container.children.length; i++) {
            const child = container.children[i];
            const ownerGear = gearBySprite.get(child);
            if (!ownerGear) {
                // Not a gear sprite – skip over (could be the entity shadow)
                idx = i + 1;
                continue;
            }
            const otherZ = GEAR_SLOT_Z_ORDER[ownerGear.slot] ?? 0;
            if (otherZ >= myZ) {
                // This existing gear should be on top of us – insert here
                return i;
            }
            idx = i + 1;
        }

        return idx;
    }

    /**
     * Immediately sync the gear's animation/direction/frame to match
     * the character.  Called directly by the character when its textures
     * change, so there is no one-frame lag.
     */
    syncNow() {
        this._sync();
    }

    /**
     * Called every PIXI tick.  Keeps the gear sprite in lockstep with
     * the character's current animation, direction, and frame index.
     * @private
     */
    _sync() {
        if (!this._character?.sprite || !this.sprite) return;

        // Look up what the character is currently displaying
        const info = this._character._textureMap?.get(this._character.sprite.textures);
        if (info) {
            const { animName, direction } = info;

            // Only swap textures when anim or direction actually differs
            if (animName !== this._currentAnimName || direction !== this._currentDirection) {
                this._currentAnimName = animName;
                this._currentDirection = direction;

                const frames = this._getFrames(this._textures, animName, direction);
                if (frames.length > 0) {
                    this.sprite.textures = frames;
                }

                if (this.shadowSprite) {
                    const shadowFrames = this._getFrames(this._shadowTextures, animName, direction);
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
