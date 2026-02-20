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
}
