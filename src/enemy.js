import { Character } from './character.js';
import state from './state.js';

/**
 * An Enemy is a Character that is hostile to the player.
 * Enemies patrol, chase, and attack the player.
 */
class Enemy extends Character {
    constructor({ x, y, spriteKey = 'enemy', speed = 100, animFps = {}, health = 50, attackRange = 60, aggroRange = 300, attackDamage = 5, attackCooldown = 1000 }) {
        super({ x, y, spriteKey, speed, animFps });
        this.health = health;
        this.maxHealth = health;
        this.attackRange = attackRange;
        this.aggroRange = aggroRange;
        this.attackDamage = attackDamage;
        this.attackCooldown = attackCooldown;
        this.lastAttackTime = 0;
        this.isAlive = true;
        this.state = 'idle'; // idle | patrol | chase | attack
        this.patrolOrigin = { x, y };
        this.patrolRadius = 150;
    }

    /** Take damage and check for death */
    takeDamage(amount) {
        if (!this.isAlive) return;

        this.health -= amount;

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    /** Handle enemy death */
    die() {
        this.isAlive = false;
        this.state = 'idle';
        this.targetPosition = null;
        this.stopWalkAnimation();
        this.destroy();
    }

    /** Set a random patrol target within patrolRadius of the origin */
    pickPatrolTarget() {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.patrolRadius;
        const tx = this.patrolOrigin.x + Math.cos(angle) * radius;
        const ty = this.patrolOrigin.y + Math.sin(angle) * radius;
        this.moveToward(tx, ty);
        this.state = 'patrol';
    }

    /** Update AI behavior each frame */
    update(delta) {
        if (!this.isAlive) return;

        // Run base movement
        super.update(delta);

        // If the player exists, check aggro
        if (state.player) {
            const dist = this.distanceTo(state.player);

            if (dist <= this.attackRange) {
                // Close enough to attack
                this.state = 'attack';
                this.targetPosition = null;
                this.stopWalkAnimation();
                this.tryAttack();
            } else if (dist <= this.aggroRange) {
                // Chase the player
                this.state = 'chase';
                this.moveToward(state.player.x, state.player.y);
            } else if (this.state === 'chase') {
                // Lost aggro, return to patrol
                this.state = 'idle';
                this.stopWalkAnimation();
            }
        }

        // Patrol when idle
        if (this.state === 'idle' && !this.targetPosition) {
            if (Math.random() < 0.005) {
                this.pickPatrolTarget();
            }
        }

        // Finished patrolling
        if (this.state === 'patrol' && !this.targetPosition) {
            this.state = 'idle';
        }
    }

    /** Attempt to attack the player if cooldown has elapsed */
    tryAttack() {
        const now = performance.now();
        if (now - this.lastAttackTime < this.attackCooldown) return;

        this.lastAttackTime = now;

        // Face the player
        if (state.player) {
            const dx = state.player.x - this.x;
            const dy = state.player.y - this.y;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            this.direction = this.findClosestDirection(angle);
        }
    }
}

export { Enemy };