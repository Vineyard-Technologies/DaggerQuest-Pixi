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
    aggroRange?: number;
    attackDamage?: number;
    attackDamageType?: DamageType;
    attackCooldown?: number;
}

class Enemy extends Character {
    readonly aggroRange: number;
    readonly attackDamage: number;
    readonly attackDamageType: DamageType;
    readonly attackCooldown: number;
    private lastAttackTime: number;
    state: EnemyState;
    readonly patrolOrigin: { readonly x: number; readonly y: number };
    readonly patrolRadius: number;

    constructor({
        x, y, spriteKey = 'enemy', speed = 100, animFps = {},
        health = 50, attackRange = 60, aggroRange = 300,
        attackDamage = 5, attackDamageType = 'slash', attackCooldown = 1000,
    }: EnemyOptions) {
        super({ x, y, spriteKey, speed, animFps, attackRange });
        this.currentHealth = health;
        this.maxHealth = health;
        this.aggroRange = aggroRange;
        this.attackDamage = attackDamage;
        this.attackDamageType = attackDamageType;
        this.attackCooldown = attackCooldown;
        this.lastAttackTime = 0;
        this.isAlive = true;
        this.state = EnemyState.Idle;
        this.patrolOrigin = { x, y };
        this.patrolRadius = 150;
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

            const finalDamage = CombatResolver.resolve(this, state.player, this.attackDamageType, this.attackDamage);
            state.player.takeDamage(finalDamage);
        }
    }

    die(): void {
        this.isAlive = false;
        this.state = EnemyState.Idle;
        this.targetPosition = null;
        this.stopWalkAnimation();
        this.destroy();
    }

    pickPatrolTarget(): void {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.patrolRadius;
        const tx = this.patrolOrigin.x + Math.cos(angle) * radius;
        const ty = this.patrolOrigin.y + Math.sin(angle) * radius;
        this.moveToward(tx, ty);
        this.state = EnemyState.Patrol;
    }

    update(delta: number): void {
        if (!this.isAlive) return;
        super.update(delta);

        if (state.player && state.player.isAlive) {
            const dist = this.distanceTo(state.player);
            if (dist <= this.attackRange) {
                this.state = EnemyState.Attack;
                this.targetPosition = null;
                this.stopWalkAnimation();
                this.tryAttack();
            } else if (dist <= this.aggroRange) {
                this.state = EnemyState.Chase;
                this.moveToward(state.player.x, state.player.y);
            } else if (this.state === EnemyState.Chase) {
                this.state = EnemyState.Idle;
                this.stopWalkAnimation();
            }
        }

        if (this.state === EnemyState.Idle && !this.targetPosition) {
            if (Math.random() < 0.005) {
                this.pickPatrolTarget();
            }
        }

        if (this.state === EnemyState.Patrol && !this.targetPosition) {
            this.state = EnemyState.Idle;
        }
    }
}

export { Enemy };
