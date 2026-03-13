import { Player } from './player';
import { GearSlot } from './types';
import type { CharacterOptions } from './character';
import { Ability, type AbilityDef } from './ability';
import { Projectile } from './projectile';
import { CombatResolver } from './combat';
import type { Character } from './character';
import state from './state';

interface ClassOptions {
    x: number;
    y: number;
    speed?: number;
    animFps?: Record<string, number>;
}

/** Create the Chevalier's basic attack: downward slash that hits all enemies. */
function createChevalierBasicAttack(): AbilityDef {
    const baseDamage = 10;
    return {
        id: 'basic_attack',
        name: 'Basic Attack',
        cooldown: 0,
        range: 150,
        execute({ caster, target }) {
            if (!target || !target.isAlive) return;
            if (!state.area) return;

            const attackTarget = target;

            // Face target
            const dx = target.x - caster.x;
            const dy = target.y - caster.y;
            const angle = Math.atan2(dy, dx);
            caster.direction = caster.findClosestDirection(angle * (180 / Math.PI));

            // Resolve fire frame from frameTags if available
            const fireFrame = caster.frameTags['downwardslash']?.fireFrame ?? 0;

            function spawnProjectile(): void {
                if (!state.area) return;

                // Re-compute angle from caster's current position to target
                const fdx = attackTarget.x - caster.x;
                const fdy = attackTarget.y - caster.y;
                const fireAngle = Math.atan2(fdy, fdx);

                const projectile = new Projectile({
                    x: caster.x,
                    y: caster.y,
                    angle: fireAngle,
                    speed: 1200,
                    maxDistance: 120,
                    width: 80,
                    height: 14,
                    color: 0xcccccc,
                    alpha: 0.7,
                    piercing: true,
                    owner: caster,
                    targets: () => {
                        const t: Character[] = [];
                        if (state.area?.enemies) {
                            for (const e of state.area.enemies) {
                                if (e.isAlive) t.push(e as unknown as Character);
                            }
                        }
                        return t;
                    },
                    onHit(hit) {
                        const dmg = CombatResolver.resolve(caster, hit, 'slash', baseDamage);
                        hit.takeDamage(dmg);
                    },
                });

                state.projectiles.push(projectile);
                state.area!.container.addChild(projectile.graphics);
            }

            caster.playAbilityAnimation('downwardslash', undefined, {
                [fireFrame]: spawnProjectile,
            });
        },
    };
}

class Chevalier extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } }: ClassOptions = {} as ClassOptions) {
        super({ x, y, spriteKey: 'chevalier', speed, animFps });
        this.defaultGearSlots = {
            [GearSlot.Head]: 'headdefault',
            [GearSlot.Legs]: 'legsdefault',
        };
        this.basicAbility = new Ability(createChevalierBasicAttack());
        this.abilities = [this.basicAbility];
    }
}

class Vanguard extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } }: ClassOptions = {} as ClassOptions) {
        super({ x, y, spriteKey: 'vanguard', speed, animFps });
        this.defaultGearSlots = {
            [GearSlot.Head]: 'headdefault',
            [GearSlot.Chest]: 'chestdefault',
            [GearSlot.Legs]: 'legsdefault',
        };
    }
}

// ── Factory ─────────────────────────────────────────────────────────────────

interface PlayerSpawnOptions {
    x: number;
    y: number;
}

const PLAYER_CLASSES: Record<string, new (opts: PlayerSpawnOptions) => Player> = {
    chevalier: Chevalier,
    vanguard: Vanguard,
};

function createPlayer(spriteKey: string, x: number, y: number): Player {
    const PlayerClass = PLAYER_CLASSES[spriteKey];
    if (!PlayerClass) throw new Error(`Unknown player class: "${spriteKey}"`);
    return new PlayerClass({ x, y });
}

export { Chevalier, Vanguard, createPlayer };
