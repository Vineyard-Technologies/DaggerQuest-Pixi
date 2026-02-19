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
}
