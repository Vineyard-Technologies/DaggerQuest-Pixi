/**
 * The player character. Extends Character with click-to-move input
 * handling and camera tracking.
 */
class Player extends Character {
    constructor({ x, y, speed = 0, walkFps = 30, idleFps = 10 }) {
        super({ x, y, spriteKey: 'man', speed, walkFps, idleFps });
    }

    /** Handle a click/tap to move toward a world position */
    moveToward(worldX, worldY) {
        this.targetPosition = { x: worldX, y: worldY };

        // Calculate direction to target
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        const newDirection = this.findClosestDirection(angle);

        // Only restart the walk animation if direction changed or not already walking
        if (!this.isWalking || newDirection !== this.direction) {
            this.direction = newDirection;
            this.startWalkAnimation();
        }
    }
}

// Create the player character
async function createPlayer() {
    player = new Player({
        x: area.playerStartX,
        y: area.playerStartY,
        speed: 250,
    });

    await player.loadTextures();

    area.container.addChild(player.container);
    player.startIdlePingPong();

    // Position camera on the player immediately
    updateCamera();
}
