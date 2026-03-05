import { Character } from './character';
import state from './state';
import { CombatResolver, type DamageType } from './combat';
import { EnemyState } from './types';

interface EnemyOptions {
    x: number;
    y: number;
    spriteKey?: string;
    speed?: number;
    animFps?: Record<string, number>;
    health?: number;
    attackRange?: number;
    attackDamage?: number;
    attackDamageType?: DamageType;
    attackCooldown?: number;
}

class Enemy extends Character {
    readonly attackDamage: number;
    readonly attackDamageType: DamageType;
    readonly attackCooldown: number;
    private lastAttackTime: number;
    state: EnemyState;

    constructor({
        x, y, spriteKey = 'enemy', speed = 100, animFps = {},
        health = 50, attackRange = 60,
        attackDamage = 5, attackDamageType = 'slash', attackCooldown = 1000,
    }: EnemyOptions) {
        super({ x, y, spriteKey, speed, animFps, attackRange });
        this.currentHealth = health;
        this.maxHealth = health;
        this.attackDamage = attackDamage;
        this.attackDamageType = attackDamageType;
        this.attackCooldown = attackCooldown;
        this.lastAttackTime = 0;
        this.isAlive = true;
        this.state = EnemyState.Idle;
    }

    /** Apply this enemy's attack damage to the player using CombatResolver. */
    tryAttack(): void {
        const now = performance.now();
        if (now - this.lastAttackTime < this.attackCooldown) return;
        this.lastAttackTime = now;

        if (state.player && state.player.isAlive) {
            const dx = state.player.x - this.x;
            const dy = state.player.y - this.y;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            this.direction = this.findClosestDirection(angle);

            this.playAttackAnimation();

            const finalDamage = CombatResolver.resolve(this, state.player, this.attackDamageType, this.attackDamage);
            state.player.takeDamage(finalDamage);
        }
    }

    private playAttackAnimation(): void {
        if (!this.sprite) return;
        const attackFrames = this.getAnimationFrames('attack', this.direction);
        if (attackFrames.length === 0) return;
        this.isWalking = false;
        this.sprite.textures = attackFrames;
        this.sprite.loop = false;
        this.sprite.animationSpeed = this.getAnimFps('attack') / 60;
        this.sprite.gotoAndPlay(0);
        this.sprite.onComplete = () => {
            this.startIdlePingPong();
        };
    }

    die(): void {
        this.isAlive = false;
        this.state = EnemyState.Idle;
        this.targetPosition = null;
        this.stopWalkAnimation();
        this.destroy();
    }

    private isOnScreen(): boolean {
        const app = state.app;
        const area = state.area;
        if (!app || !area) return false;
        const screenLeft = -area.container.x;
        const screenTop = -area.container.y;
        const screenRight = screenLeft + app.screen.width;
        const screenBottom = screenTop + app.screen.height;
        return this.x >= screenLeft && this.x <= screenRight &&
               this.y >= screenTop && this.y <= screenBottom;
    }

    update(delta: number): void {
        if (!this.isAlive) return;
        super.update(delta);

        if (state.player && state.player.isAlive && this.isOnScreen()) {
            const dist = this.distanceTo(state.player);
            if (dist <= this.attackRange) {
                this.state = EnemyState.Attack;
                this.targetPosition = null;
                this.stopWalkAnimation();
                this.tryAttack();
            } else {
                this.state = EnemyState.Chase;
                this.moveToward(state.player.x, state.player.y);
            }
        } else if (this.state === EnemyState.Chase) {
            this.state = EnemyState.Idle;
            this.targetPosition = null;
            this.stopWalkAnimation();
        }
    }
}

export { Enemy };
