/**
 * Shared math utilities for distance, angle, and hit-testing.
 *
 * Consolidates repeated math patterns from daggerquest.ts, character.ts,
 * enemy.ts, and classes.ts into a single importable module.
 */

import type * as PIXI from 'pixi.js';

const RAD_TO_DEG = 180 / Math.PI;

/** Euclidean distance between two points. */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/** Angle in degrees from (x1,y1) to (x2,y2). */
export function angleDeg(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1) * RAD_TO_DEG;
}

/** Angle in radians from (x1,y1) to (x2,y2). */
export function angleRad(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Point-in-bounds hit test.
 * Returns true if (screenX, screenY) is inside the given Bounds rectangle.
 */
export function hitTestBounds(screenX: number, screenY: number, b: PIXI.Bounds): boolean {
    return (
        screenX >= b.x &&
        screenX <= b.x + b.width &&
        screenY >= b.y &&
        screenY <= b.y + b.height
    );
}

/**
 * Hit-test a screen point against a PIXI DisplayObject's bounds.
 * Returns true if the point is inside the object's bounding rectangle.
 */
export function hitTestDisplayObject(screenX: number, screenY: number, obj: PIXI.Container): boolean {
    const b = obj.getBounds();
    return hitTestBounds(screenX, screenY, b);
}
