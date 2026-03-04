import { Entity } from './entity';
import { resolveCollisions, resolveBoundaryCollisions, aabbOverlap, satOverlap, type WorldPoint } from './collision';
import state from './state';
import { CHARACTER_COLLISION_WIDTH, CHARACTER_COLLISION_HEIGHT } from './config';
import { DEFAULT_CHARACTER_STATS, type CharacterStats, type CharacterStatKey } from './types';

export interface CharacterOptions extends Partial<CharacterStats> {
    x: number;
    y: number;
    spriteKey?: string | null;
    speed?: number;
    direction?: number;
    animFps?: Record<string, number>;
}

class Character extends Entity implements CharacterStats {
    readonly collisionWidth: number;
    readonly collisionHeight: number;
    speed: number;
    targetPosition: { x: number; y: number } | null;
    isWalking: boolean;
    isAlive: boolean;
    private idlePingPongForward: boolean;

    level!: number;
    experience!: number;
    actionSpeed!: number;
    pickupRange!: number;
    attackRange!: number;
    currentHealth!: number;
    maxHealth!: number;
    healthRegen!: number;
    currentMana!: number;
    maxMana!: number;
    manaRegen!: number;
    armor!: number;
    slashDamage!: number;
    smashDamage!: number;
    stabDamage!: number;
    coldDamage!: number;
    fireDamage!: number;
    lightningDamage!: number;
    arcaneDamage!: number;
    corruptDamage!: number;
    holyDamage!: number;
    physicalResistance!: number;
    coldResistance!: number;
    fireResistance!: number;
    lightningResistance!: number;
    arcaneResistance!: number;
    corruptResistance!: number;
    holyResistance!: number;
    flinchResistance!: number;

    constructor({
        x = 0, y = 0, spriteKey = null, speed = 0, direction = 0, animFps = {},
        ...statOpts
    }: CharacterOptions = {} as CharacterOptions) {
        super({ x, y, spriteKey, direction, animFps });

        this.collisionWidth = CHARACTER_COLLISION_WIDTH;
        this.collisionHeight = CHARACTER_COLLISION_HEIGHT;
        this.speed = speed;
        this.targetPosition = null;
        this.isWalking = false;
        this.isAlive = true;
        this.idlePingPongForward = true;
        Object.assign(this, DEFAULT_CHARACTER_STATS, statOpts);
    }

    startIdlePingPong(): void {
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
                    this.sprite!.animationSpeed = this.getAnimFps('idle') / 60;
                    this.sprite!.gotoAndPlay(0);
                } else {
                    this.sprite!.animationSpeed = -(this.getAnimFps('idle') / 60);
                    this.sprite!.gotoAndPlay(this.sprite!.totalFrames - 1);
                }
            }
        };
    }

    startWalkAnimation(): void {
        if (!this.sprite) return;
        const walkFrames = this.getAnimationFrames('walk', this.direction);
        if (walkFrames.length > 0) {
            const savedFrame = this.isWalking ? this.sprite.currentFrame : 0;
            this.sprite.textures = walkFrames;
            this.sprite.loop = true;
            this.sprite.onComplete = undefined;
            this.sprite.animationSpeed = this.getAnimFps('walk') / 60;
            this.sprite.gotoAndPlay(savedFrame % walkFrames.length);
            this.isWalking = true;
            this.onAnimationChanged();
        } else {
            console.warn('No walk frames available');
        }
    }

    stopWalkAnimation(): void {
        if (!this.isWalking) return;
        this.isWalking = false;
        const idleFrames = this.getAnimationFrames('idle', this.direction);
        if (idleFrames.length > 0 && this.sprite) {
            this.sprite.textures = idleFrames;
            this.startIdlePingPong();
        }
    }

    onAnimationChanged(): void {
        // Override in subclasses (e.g. Player syncs gear here)
    }

    moveToward(worldX: number, worldY: number): void {
        this.targetPosition = { x: worldX, y: worldY };
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const newDirection = this.findClosestDirection(angle);
        if (!this.isWalking || newDirection !== this.direction) {
            this.direction = newDirection;
            this.startWalkAnimation();
        }
    }

    faceEntity(entity: Entity): void {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        this.direction = this.findClosestDirection(angle);

        if (!this.isWalking) {
            const idleFrames = this.getAnimationFrames('idle', this.direction);
            if (idleFrames.length > 0 && this.sprite) {
                this.sprite.textures = idleFrames;
                this.startIdlePingPong();
            }
        }
    }

    distanceTo(entity: Entity): number {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getWorldCollisionPoly(): WorldPoint[] | null {
        if (!this.sprite) return null;
        const hw = this.collisionWidth / 2;
        return [
            { x: this.x - hw, y: this.y - this.collisionHeight },
            { x: this.x + hw, y: this.y - this.collisionHeight },
            { x: this.x + hw, y: this.y },
            { x: this.x - hw, y: this.y },
        ];
    }

    update(delta: number): void {
        const dt = delta / 60;
        if (this.healthRegen > 0 && this.currentHealth < this.maxHealth) {
            this.currentHealth = Math.min(this.maxHealth, this.currentHealth + this.healthRegen * dt);
        }
        if (this.manaRegen > 0 && this.currentMana < this.maxMana) {
            this.currentMana = Math.min(this.maxMana, this.currentMana + this.manaRegen * dt);
        }

        if (!this.targetPosition) return;

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

        if (distance < 5) {
            this.targetPosition = null;
            this.stopWalkAnimation();
            return;
        }

        const angle = Math.atan2(dy, dx);
        const effectiveSpeed = Math.sqrt(
            Math.pow(this.speed * Math.cos(angle), 2) +
            Math.pow((this.speed / 2) * Math.sin(angle), 2)
        );
        const speed = effectiveSpeed * (delta / 60);
        const ratio = Math.min(speed / distance, 1);

        this.x += dx * ratio;
        this.y += dy * ratio;

        if (state.area) {
            const myPoly = this.getWorldCollisionPoly();
            if (myPoly) {
                const push: { x: number; y: number } = resolveCollisions(myPoly, state.area.colliders);
                const bPush = resolveBoundaryCollisions(myPoly, state.area.boundaries);
                push.x += bPush.x;
                push.y += bPush.y;

                const others: Character[] = [];
                if (state.area.enemies) {
                    for (const e of state.area.enemies) {
                        if (e !== (this as Character) && (e as Character).isAlive) others.push(e as Character);
                    }
                }
                if (state.player && state.player !== (this as unknown)) {
                    others.push(state.player as unknown as Character);
                }
                for (const other of others) {
                    const otherPoly = other.getWorldCollisionPoly();
                    if (!otherPoly) continue;
                    if (!aabbOverlap(myPoly, otherPoly)) continue;
                    const mtv = satOverlap(myPoly, otherPoly);
                    if (mtv) {
                        push.x += mtv.x;
                        push.y += mtv.y;
                    }
                }

                if (push.x !== 0 || push.y !== 0) {
                    this.x += push.x;
                    this.y += push.y;
                    this.targetPosition = null;
                    this.stopWalkAnimation();
                }
            }
        }

        this.container.x = this.x;
        this.container.y = this.y;
    }
}

export { Character };
