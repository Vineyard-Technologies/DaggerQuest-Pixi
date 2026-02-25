export type NormPoint = readonly [number, number];
export interface WorldPoint { readonly x: number; readonly y: number; }
export interface Boundary { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

const COLLISION_POLYS = {
    farmhouse: [[0.02932096501844483,0.36810126582278483],[0.49704797047970480,0.05088607594936709],[0.95413653136531400,0.37778481012658230],[0.95582656826568300,0.80121518987341770],[0.69745387453874500,0.98025316455696200],[0.56178966789667900,0.88268987341772150],[0.38720664206642100,1],[0.33153506642066400,0.96068987341772150],[0.30034317343173400,0.98240506329113920],[0.17843189852398500,0.89868354430379740],[0.13594170984455960,0.92632911392405060],[0.07730627306273060,0.88470886075949370],[0.02770479704797050,0.79392405063291140]],
    longhouse: [[0,0.10927152317880795],[0.71926914153132250,0.39403973509933780],[0.85557541899441340,0.58940397350993380],[0.93155452436194900,0.74503311258278150],[1,0.86754966887417220],[1,1],[0,1]],
    cottageexterior: [[0,0.6957606365555837],[0.514644415308741,0.20947634727877568],[0.9560669243252592,0.6932667568140196],[0.5058576831258988,0.9526184538653371]],
    cottagedoor: [[0.04741379310344828,0.17210144927536233],[0.5,0],[0.9698275862068966,0.06159420289855073],[0.9698275862068966,0.8442028985507246],[0.18534482758620692,1],[0.030172413793103447,0.9682971014492753]],
    cottageprops: [[0.16587677725118483,0.39485981308411214],[0.5103348178137652,0.6103967168262654],[0.634003197492163,0.5829439252336449],[1,0.8224299065420561],[0.7911482159812517,1],[0,0.5794392523364486]],
    fencehorizontal: [[0,1],[1,1],[1,0.7407407407407407],[0,0.7407407407407407]],
    fencepatchedhorizontal: [[0,1],[1,1],[1,0.7547169811320755],[0,0.7547169811320755]],
    fenceleft: [[0,0.40625],[1,0.96875],[0.953,1],[0,0.47534246575342466]],
    fencepatchedleft: [[0,0.41434262948207173],[1,0.9669254658385093],[0.9468085106382978,1],[0,0.47457627118644066]],
    fenceright: [[0.04857142857142857,1],[1,0.4861111111111111],[1,0.4090277777777778],[0,0.9722222222222222]],
    fencepatchedright: [[0.054012345679012346,1],[1,0.47187500000000007],[1,0.40468750000000007],[0,0.97187500000000007]],
    fencevertical: [[0,0],[1,0],[1,1],[0,1]],
    cart: [[0,0],[1,0],[1,0.8276425493441947],[0.14945044884314904,1],[0,1]],
    table: [[0.02608695652173913,0.5822367696003884],[0.3521739130434778,0.45539906103286465],[0.973913043478261,0.856807511737089],[0.6652173913043483,1]],
    woodenchest: [[0,0],[1,0],[1,1],[0,1]],
    pillaroffate: [[0,0],[1,0],[1,1],[0,1]],
    farmhousetree: [[0.46551724137931033,0.6979423868312757],[0.15,0.43127572016460905],[1,0],[1,1],[0.5068965517241379,1]],
    windmillexterior: [[0,0.9135],[0,0.8496],[0.10591630591630592,0.615015974440894],[0.8960750360750361,0.6180831826401279],[1,0.9550159744408946],[0.6027056277056277,0.9995208226221079],[0.3982683982683983,0.998402555910543],[0.11831831831831832,0.96693290734824280]],
    windmilllowerstairs: [[0.36543545747282063,0.5045372050816697],[1,0.4864066187226814],[1,1],[0.728730131009485,1]],
    windmillupperstairs: [[0.38590604026845637,0.26879699248120303],[0.38926174496644293,0],[0.5536912751677853,0],[1,0.5583458646616541],[0.8069798657718121,0.5601503759398496]],
} as const satisfies Readonly<Record<string, readonly NormPoint[]>>;

const DEFAULT_BOX = [[0,0],[1,0],[1,1],[0,1]] as const satisfies readonly NormPoint[];
const CHARACTER_COLLISION_BOX = [[0,0.6667],[1,0.6667],[1,1],[0,1]] as const satisfies readonly NormPoint[];

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

export { COLLISION_POLYS, DEFAULT_BOX, CHARACTER_COLLISION_BOX, polyToWorld, satOverlap, aabbOverlap, resolveCollisions, resolveBoundaryCollisions };
