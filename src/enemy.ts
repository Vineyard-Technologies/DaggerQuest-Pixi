import { Character } from './character';
import state from './state';
import { CombatResolver, type DamageType } from './combat';
import { EnemyState } from './types';
import { Ability, type AbilityDef } from './ability';
import { Projectile } from './projectile';

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
    projectile?: Partial<BasicAttackProjectileOpts>;
}

/** Options that shape the projectile spawned by a basic attack. */
export interface BasicAttackProjectileOpts {
    /** Rectangle width (perpendicular to travel direction). */
    width: number;
    /** Rectangle height (along the travel direction). */
    height: number;
    /** Projectile travel speed (px per frame-second). */
    speed: number;
    /** Maximum travel distance before the projectile vanishes. */
    maxDistance: number;
    /** Fill colour (hex). */
    color?: number;
    /** Fill alpha 0–1. */
    alpha?: number;
}

/** Default projectile shape for enemies that don't specify one. */
const DEFAULT_PROJECTILE: BasicAttackProjectileOpts = {
    width: 60,
    height: 10,
    speed: 800,
    maxDistance: 150,
    color: 0xffffff,
    alpha: 0.6,
};

/**
 * Create an AbilityDef for a projectile-based attack: face target → play
 * attack animation → spawn a rectangular projectile that travels toward
 * the target and deals damage on hit.
 */
function createBasicAttackDef(opts: {
    damage: number;
    damageType: DamageType;
    cooldown: number;
    range: number;
    projectile?: Partial<BasicAttackProjectileOpts>;
}): AbilityDef {
    const proj = { ...DEFAULT_PROJECTILE, ...opts.projectile };
    return {
        id: 'basic_attack',
        name: 'Basic Attack',
        cooldown: opts.cooldown,
        range: opts.range,
        execute({ caster, target }) {
            if (!target || !target.isAlive) return;
            if (!state.area) return;

            // Face target
            const dx = target.x - caster.x;
            const dy = target.y - caster.y;
            const angle = Math.atan2(dy, dx);
            caster.direction = caster.findClosestDirection(angle * (180 / Math.PI));

            // Play the attack animation (sets isCasting for the duration)
            caster.playAbilityAnimation('attack');

            // Resolve damage once up front (based on stats at fire-time)
            const finalDamage = CombatResolver.resolve(
                caster, target, opts.damageType, opts.damage,
            );

            // Spawn projectile
            const projectile = new Projectile({
                x: caster.x,
                y: caster.y,
                angle,
                speed: proj.speed,
                maxDistance: proj.maxDistance,
                width: proj.width,
                height: proj.height,
                color: proj.color,
                alpha: proj.alpha,
                owner: caster,
                targets: () => {
                    const t: Character[] = [];
                    if (state.player && state.player.isAlive) t.push(state.player as unknown as Character);
                    return t;
                },
                onHit(hit) {
                    hit.takeDamage(finalDamage);
                },
            });

            state.projectiles.push(projectile);
            state.area.container.addChild(projectile.graphics);
        },
    };
}

class Enemy extends Character {
    state: EnemyState;

    constructor({
        x, y, spriteKey = 'enemy', speed = 100, animFps = {},
        health = 50, attackRange = 60,
        attackDamage = 5, attackDamageType = 'slash', attackCooldown = 1000,
        projectile,
    }: EnemyOptions) {
        super({ x, y, spriteKey, speed, animFps, attackRange });
        this.currentHealth = health;
        this.maxHealth = health;
        this.isAlive = true;
        this.state = EnemyState.Idle;

        // Build the basic‑attack ability from the legacy attack params
        this.basicAbility = new Ability(createBasicAttackDef({
            damage: attackDamage,
            damageType: attackDamageType,
            cooldown: attackCooldown,
            range: attackRange,
            projectile,
        }));
        this.abilities = [this.basicAbility];
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

        if (this.isCasting) return;

        if (state.player && state.player.isAlive && this.isOnScreen()) {
            const dist = this.distanceTo(state.player);
            const range = this.basicAbility?.range ?? this.attackRange;
            if (dist <= range) {
                this.state = EnemyState.Attack;
                this.targetPosition = null;
                this.stopWalkAnimation();
                this.basicAbility?.use({ caster: this, target: state.player });
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

export { Enemy, createBasicAttackDef };
