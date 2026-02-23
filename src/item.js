/**
 * An Item is the data definition for an equippable/collectible object.
 * It holds metadata (name, slot, stats, mods) and provides:
 *   - Icon loading for menus / inventory display
 *   - Factory methods to create Loot (world entity) and Gear (character overlay)
 *   - Random mod generation (or pre-baked mods for world-placed items)
 *
 * Items can have up to 6 mods. Fewer mods are common; more mods are
 * exponentially rarer. Higher rolled values within each mod are also rarer.
 *
 * The icon spritesheet follows the naming convention: {itemId}_item
 * (e.g., "crudehelmet_item").
 */
class Item {
    /**
     * @param {object} opts
     * @param {string} opts.id          - Internal identifier, e.g. 'crudehelmet'
     * @param {string} opts.name        - Display name, e.g. 'Crude Helmet'
     * @param {string} [opts.description] - Flavour / tooltip text
     * @param {string} opts.slot        - Equipment slot: head, chest, legs, feet, hands, mainhand, offhand, neck, ring
     * @param {object} [opts.baseStats] - Inherent stat modifiers, e.g. { armor: 5, slashDamage: 3 }
     * @param {Array}  [opts.mods]      - Pre-baked mods array; if omitted, mods are rolled randomly.
     *                                    Each entry: { modId: string, value: number }
     */
    constructor({ id, name, description = '', slot, baseStats = {}, stats = {}, mods = undefined }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.slot = slot;

        /**
         * Inherent (non-random) stats that are always on this item.
         * Accepts either `baseStats` or legacy `stats` parameter.
         */
        this.baseStats = Object.keys(baseStats).length > 0 ? baseStats : stats;

        /**
         * Rolled (or pre-baked) mods on this item.
         * Each entry: { modId: string, value: number }
         */
        this.mods = mods !== undefined ? mods : rollMods();

        /** @private */
        this._iconTexture = null;
        /** @private */
        this._iconAssetPaths = [];
    }

    // ── Stats (base + mods) ──────────────────────────────────────────────

    /**
     * Combined stats: base stats merged with all stat-granting mods.
     * This is the total stat contribution when the item is equipped.
     * @returns {object} e.g. { armor: 10, maxHealth: 5 }
     */
    get stats() {
        const modStats = aggregateModStats(this.mods);
        const merged = { ...this.baseStats };
        for (const [key, val] of Object.entries(modStats)) {
            merged[key] = (merged[key] || 0) + val;
        }
        return merged;
    }

    /**
     * Get a formatted list of mod descriptions for tooltip display.
     * @returns {string[]} e.g. ["+5 Armor", "+3 Slash Damage"]
     */
    get modDescriptions() {
        return this.mods.map(m => formatMod(m));
    }

    /**
     * The number of mods on this item (0–6).
     * @returns {number}
     */
    get modCount() {
        return this.mods.length;
    }

    /** Manifest key for the item icon spritesheet */
    get iconSpriteKey() {
        return `${this.id}_item`;
    }

    /** Manifest key for the loot spritesheet */
    get lootSpriteKey() {
        return `${this.id}_loot`;
    }

    /**
     * Resolve the gear spriteKey for a given character class.
     * @param {string} characterSpriteKey - e.g. 'man', 'woman'
     * @returns {string} e.g. 'man_crudehelmet_gear'
     */
    gearSpriteKey(characterSpriteKey) {
        return `${characterSpriteKey}_${this.id}_gear`;
    }

    // ── Icon (menu / inventory) ──────────────────────────────────────────

    /**
     * Load the icon texture from the item spritesheet.
     * Safe to call multiple times – returns the cached texture after the first load.
     * @returns {Promise<PIXI.Texture|null>}
     */
    async loadIcon() {
        if (this._iconTexture) return this._iconTexture;

        const manifest = await Item.fetchManifest();
        const sheets = manifest[this.iconSpriteKey] || [];

        if (sheets.length === 0) {
            console.warn(`No icon spritesheets found for "${this.iconSpriteKey}"`);
            return null;
        }

        for (const sheetPath of sheets) {
            const fullPath = `./images/spritesheets/${sheetPath.replace('./', '')}`;
            this._iconAssetPaths.push(fullPath);
            const spritesheet = await PIXI.Assets.load(fullPath);

            // Grab the first texture we find
            if (!this._iconTexture) {
                const names = Object.keys(spritesheet.textures);
                if (names.length > 0) {
                    this._iconTexture = spritesheet.textures[names[0]];
                }
            }
        }

        return this._iconTexture;
    }

    /**
     * Create a PIXI.Sprite suitable for UI display.
     * `loadIcon()` must be called first – otherwise returns null.
     * @returns {PIXI.Sprite|null}
     */
    createIcon() {
        if (!this._iconTexture) {
            console.warn(`Icon not loaded for "${this.id}". Call loadIcon() first.`);
            return null;
        }
        return new PIXI.Sprite(this._iconTexture);
    }

    /**
     * Unload icon assets from memory.
     */
    async unloadIcon() {
        for (const path of this._iconAssetPaths) {
            await PIXI.Assets.unload(path);
        }
        this._iconTexture = null;
        this._iconAssetPaths = [];
    }

    // ── Factories ────────────────────────────────────────────────────────

    /**
     * Create a Loot entity that represents this item on the ground.
     * @param {number} x - World X position
     * @param {number} y - World Y position
     * @returns {Loot}
     */
    createLoot(x, y) {
        return new Loot({ item: this, x, y });
    }

    /**
     * Create a Gear overlay that can be equipped on a character.
     * @returns {Gear}
     */
    createGear() {
        return new Gear({ item: this });
    }

    // ── Manifest cache ───────────────────────────────────────────────────

    /**
     * Fetch (and cache) the spritesheet manifest.
     * @returns {Promise<object>}
     */
    static async fetchManifest() {
        return Area.fetchManifest();
    }
}
