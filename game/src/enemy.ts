import { Character } from './character';
import state from './state';
import { CombatResolver, type DamageType } from './combat';
import { EnemyState } from './types';
import { Ability, type AbilityDef } from './ability';
import { Projectile } from './projectile';
import { bus } from './events';
import { ENEMY_XP_MULTIPLIER } from './config';

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
    attackSpeed?: number;
    level?: number;
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
    /** Animation frame index (0-based) on which the projectile is spawned.
     *  Defaults to 0 (fires immediately when anim starts). */
    fireFrame?: number;
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

            // Capture narrowed target for use inside closures
            const attackTarget = target;

            // Face target
            const dx = target.x - caster.x;
            const dy = target.y - caster.y;
            const angle = Math.atan2(dy, dx);
            caster.direction = caster.findClosestDirection(angle * (180 / Math.PI));

            // Resolve fire frame: explicit projectile opt > frameTags > 0
            const fireFrame = proj.fireFrame
                ?? caster.frameTags['attack']?.fireFrame
                ?? 0;

            // Helper: spawn the projectile (called on the fire frame)
            function spawnProjectile(): void {
                if (!state.area) return;
                if (!attackTarget.isAlive) return;

                // Resolve damage at the moment of firing
                const finalDamage = CombatResolver.resolve(
                    caster, attackTarget, opts.damageType, opts.damage,
                );

                // Re-compute angle from caster's current position
                const fdx = attackTarget.x - caster.x;
                const fdy = attackTarget.y - caster.y;
                const fireAngle = Math.atan2(fdy, fdx);

                const projectile = new Projectile({
                    x: caster.x,
                    y: caster.y,
                    angle: fireAngle,
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
            }

            // Play the attack animation, firing the projectile on the specified frame
            caster.playAbilityAnimation('attack', undefined, {
                [fireFrame]: spawnProjectile,
            });
        },
    };
}

class Enemy extends Character {
    state: EnemyState;
    readonly xpReward: number;

    constructor({
        x, y, spriteKey = 'enemy', speed = 100, animFps = {},
        health = 50, attackRange = 60,
        attackDamage = 5, attackDamageType = 'slash', attackSpeed = 1,
        level = 1, projectile,
    }: EnemyOptions) {
        super({ x, y, spriteKey, speed, animFps, attackRange, attackSpeed, level });
        this.currentHealth = health;
        this.maxHealth = health;
        this.isAlive = true;
        this.state = EnemyState.Idle;
        this.xpReward = level * ENEMY_XP_MULTIPLIER;

        this.basicAbility = new Ability(createBasicAttackDef({
            damage: attackDamage,
            damageType: attackDamageType,
            cooldown: 0,
            range: attackRange,
            projectile,
        }));
        this.abilities = [this.basicAbility];
    }

    die(): void {
        this.state = EnemyState.Idle;
        super.die();
        bus.emit('enemy-killed', { xpReward: this.xpReward });

        const dieFrames = this.getAnimationFrames('die', this.direction);
        if (dieFrames.length > 0 && this.sprite) {
            this.sprite.onComplete = () => this.destroy();
        } else {
            this.destroy();
        }
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

// ── Enemy subclasses ────────────────────────────────────────────────────────

interface EnemySpawnOptions {
    x: number;
    y: number;
    level?: number;
}

class GoblinUnderling extends Enemy {
    constructor({ x, y, level = 1 }: EnemySpawnOptions) {
        super({
            x, y,
            spriteKey: 'goblinunderling',
            speed: 200,
            health: 15,
            attackRange: 150,
            attackDamage: 7,
            attackSpeed: 1,
            level,
            projectile: { width: 80, height: 14, speed: 1200, maxDistance: 120, color: 0xaaaaaa, alpha: 0.7 },
        });
    }
}

class GoblinArcher extends Enemy {
    constructor({ x, y, level = 1 }: EnemySpawnOptions) {
        super({
            x, y,
            spriteKey: 'goblinarcher',
            speed: 200,
            health: 15,
            attackRange: 400,
            attackDamage: 10,
            attackSpeed: 1,
            level,
            projectile: { width: 8, height: 30, speed: 600, maxDistance: 500, color: 0x8b4513, alpha: 0.9 },
        });
    }
}

class GoblinWarlock extends Enemy {
    constructor({ x, y, level = 1 }: EnemySpawnOptions) {
        super({
            x, y,
            spriteKey: 'goblinwarlock',
            speed: 200,
            health: 25,
            attackRange: 450,
            attackDamage: 11,
            attackSpeed: 0.6,
            level,
            projectile: { width: 16, height: 16, speed: 400, maxDistance: 500, color: 0x6700ff, alpha: 0.8 },
        });
    }
}

// ── Factory ─────────────────────────────────────────────────────────────────

const ENEMY_CLASSES: Record<string, new (opts: EnemySpawnOptions) => Enemy> = {
    goblinunderling: GoblinUnderling,
    goblinarcher: GoblinArcher,
    goblinwarlock: GoblinWarlock,
};

function createEnemy(spriteKey: string, x: number, y: number, level: number = 1): Enemy {
    const EnemyClass = ENEMY_CLASSES[spriteKey];
    if (!EnemyClass) throw new Error(`Unknown enemy type: "${spriteKey}"`);
    return new EnemyClass({ x, y, level });
}

export { Enemy, GoblinUnderling, GoblinArcher, GoblinWarlock, createEnemy, createBasicAttackDef };
