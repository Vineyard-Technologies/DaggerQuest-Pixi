/**
 * The player character. Extends Character with click-to-move input
 * handling and camera tracking.
 */
class Player extends Character {
    constructor({ x, y, speed = 0, textures = null }) {
        super({ x, y, speed, textures });
    }

    /** Handle a click/tap to move toward a world position */
    moveToward(worldX, worldY) {
        this.targetPosition = { x: worldX, y: worldY };

        // Calculate direction to target
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        this.direction = findClosestDirection(angle);
        this.startWalkAnimation();
    }
}
