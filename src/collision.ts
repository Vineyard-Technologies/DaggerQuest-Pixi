export type NormPoint = readonly [number, number];
export interface WorldPoint { readonly x: number; readonly y: number; }
export interface Boundary { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

import collisionPolysJson from './data/collisionPolys.json';

const COLLISION_POLYS: Readonly<Record<string, readonly NormPoint[]>> = collisionPolysJson as unknown as Record<string, NormPoint[]>;

const DEFAULT_BOX = [[0,0],[1,0],[1,1],[0,1]] as const satisfies readonly NormPoint[];

function polyToWorld(normPoly: readonly NormPoint[], worldX: number, worldY: number, width: number, height: number, anchorX: number, anchorY: number): WorldPoint[] {
    return normPoly.map(([px, py]) => ({ x: worldX + (px - anchorX) * width, y: worldY + (py - anchorY) * height }));
}

function getAxes(poly: WorldPoint[]): WorldPoint[] {
    const axes: WorldPoint[] = [];
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i]!; const p2 = poly[(i + 1) % poly.length]!;
        const edgeX = p2.x - p1.x; const edgeY = p2.y - p1.y;
        const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
        if (len === 0) continue;
        axes.push({ x: -edgeY / len, y: edgeX / len });
    }
    return axes;
}

function project(poly: WorldPoint[], axis: WorldPoint): [number, number] {
    let min = Infinity, max = -Infinity;
    for (const p of poly) { const dot = p.x * axis.x + p.y * axis.y; if (dot < min) min = dot; if (dot > max) max = dot; }
    return [min, max];
}

function satOverlap(polyA: WorldPoint[], polyB: WorldPoint[]): WorldPoint | null {
    let minOverlap = Infinity; let mtvAxis: WorldPoint | null = null;
    const axes = getAxes(polyA).concat(getAxes(polyB));
    for (const axis of axes) {
        const [minA, maxA] = project(polyA, axis); const [minB, maxB] = project(polyB, axis);
        if (maxA <= minB || maxB <= minA) return null;
        const overlap = Math.min(maxA - minB, maxB - minA);
        if (overlap < minOverlap) { minOverlap = overlap; mtvAxis = axis; }
    }
    if (!mtvAxis) return null;
    const centroidA = polygonCentroid(polyA); const centroidB = polygonCentroid(polyB);
    const dx = centroidA.x - centroidB.x; const dy = centroidA.y - centroidB.y;
    const dot = dx * mtvAxis.x + dy * mtvAxis.y;
    if (dot < 0) return { x: -mtvAxis.x * minOverlap, y: -mtvAxis.y * minOverlap };
    return { x: mtvAxis.x * minOverlap, y: mtvAxis.y * minOverlap };
}

function polygonCentroid(poly: WorldPoint[]): WorldPoint {
    let cx = 0, cy = 0; for (const p of poly) { cx += p.x; cy += p.y; }
    return { x: cx / poly.length, y: cy / poly.length };
}

function aabbOverlap(polyA: WorldPoint[], polyB: WorldPoint[]): boolean {
    let minAx = Infinity, maxAx = -Infinity, minAy = Infinity, maxAy = -Infinity;
    for (const p of polyA) { if (p.x < minAx) minAx = p.x; if (p.x > maxAx) maxAx = p.x; if (p.y < minAy) minAy = p.y; if (p.y > maxAy) maxAy = p.y; }
    let minBx = Infinity, maxBx = -Infinity, minBy = Infinity, maxBy = -Infinity;
    for (const p of polyB) { if (p.x < minBx) minBx = p.x; if (p.x > maxBx) maxBx = p.x; if (p.y < minBy) minBy = p.y; if (p.y > maxBy) maxBy = p.y; }
    return !(maxAx <= minBx || maxBx <= minAx || maxAy <= minBy || maxBy <= minAy);
}

function resolveCollisions(movingPoly: WorldPoint[], colliders: readonly WorldPoint[][]): WorldPoint {
    let totalPushX = 0, totalPushY = 0;
    for (const collider of colliders) {
        if (!aabbOverlap(movingPoly, collider)) continue;
        const mtv = satOverlap(movingPoly, collider);
        if (mtv) { totalPushX += mtv.x; totalPushY += mtv.y; }
    }
    return { x: totalPushX, y: totalPushY };
}

function resolveBoundaryCollisions(movingPoly: WorldPoint[], boundaries: readonly Boundary[]): WorldPoint {
    let totalPushX = 0, totalPushY = 0;
    for (const b of boundaries) {
        const bPoly: WorldPoint[] = [
            { x: b.x, y: b.y - b.height / 2 }, { x: b.x + b.width, y: b.y - b.height / 2 },
            { x: b.x + b.width, y: b.y + b.height / 2 }, { x: b.x, y: b.y + b.height / 2 },
        ];
        if (!aabbOverlap(movingPoly, bPoly)) continue;
        const mtv = satOverlap(movingPoly, bPoly);
        if (mtv) { totalPushX += mtv.x; totalPushY += mtv.y; }
    }
    return { x: totalPushX, y: totalPushY };
}

export { COLLISION_POLYS, DEFAULT_BOX, polyToWorld, satOverlap, aabbOverlap, resolveCollisions, resolveBoundaryCollisions };
