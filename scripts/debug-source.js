/**
 * DaggerQuest – Developer Debug Module
 *
 * This file is the PLAINTEXT source of the encrypted debug payload.
 * It is encrypted by scripts/encryptDebug.js and embedded into src/debug.js.
 *
 * When decrypted at runtime via enableDebug(), this code executes with full
 * access to all game globals (app, area, player, ui, PIXI, etc.).
 *
 * Features:
 *   F1  – Toggle collision polygon visualization
 *   F2  – Toggle noclip (walk through everything)
 *   F3  – Toggle teleport mode (Shift+Click to teleport)
 *   +/- – Increase / decrease game speed
 *   F4  – Reset game speed to 1×
 */

// ── Debug state ─────────────────────────────────────────────────────────

window.DEBUG = {
    active: true,
    showCollision: false,
    noclip: false,
    teleportMode: false,
    gameSpeed: 1,

    speedOptions: [0.25, 0.5, 1, 2, 5, 10],
    speedIndex: 2, // starts at 1×

    // PIXI display objects (assigned below)
    overlay: null,
    collisionGraphics: null,
};

// ── Overlay text (screen-space) ─────────────────────────────────────────

const debugText = new PIXI.Text({
    text: 'DEBUG MODE',
    style: {
        fontFamily: 'monospace',
        fontSize: 13,
        fill: 0x00ff00,
        stroke: { color: 0x000000, width: 4 },
        lineHeight: 18,
    },
});
debugText.x = 8;
debugText.y = 8;
app.stage.addChild(debugText);
DEBUG.overlay = debugText;

// ── Collision graphics (world-space, moves with camera) ─────────────────

const collGfx = new PIXI.Graphics();
collGfx.sortY = Infinity; // always render on top during Y-sort
DEBUG.collisionGraphics = collGfx;
area.container.addChild(collGfx);

// ── Noclip – monkey-patch Character.prototype.update ────────────────────
// Temporarily empties the collider lists while the *player* is updating
// so only the player walks through walls; enemies still collide normally.

const _origCharUpdate = Character.prototype.update;
Character.prototype.update = function (delta) {
    if (window.DEBUG?.noclip && this === player) {
        const savedColliders = area.colliders;
        const savedBoundaries = area.boundaries;
        area.colliders = [];
        area.boundaries = [];
        _origCharUpdate.call(this, delta);
        area.colliders = savedColliders;
        area.boundaries = savedBoundaries;
        return;
    }
    _origCharUpdate.call(this, delta);
};

// ── Debug tick (runs every frame after the main game loop) ──────────────

app.ticker.add(() => {
    if (!DEBUG.active) return;

    // ── Overlay text ────────────────────────────────────────────────
    const lines = ['[DEBUG]'];
    lines.push('FPS: ' + Math.round(app.ticker.FPS));
    if (player) {
        lines.push('Pos: ' + Math.round(player.x) + ', ' + Math.round(player.y));
    }
    if (DEBUG.gameSpeed !== 1) {
        lines.push('Speed: ' + DEBUG.gameSpeed + '\u00d7');
    }
    if (DEBUG.noclip) lines.push('NOCLIP');
    if (DEBUG.teleportMode) lines.push('TELEPORT (Shift+Click)');
    if (DEBUG.showCollision) lines.push('COLLISION');
    lines.push('');
    lines.push('F1 collision | F2 noclip');
    lines.push('F3 teleport  | F4 reset speed');
    lines.push('+/- speed');

    debugText.text = lines.join('\n');

    // Keep overlay above everything (it's in app.stage, not area.container)
    const stageChildren = app.stage.children;
    const idx = stageChildren.indexOf(debugText);
    if (idx !== -1 && idx !== stageChildren.length - 1) {
        app.stage.removeChild(debugText);
        app.stage.addChild(debugText);
    }

    // ── Collision visualisation ─────────────────────────────────────
    collGfx.clear();
    if (!DEBUG.showCollision || !area) return;

    // Helper: draw a polygon from an array of {x, y} points
    function drawPoly(points, fillColor, fillAlpha, strokeColor, strokeAlpha, strokeWidth) {
        const flat = [];
        for (const p of points) { flat.push(p.x, p.y); }
        collGfx.poly(flat, true);
        collGfx.fill({ color: fillColor, alpha: fillAlpha });
        collGfx.stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
    }

    // Static world colliders (red)
    for (const poly of area.colliders) {
        drawPoly(poly, 0xff0000, 0.15, 0xff0000, 0.7, 2);
    }

    // Invisible boundaries (blue)
    for (const b of area.boundaries) {
        collGfx.rect(b.x, b.y, b.width, b.height);
        collGfx.fill({ color: 0x0000ff, alpha: 0.1 });
        collGfx.stroke({ color: 0x4444ff, alpha: 0.7, width: 2 });
    }

    // Player collision poly (green)
    if (player) {
        const pp = player.getWorldCollisionPoly();
        if (pp) drawPoly(pp, 0x00ff00, 0.25, 0x00ff00, 1, 2);
    }

    // Enemy collision polys (yellow)
    if (area.enemies) {
        for (const e of area.enemies) {
            if (!e.isAlive) continue;
            const ep = e.getWorldCollisionPoly();
            if (ep) drawPoly(ep, 0xffff00, 0.15, 0xffff00, 0.7, 1.5);
        }
    }

    // NPC collision polys (cyan)
    if (area.npcs) {
        for (const npc of area.npcs) {
            const np = npc.getWorldCollisionPoly();
            if (np) drawPoly(np, 0x00ffff, 0.15, 0x00ffff, 0.7, 1.5);
        }
    }
});

// ── Keyboard shortcuts ──────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
    if (!DEBUG.active) return;

    switch (e.key) {
        case 'F1':
            e.preventDefault();
            DEBUG.showCollision = !DEBUG.showCollision;
            if (!DEBUG.showCollision) collGfx.clear();
            break;

        case 'F2':
            e.preventDefault();
            DEBUG.noclip = !DEBUG.noclip;
            break;

        case 'F3':
            e.preventDefault();
            DEBUG.teleportMode = !DEBUG.teleportMode;
            break;

        case 'F4':
            e.preventDefault();
            DEBUG.speedIndex = 2;
            DEBUG.gameSpeed = 1;
            app.ticker.speed = 1;
            PIXI.Ticker.shared.speed = 1;
            break;

        case '+':
        case '=':
            DEBUG.speedIndex = Math.min(DEBUG.speedIndex + 1, DEBUG.speedOptions.length - 1);
            DEBUG.gameSpeed = DEBUG.speedOptions[DEBUG.speedIndex];
            app.ticker.speed = DEBUG.gameSpeed;
            PIXI.Ticker.shared.speed = DEBUG.gameSpeed;
            break;

        case '-':
        case '_':
            DEBUG.speedIndex = Math.max(DEBUG.speedIndex - 1, 0);
            DEBUG.gameSpeed = DEBUG.speedOptions[DEBUG.speedIndex];
            app.ticker.speed = DEBUG.gameSpeed;
            PIXI.Ticker.shared.speed = DEBUG.gameSpeed;
            break;
    }
});

// ── Teleport (Shift+Click when teleport mode is on) ─────────────────────

app.stage.on('pointerdown', (event) => {
    if (!DEBUG.active || !DEBUG.teleportMode || !player) return;
    if (!event.data?.originalEvent?.shiftKey) return;

    const pos = event.data.global;
    const worldX = pos.x - area.container.x;
    const worldY = pos.y - area.container.y;

    player.x = worldX;
    player.y = worldY;
    player.container.x = worldX;
    player.container.y = worldY;
    player.targetPosition = null;
    player.stopWalkAnimation();
});

// ── Activation message ──────────────────────────────────────────────────

console.log(
    '%c[DaggerQuest] Debug mode activated!',
    'color: #00ff00; font-weight: bold; font-size: 14px;'
);
