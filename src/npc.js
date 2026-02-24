import { Character } from './character.js';
import state from './state.js';

/**
 * An NPC is a friendly, non-hostile Character the player can interact with.
 * NPCs can have dialog, wander in a small area, and face the player when spoken to.
 */
class NPC extends Character {
    constructor({ x, y, spriteKey = 'guide', name = 'NPC', speed = 50, animFps = {}, interactRange = 100, dialog = [], wanderRadius = 0 }) {
        super({ x, y, spriteKey, speed, animFps });
        this.name = name;
        this.interactRange = interactRange;
        this.dialog = dialog;
        this.dialogIndex = 0;
        this.isInteracting = false;
        this.wanderOrigin = { x, y };
        this.wanderRadius = wanderRadius;
    }

    /** Turn to face a target entity */
    faceEntity(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        this.direction = this.findClosestDirection(angle);

        // Refresh idle animation with the new facing direction
        if (!this.isWalking) {
            const idleFrames = this.getAnimationFrames('idle', this.direction);
            if (idleFrames.length > 0 && this.sprite) {
                this.sprite.textures = idleFrames;
                this.startIdlePingPong();
            }
        }
    }

    /** Begin an interaction with the player */
    interact() {
        if (this.dialog.length === 0) return null;

        this.isInteracting = true;
        this.targetPosition = null;
        this.stopWalkAnimation();

        // Face the player
        if (state.player) {
            this.faceEntity(state.player);
        }

        return this.getCurrentDialog();
    }

    /** Get the current dialog line */
    getCurrentDialog() {
        if (this.dialog.length === 0) return null;
        return this.dialog[this.dialogIndex];
    }

    /** Advance to the next dialog line; returns null when finished */
    advanceDialog() {
        this.dialogIndex++;

        if (this.dialogIndex >= this.dialog.length) {
            this.endInteraction();
            return null;
        }

        return this.dialog[this.dialogIndex];
    }

    /** End the interaction and reset dialog */
    endInteraction() {
        this.isInteracting = false;
        this.dialogIndex = 0;
    }

    /** Check if the player is within interaction range */
    isPlayerInRange() {
        if (!state.player) return false;
        return this.distanceTo(state.player) <= this.interactRange;
    }

    /** Pick a random wander target near the origin */
    pickWanderTarget() {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.wanderRadius;
        const tx = this.wanderOrigin.x + Math.cos(angle) * radius;
        const ty = this.wanderOrigin.y + Math.sin(angle) * radius;
        this.moveToward(tx, ty);
    }

    /** Update NPC behavior each frame */
    update(delta) {
        // Don't wander while interacting
        if (this.isInteracting) return;

        // Run base movement
        super.update(delta);

        // Occasionally wander when idle
        if (!this.targetPosition && this.wanderRadius > 0 && Math.random() < 0.002) {
            this.pickWanderTarget();
        }
    }
}

export { NPC };