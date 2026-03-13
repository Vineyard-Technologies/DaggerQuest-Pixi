import { Player } from './player';
import { GearSlot } from './types';
import type { CharacterOptions } from './character';
import { Ability, PlayerAbility, Prayer, type AbilityDef, type PlayerAbilityDef, type PrayerDef } from './ability';
import { Projectile } from './projectile';
import { CombatResolver, type DamageType } from './combat';
import type { Character } from './character';
import state from './state';
import { angleRad } from './mathUtils';

/**
 * Resolve an area-of-effect attack around the caster.
 * Iterates all alive enemies within `radius`, resolves damage, and applies it.
 */
function resolveAoE(
    caster: Character,
    radius: number,
    damageType: DamageType,
    baseDamage: number,
): void {
    if (!state.area) return;
    for (const enemy of state.area.enemies) {
        if (!enemy.isAlive) continue;
        const dist = caster.distanceTo(enemy);
        if (dist <= radius) {
            const dmg = CombatResolver.resolve(caster, enemy, damageType, baseDamage);
            enemy.takeDamage(dmg);
        }
    }
}

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
            const angle = angleRad(caster.x, caster.y, target.x, target.y);
            caster.direction = caster.findClosestDirection(angle * (180 / Math.PI));

            // Resolve fire frame from frameTags if available
            const fireFrame = caster.frameTags['downwardslash']?.fireFrame ?? 0;

            function spawnProjectile(): void {
                if (!state.area) return;

                // Re-compute angle from caster's current position to target
                const fireAngle = angleRad(caster.x, caster.y, attackTarget.x, attackTarget.y);

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
                                if (e.isAlive) t.push(e);
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

// ── Chevalier Abilities ─────────────────────────────────────────────────────

function chevalierGroundSlam(): PlayerAbilityDef {
    const baseDamage = 25;
    return {
        id: 'ground_slam',
        name: 'Ground Slam',
        cooldown: 5000,
        range: 0,
        manaCost: 15,
        animName: 'groundslam',
        iconKey: 'groundslam',
        execute({ caster }) {
            resolveAoE(caster, 200, 'smash', baseDamage);
        },
    };
}

function chevalierKick(): PlayerAbilityDef {
    const baseDamage = 12;
    return {
        id: 'kick',
        name: 'Kick',
        cooldown: 3000,
        range: 0,
        manaCost: 8,
        animName: 'kick',
        iconKey: 'kick',
        execute({ caster }) {
            resolveAoE(caster, 120, 'smash', baseDamage);
        },
    };
}

function chevalierWarCry(): PlayerAbilityDef {
    return {
        id: 'war_cry',
        name: 'War Cry',
        cooldown: 10000,
        range: 0,
        manaCost: 20,
        animName: 'warcry',
        iconKey: 'warcry',
        execute({ caster }) {
            const bonus = 5;
            caster.slashDamage += bonus;
            caster.smashDamage += bonus;
            caster.stabDamage += bonus;
            setTimeout(() => {
                caster.slashDamage -= bonus;
                caster.smashDamage -= bonus;
                caster.stabDamage -= bonus;
            }, 8000);
        },
    };
}

function chevalierHeroicStrike(): PlayerAbilityDef {
    const baseDamage = 35;
    return {
        id: 'heroic_strike',
        name: 'Heroic Strike',
        cooldown: 8000,
        range: 0,
        manaCost: 25,
        animName: 'upwardslash',
        iconKey: 'heroicstrike',
        execute({ caster }) {
            resolveAoE(caster, 150, 'slash', baseDamage);
        },
    };
}

function chevalierCriticalStrike(): PlayerAbilityDef {
    const baseDamage = 50;
    return {
        id: 'critical_strike',
        name: 'Critical Strike',
        cooldown: 12000,
        range: 0,
        manaCost: 30,
        animName: 'downwardslash',
        iconKey: 'criticalstrike',
        execute({ caster }) {
            resolveAoE(caster, 130, 'slash', baseDamage);
        },
    };
}

// ── Chevalier Prayers ───────────────────────────────────────────────────────

function chevalierIronSkin(): PrayerDef {
    const bonus = 10;
    return {
        id: 'iron_skin',
        name: 'Iron Skin',
        iconKey: 'rendarmor',
        onActivate(caster) { caster.armor += bonus; },
        onDeactivate(caster) { caster.armor -= bonus; },
    };
}

function chevalierFortitude(): PrayerDef {
    const bonus = 25;
    return {
        id: 'fortitude',
        name: 'Fortitude',
        iconKey: 'stunningkick',
        onActivate(caster) { caster.maxHealth += bonus; },
        onDeactivate(caster) {
            caster.maxHealth -= bonus;
            if (caster.currentHealth > caster.maxHealth) caster.currentHealth = caster.maxHealth;
        },
    };
}

function chevalierPhantomStrike(): PrayerDef {
    const bonus = 5;
    return {
        id: 'phantom_strike',
        name: 'Phantom Strike',
        iconKey: 'phantomstrike',
        onActivate(caster) { caster.slashDamage += bonus; },
        onDeactivate(caster) { caster.slashDamage -= bonus; },
    };
}

function chevalierCripplingBlow(): PrayerDef {
    const bonus = 5;
    return {
        id: 'crippling_blow',
        name: 'Crippling Blow',
        iconKey: 'cripplingstrike',
        onActivate(caster) { caster.smashDamage += bonus; },
        onDeactivate(caster) { caster.smashDamage -= bonus; },
    };
}

function chevalierBootKick(): PrayerDef {
    const bonus = 3;
    return {
        id: 'boot_kick',
        name: 'Boot Kick',
        iconKey: 'bootkick',
        onActivate(caster) { caster.stabDamage += bonus; caster.flinchResistance += bonus; },
        onDeactivate(caster) { caster.stabDamage -= bonus; caster.flinchResistance -= bonus; },
    };
}

// ── Class Definitions ───────────────────────────────────────────────────────

class Chevalier extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } }: ClassOptions = {} as ClassOptions) {
        super({ x, y, spriteKey: 'chevalier', speed, animFps });
        this.defaultGearSlots = {
            [GearSlot.Head]: 'headdefault',
            [GearSlot.Legs]: 'legsdefault',
        };
        this.basicAbility = new Ability(createChevalierBasicAttack());
        this.abilities = [this.basicAbility];
        this.abilityIconSheet = 'chevalier_ability';

        // Active abilities: Q W E R T
        this.playerAbilities = {
            Q: new PlayerAbility(chevalierGroundSlam()),
            W: new PlayerAbility(chevalierKick()),
            E: new PlayerAbility(chevalierWarCry()),
            R: new PlayerAbility(chevalierHeroicStrike()),
            T: new PlayerAbility(chevalierCriticalStrike()),
        };

        // Prayers: A S D F G
        this.prayers = {
            A: new Prayer(chevalierIronSkin()),
            S: new Prayer(chevalierFortitude()),
            D: new Prayer(chevalierPhantomStrike()),
            F: new Prayer(chevalierCripplingBlow()),
            G: new Prayer(chevalierBootKick()),
        };
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
