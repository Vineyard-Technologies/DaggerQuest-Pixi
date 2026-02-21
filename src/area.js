/**
 * Base class for all game areas (zones, maps, regions, etc.)
 * An Area defines the world dimensions, background texture, and player spawn point.
 * Each area owns a PIXI.Container that holds the background and all game objects.
 */
class Area {
    constructor({ width, height, backgroundTexture, playerStartX, playerStartY }) {
        this.width = width;
        this.height = height;
        this.backgroundTexture = backgroundTexture;
        this.playerStartX = playerStartX;
        this.playerStartY = playerStartY;

        // World container holds the background + all game objects for this area
        this.container = new PIXI.Container();

        /** Loot entities currently on the ground in this area */
        this.lootOnGround = [];

        /** Enemy characters in this area */
        this.enemies = [];

        /** Friendly NPCs in this area */
        this.npcs = [];

        /** Invisible collision boundaries: { x, y, width, height } */
        this.boundaries = [];
    }

    /**
     * Spawn initial world objects for this area.
     * Subclasses should override this to place entities.
     * Call after createBackground().
     */
    async spawnObjects() {
        // Override in subclasses
    }

    /** Load the background texture and add it as a tiling sprite */
    async createBackground() {
        const texture = await PIXI.Assets.load(this.backgroundTexture);

        // Height is doubled so that after 0.5 y-scale it covers the full height in world coords
        this.backgroundTile = new PIXI.TilingSprite({
            texture: texture,
            width: this.width,
            height: this.height * 2
        });

        // Rotate the tile pattern ~22.5° to break up grid uniformity
        this.backgroundTile.tileRotation = Math.PI / 8;

        // Squish vertically by 50% to simulate isometric ground-plane perspective.
        this.backgroundTile.scale.y = 0.5;

        this.backgroundTile.x = 0;
        this.backgroundTile.y = 0;

        this.container.addChildAt(this.backgroundTile, 0);
    }

    // ── Static-sprite helpers ────────────────────────────────────────────

    /** Cached manifest reference (shared across all areas) */
    static _manifest = null;

    /** Fetch (and cache) the spritesheet manifest. */
    static async fetchManifest() {
        if (!Area._manifest) {
            Area._manifest = await fetch('./spritesheets/manifest.json').then(r => r.json());
        }
        return Area._manifest;
    }

    /**
     * Load a single-frame (static) sprite from a spritesheet and place it
     * in the world.  Optionally loads the matching _shadow spritesheet.
     *
     * @param {string}  spriteKey   - Manifest key, e.g. "farmhouse"
     * @param {number}  x           - World X (anchor-relative)
     * @param {number}  y           - World Y (anchor-relative)
     * @param {object}  [opts]
     * @param {boolean} [opts.shadow=true]   - Whether to try loading a shadow
     * @param {boolean} [opts.visible=true]  - Whether the sprite is visible
     * @returns {Promise<PIXI.Container>} The placed container
     */
    async placeStaticSprite(spriteKey, x, y, { shadow = true, visible = true } = {}) {
        const manifest = await Area.fetchManifest();
        const sheets = manifest[spriteKey] || [];
        if (sheets.length === 0) {
            console.warn(`No spritesheets found for "${spriteKey}"`);
            return null;
        }

        const container = new PIXI.Container();
        container.x = x;
        container.y = y;

        // Shadow first (renders behind)
        if (shadow) {
            const shadowKey = `${spriteKey}_shadow`;
            const shadowSheets = manifest[shadowKey] || [];
            if (shadowSheets.length > 0) {
                const shadowPath = `./spritesheets/${shadowSheets[0].replace('./', '')}`;
                const shadowSheet = await PIXI.Assets.load(shadowPath);
                const shadowTexName = Object.keys(shadowSheet.textures)[0];
                if (shadowTexName) {
                    const shadowSprite = new PIXI.Sprite(shadowSheet.textures[shadowTexName]);
                    shadowSprite.alpha = 0.5;
                    shadowSprite.filters = [new PIXI.BlurFilter(4)];
                    container.addChild(shadowSprite);
                }
            }
        }

        // Main sprite
        const fullPath = `./spritesheets/${sheets[0].replace('./', '')}`;
        const spritesheet = await PIXI.Assets.load(fullPath);
        const textureName = Object.keys(spritesheet.textures)[0];
        if (textureName) {
            const sprite = new PIXI.Sprite(spritesheet.textures[textureName]);
            container.addChild(sprite);
        }

        container.visible = visible;
        this.container.addChild(container);
        return container;
    }

    /**
     * Update all enemies and NPCs for this area. Call once per frame.
     * @param {number} delta - Frame delta from the ticker
     */
    update(delta) {
        for (const enemy of this.enemies) {
            enemy.update(delta);
        }
        for (const npc of this.npcs) {
            npc.update(delta);
        }

        // Y-sort all children after the background tile so that objects
        // lower on the screen (higher Y) render in front.
        const children = this.container.children;
        if (children.length > 1) {
            // Separate the background (index 0) from the sortable objects
            const start = this.backgroundTile ? 1 : 0;
            for (let i = start + 1; i < children.length; i++) {
                const child = children[i];
                const yVal = child.y;
                let j = i - 1;
                while (j >= start && children[j].y > yVal) {
                    children[j + 1] = children[j];
                    j--;
                }
                children[j + 1] = child;
            }
            // Tell Pixi the display list order changed
            this.container.sortDirty = true;
        }
    }
}
