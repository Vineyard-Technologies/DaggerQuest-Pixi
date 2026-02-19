/**
 * Base class for all game entities (player, enemies, props, etc.)
 * Entities have a position, a container, and an optional animated sprite.
 */
class Entity {
    constructor({ x, y, direction = 0, textures = null }) {
        this.x = x;
        this.y = y;
        this.direction = direction;

        // Animation textures keyed by direction: { walk: { angle: [frames] }, idle: { angle: [frames] } }
        this.textures = textures || { walk: {}, idle: {} };

        // PIXI display objects
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;

        // Create the animated sprite from the first available idle direction
        const firstDirection = Object.keys(this.textures.idle)[0];
        const idleFrames = (firstDirection && this.textures.idle[firstDirection]) || [];

        if (idleFrames.length > 0) {
            this.sprite = new PIXI.AnimatedSprite({ textures: idleFrames, updateAnchor: true });
            this.sprite.x = 0;
            this.sprite.y = -50;
            this.sprite.animationSpeed = IDLE_FPS / 60;
            this.container.addChild(this.sprite);
            this.direction = parseFloat(firstDirection);
        } else {
            this.sprite = null;
        }
    }
}

/**
 * A Character is an Entity that can move and has walk/idle animations.
 * Includes the player, NPCs, and enemies.
 */
class Character extends Entity {
    constructor({ x, y, speed = 0, direction = 0, textures = null }) {
        super({ x, y, direction, textures });
        this.speed = speed;
        this.targetPosition = null;
        this.isWalking = false;
        this.idlePingPongForward = true;
    }

    /** Start the idle ping-pong animation */
    startIdlePingPong() {
        if (!this.sprite) return;

        const idleFrames = this.textures.idle[this.direction]
            || this.textures.idle[Object.keys(this.textures.idle)[0]]
            || [];

        if (idleFrames.length <= 1) {
            this.sprite.gotoAndStop(0);
            return;
        }

        this.idlePingPongForward = true;
        this.sprite.loop = false;
        this.sprite.animationSpeed = IDLE_FPS / 60;
        this.sprite.gotoAndPlay(0);

        this.sprite.onComplete = () => {
            if (!this.isWalking) {
                this.idlePingPongForward = !this.idlePingPongForward;
                if (this.idlePingPongForward) {
                    this.sprite.animationSpeed = IDLE_FPS / 60;
                    this.sprite.gotoAndPlay(0);
                } else {
                    this.sprite.animationSpeed = -(IDLE_FPS / 60);
                    this.sprite.gotoAndPlay(this.sprite.totalFrames - 1);
                }
            }
        };
    }

    /** Start the walk animation for the current direction */
    startWalkAnimation() {
        if (!this.sprite) return;

        let walkFrames = this.textures.walk[this.direction];

        if (!walkFrames || walkFrames.length === 0) {
            console.warn(`No frames for direction ${this.direction}, using fallback`);
            const availableDirections = Object.keys(this.textures.walk);
            if (availableDirections.length > 0) {
                walkFrames = this.textures.walk[availableDirections[0]];
            }
        }

        if (walkFrames && walkFrames.length > 0) {
            const savedFrame = this.isWalking ? this.sprite.currentFrame : 0;
            this.sprite.textures = walkFrames;
            this.sprite.loop = true;
            this.sprite.onComplete = null;
            this.sprite.animationSpeed = WALK_FPS / 60;
            this.sprite.gotoAndPlay(savedFrame % walkFrames.length);
            this.isWalking = true;
        } else {
            console.warn('No walk frames available');
        }
    }

    /** Stop walking and return to idle animation */
    stopWalkAnimation() {
        if (!this.isWalking) return;
        this.isWalking = false;

        let idleFrames = this.textures.idle[this.direction];

        if (!idleFrames || idleFrames.length === 0) {
            const availableDirections = Object.keys(this.textures.idle);
            if (availableDirections.length > 0) {
                idleFrames = this.textures.idle[availableDirections[0]];
            }
        }

        if (idleFrames && idleFrames.length > 0 && this.sprite) {
            this.sprite.textures = idleFrames;
            this.startIdlePingPong();
        }
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
