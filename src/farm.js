/**
 * The Farm area – the starting zone for the player.
 * Uses a dirt background and a 4096×4096 world.
 */
class Farm extends Area {
    constructor() {
        super({
            width: 4096,
            height: 4096,
            backgroundTexture: './spritesheets/dirt/dirt-0.webp',
            playerStartX: 4096 - 250,
            playerStartY: 4096 - 250,
        });

    }

    /** @override */
    async spawnObjects() {
        // A simple shirt lying on the ground, 200px left of the player start
        const simpleShirt = new Item({
            id: 'simpleshirt',
            name: 'Simple Shirt',
            slot: 'chest',
            stats: { armor: 2 },
        });

        const loot = simpleShirt.createLoot(this.playerStartX - 200, this.playerStartY);
        await loot.loadTextures();
        this.container.addChild(loot.container);
        this.lootOnGround.push(loot);
    }
}
