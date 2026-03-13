/**
 * Projectile system – rectangular shapes that travel from a source position
 * in a direction at a given speed, checking for collision with targets each
 * frame, then disappearing after travelling a maximum distance.
 *
 * Projectiles are managed per-area and updated by Area.update().
 */

import * as PIXI from 'pixi.js';
import type { Character } from './character';
import { aabbOverlap, satOverlap, type WorldPoint } from './collision';

// ── Options ───────────────────────────────────────────────────────────────

export interface ProjectileOptions {
    /** World-space origin X. */
    x: number;
    /** World-space origin Y. */
    y: number;
    /** Travel angle in radians. */
    angle: number;
    /** Pixels per frame-second (scaled by delta). */
    speed: number;
    /** Maximum distance in pixels before the projectile is removed. */
    maxDistance: number;
    /** Width of the rectangle (perpendicular to travel direction). */
    width: number;
    /** Height of the rectangle (along the travel direction). */
    height: number;
    /** Fill colour (hex). */
    color?: number;
    /** Fill alpha (0–1). */
    alpha?: number;
    /** The character who fired this projectile (excluded from hit-testing). */
    owner: Character;
    /**
     * Characters the projectile can hit.  Evaluated lazily each frame so
     * new/removed characters are handled automatically.
     */
    targets: () => Character[];
    /** Called once when the projectile first overlaps a target. */
    onHit: (target: Character) => void;
    /** If true, the projectile passes through targets instead of dying on first hit. */
    piercing?: boolean;
}

// ── Projectile ────────────────────────────────────────────────────────────

export class Projectile {
    x: number;
    y: number;
    private readonly angle: number;
    private readonly speed: number;
    private readonly maxDistance: number;
    private readonly rectW: number;
    private readonly rectH: number;
    private readonly owner: Character;
    private readonly targets: () => Character[];
    private readonly onHit: (target: Character) => void;
    private readonly piercing: boolean;
    private distanceTravelled: number = 0;
    private alive: boolean = true;
    /** Characters already hit — each projectile hits a character at most once. */
    private readonly hitSet: Set<Character> = new Set();
    readonly graphics: PIXI.Graphics;

    constructor(opts: ProjectileOptions) {
        this.x = opts.x;
        this.y = opts.y;
        this.angle = opts.angle;
        this.speed = opts.speed;
        this.maxDistance = opts.maxDistance;
        this.rectW = opts.width;
        this.rectH = opts.height;
        this.owner = opts.owner;
        this.targets = opts.targets;
        this.onHit = opts.onHit;
        this.piercing = opts.piercing ?? false;

        // Draw the rectangle centred at the origin, then position/rotate via
        // the Graphics transform.
        this.graphics = new PIXI.Graphics();
        this.graphics.rect(-this.rectW / 2, -this.rectH / 2, this.rectW, this.rectH);
        this.graphics.fill({ color: opts.color ?? 0xffffff, alpha: opts.alpha ?? 0.6 });
        this.graphics.x = this.x;
        this.graphics.y = this.y;
        this.graphics.rotation = this.angle;
        this.graphics.visible = false;
    }

    get isAlive(): boolean { return this.alive; }

    /** Build the oriented-bounding-box polygon in world space. */
    getWorldPoly(): WorldPoint[] {
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const hw = this.rectW / 2;
        const hh = this.rectH / 2;
        // Corners relative to centre, then rotated.
        const corners: [number, number][] = [
            [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
        ];
        return corners.map(([lx, ly]) => ({
            x: this.x + lx * cos - ly * sin,
            y: this.y + lx * sin + ly * cos,
        }));
    }

    /**
     * Advance one tick.
     * @returns `false` when the projectile should be removed.
     */
    update(delta: number): boolean {
        if (!this.alive) return false;

        const move = this.speed * (delta / 60);
        this.x += Math.cos(this.angle) * move;
        this.y += Math.sin(this.angle) * move;
        this.distanceTravelled += move;

        this.graphics.x = this.x;
        this.graphics.y = this.y;

        if (this.distanceTravelled >= this.maxDistance) {
            this.alive = false;
            return false;
        }

        // Hit-test targets
        const myPoly = this.getWorldPoly();
        for (const target of this.targets()) {
            if (target === this.owner) continue;
            if (!target.isAlive) continue;
            if (this.hitSet.has(target)) continue;
            const targetPoly = target.getWorldCollisionPoly();
            if (!targetPoly) continue;
            if (!aabbOverlap(myPoly, targetPoly)) continue;
            if (satOverlap(myPoly, targetPoly)) {
                this.hitSet.add(target);
                this.onHit(target);
                if (!this.piercing) {
                    this.alive = false;
                    return false;
                }
            }
        }

        return true;
    }

    /** Remove graphics from parent and mark dead. */
    destroy(): void {
        this.alive = false;
        if (this.graphics.parent) {
            this.graphics.parent.removeChild(this.graphics);
        }
        this.graphics.destroy();
    }
}
