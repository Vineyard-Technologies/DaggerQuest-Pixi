/**
 * A Character is an Entity that can move and has walk/idle animations.
 * Includes the player, NPCs, and enemies.
 */
class Character extends Entity {
    constructor({ x, y, spriteKey = null, speed = 0, direction = 0, animFps = {} }) {
        super({ x, y, spriteKey, direction, animFps });
        this.speed = speed;
        this.targetPosition = null;
        this.isWalking = false;
        this.idlePingPongForward = true;
    }

    /** Start the idle ping-pong animation */
    startIdlePingPong() {
        if (!this.sprite) return;

        const idleFrames = this.getAnimationFrames('idle', this.direction);

        if (idleFrames.length <= 1) {
            this.sprite.gotoAndStop(0);
            return;
        }

        this.sprite.textures = idleFrames;
        this.idlePingPongForward = true;
        this.sprite.loop = false;
        this.sprite.animationSpeed = this.getAnimFps('idle') / 60;
        this.sprite.gotoAndPlay(0);
        this.onAnimationChanged();

        this.sprite.onComplete = () => {
            if (!this.isWalking) {
                this.idlePingPongForward = !this.idlePingPongForward;
                if (this.idlePingPongForward) {
                    this.sprite.animationSpeed = this.getAnimFps('idle') / 60;
                    this.sprite.gotoAndPlay(0);
                } else {
                    this.sprite.animationSpeed = -(this.getAnimFps('idle') / 60);
                    this.sprite.gotoAndPlay(this.sprite.totalFrames - 1);
                }
            }
        };
    }

    /** Start the walk animation for the current direction */
    startWalkAnimation() {
        if (!this.sprite) return;

        const walkFrames = this.getAnimationFrames('walk', this.direction);

        if (walkFrames.length > 0) {
            const savedFrame = this.isWalking ? this.sprite.currentFrame : 0;
            this.sprite.textures = walkFrames;
            this.sprite.loop = true;
            this.sprite.onComplete = null;
            this.sprite.animationSpeed = this.getAnimFps('walk') / 60;
            this.sprite.gotoAndPlay(savedFrame % walkFrames.length);
            this.isWalking = true;
            this.onAnimationChanged();
        } else {
            console.warn('No walk frames available');
        }
    }

    /** Stop walking and return to idle animation */
    stopWalkAnimation() {
        if (!this.isWalking) return;
        this.isWalking = false;

        const idleFrames = this.getAnimationFrames('idle', this.direction);

        if (idleFrames.length > 0 && this.sprite) {
            this.sprite.textures = idleFrames;
            this.startIdlePingPong();
        }
    }

    /**
     * Hook called immediately after this character's sprite textures change
     * (direction or animation swap).  Subclasses override to sync overlays.
     */
    onAnimationChanged() {
        // Override in subclasses (e.g. Player syncs gear here)
    }

    /** Update movement toward targetPosition. Call once per frame. */
    update(delta) {
        if (!this.targetPosition) return;

        // Safety check for NaN
        if (isNaN(this.x) || isNaN(this.y)) {
            console.error('Character position is NaN! Resetting.');
            this.x = this.container.x;
            this.y = this.container.y;
            this.targetPosition = null;
            this.stopWalkAnimation();
            return;
        }

        const dx = this.targetPosition.x - this.x;
        const dy = this.targetPosition.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if we've reached the target
        if (distance < 5) {
            this.targetPosition = null;
            this.stopWalkAnimation();
            return;
        }

        // Elliptical speed: full speed horizontal, half speed vertical
        const angle = Math.atan2(dy, dx);
        const effectiveSpeed = Math.sqrt(
            Math.pow(this.speed * Math.cos(angle), 2) +
            Math.pow((this.speed / 2) * Math.sin(angle), 2)
        );
        const speed = effectiveSpeed * (delta / 60);
        const ratio = Math.min(speed / distance, 1);

        this.x += dx * ratio;
        this.y += dy * ratio;

        // Sync container position
        this.container.x = this.x;
        this.container.y = this.y;
    }
}
