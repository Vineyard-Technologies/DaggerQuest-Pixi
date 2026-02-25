/**
 * DaggerQuest – Developer Debug Module
 *
 * Plain-text debug utilities available ONLY during development.
 * This file is never included in production builds (guarded by
 * `import.meta.env.DEV` in daggerquest.ts).
 *
 * Activate from the browser console:
 *   debug()
 *
 * Features:
 *   F1  – Toggle collision polygon visualization
 *   F2  – Toggle noclip (walk through everything)
 *   F3  – Toggle teleport mode (Shift+Click to teleport)
 *   +/- – Increase / decrease game speed
 *   F4  – Reset game speed to 1×
 *   H   – Reduce player health by 10
 *   M   – Reduce player mana by 10
 */

import * as PIXI from 'pixi.js';
import state from './state';
import { Character } from './character';

declare global {
    interface Window {
        DEBUG: DebugState;
    }
}

interface DebugState {
    active: boolean;
    showCollision: boolean;
    noclip: boolean;
    teleportMode: boolean;
    gameSpeed: number;
    speedOptions: number[];
    speedIndex: number;
    overlay: PIXI.Text | null;
    collisionGraphics: PIXI.Graphics | null;
}

function initDebug(): void {
    if (window.DEBUG) {
        console.log('Debug mode is already active.');
        return;
    }

    // ── Debug state ─────────────────────────────────────────────────

    window.DEBUG = {
        active: true,
        showCollision: false,
        noclip: false,
        teleportMode: false,
        gameSpeed: 1,
        speedOptions: [0.25, 0.5, 1, 2, 5, 10],
        speedIndex: 2, // starts at 1×
        overlay: null,
        collisionGraphics: null,
    };
    const app = state.app!;
    const area = state.area!;

    // ── Overlay text (screen-space) ─────────────────────────────────

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
    window.DEBUG.overlay = debugText;

    // ── Collision graphics (world-space, moves with camera) ─────────

    const collGfx = new PIXI.Graphics();
    (collGfx as PIXI.Graphics & { sortY: number }).sortY = Infinity;
    window.DEBUG.collisionGraphics = collGfx;
    area.container.addChild(collGfx);

    // ── Noclip – monkey-patch Character.prototype.update ────────────

    const _origCharUpdate = Character.prototype.update;
    Character.prototype.update = function (this: Character, delta: number) {
        if (window.DEBUG?.noclip && this === state.player) {
            const savedColliders = state.area!.colliders;
            const savedBoundaries = state.area!.boundaries;
            state.area!.colliders = [];
            state.area!.boundaries = [];
            _origCharUpdate.call(this, delta);
            state.area!.colliders = savedColliders;
            state.area!.boundaries = savedBoundaries;
            return;
        }
        _origCharUpdate.call(this, delta);
    };

    // ── Debug tick ──────────────────────────────────────────────────

    app.ticker.add(() => {
        if (!window.DEBUG.active) return;

        const player = state.player;

        // ── Overlay text ────────────────────────────────────────────
        const lines = ['[DEBUG]'];
        lines.push('FPS: ' + Math.round(app.ticker.FPS));
        if (player) {
            lines.push('Pos: ' + Math.round(player.x) + ', ' + Math.round(player.y));
        }
        if (window.DEBUG.gameSpeed !== 1) {
            lines.push('Speed: ' + window.DEBUG.gameSpeed + '\u00d7');
        }
        if (window.DEBUG.noclip) lines.push('NOCLIP');
        if (window.DEBUG.teleportMode) lines.push('TELEPORT (Shift+Click)');
        if (window.DEBUG.showCollision) lines.push('COLLISION');
        lines.push('');
        lines.push('F1 collision | F2 noclip');
        lines.push('F3 teleport  | F4 reset speed');
        lines.push('+/- speed');

        debugText.text = lines.join('\n');

        // Keep overlay above everything
        const stageChildren = app.stage.children;
        const idx = stageChildren.indexOf(debugText);
        if (idx !== -1 && idx !== stageChildren.length - 1) {
            app.stage.removeChild(debugText);
            app.stage.addChild(debugText);
        }

        // ── Collision visualisation ─────────────────────────────────
        collGfx.clear();
        if (!window.DEBUG.showCollision || !state.area) return;

        function drawPoly(
            points: { x: number; y: number }[],
            fillColor: number,
            fillAlpha: number,
            strokeColor: number,
            strokeAlpha: number,
            strokeWidth: number,
        ): void {
            const flat: number[] = [];
            for (const p of points) { flat.push(p.x, p.y); }
            collGfx.poly(flat, true);
            collGfx.fill({ color: fillColor, alpha: fillAlpha });
            collGfx.stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
        }

        // Static world colliders (red)
        for (const poly of state.area.colliders) {
            drawPoly(poly, 0xff0000, 0.15, 0xff0000, 0.7, 2);
        }

        // Invisible boundaries (blue)
        for (const b of state.area.boundaries) {
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
        if (state.area.enemies) {
            for (const e of state.area.enemies) {
                if (!e.isAlive) continue;
                const ep = e.getWorldCollisionPoly();
                if (ep) drawPoly(ep, 0xffff00, 0.15, 0xffff00, 0.7, 1.5);
            }
        }

        // NPC collision polys (cyan)
        if (state.area.npcs) {
            for (const npc of state.area.npcs) {
                const np = npc.getWorldCollisionPoly();
                if (np) drawPoly(np, 0x00ffff, 0.15, 0x00ffff, 0.7, 1.5);
            }
        }
    });

    // ── Keyboard shortcuts ──────────────────────────────────────────

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!window.DEBUG.active) return;

        switch (e.key) {
            case 'F1':
                e.preventDefault();
                window.DEBUG.showCollision = !window.DEBUG.showCollision;
                if (!window.DEBUG.showCollision) collGfx.clear();
                break;

            case 'F2':
                e.preventDefault();
                window.DEBUG.noclip = !window.DEBUG.noclip;
                break;

            case 'F3':
                e.preventDefault();
                window.DEBUG.teleportMode = !window.DEBUG.teleportMode;
                break;

            case 'F4':
                e.preventDefault();
                window.DEBUG.speedIndex = 2;
                window.DEBUG.gameSpeed = 1;
                app.ticker.speed = 1;
                PIXI.Ticker.shared.speed = 1;
                break;

            case '+':
            case '=':
                window.DEBUG.speedIndex = Math.min(window.DEBUG.speedIndex + 1, window.DEBUG.speedOptions.length - 1);
                window.DEBUG.gameSpeed = window.DEBUG.speedOptions[window.DEBUG.speedIndex]!;
                app.ticker.speed = window.DEBUG.gameSpeed;
                PIXI.Ticker.shared.speed = window.DEBUG.gameSpeed;
                break;

            case '-':
            case '_':
                window.DEBUG.speedIndex = Math.max(window.DEBUG.speedIndex - 1, 0);
                window.DEBUG.gameSpeed = window.DEBUG.speedOptions[window.DEBUG.speedIndex]!;
                app.ticker.speed = window.DEBUG.gameSpeed;
                PIXI.Ticker.shared.speed = window.DEBUG.gameSpeed;
                break;

            case 'h':
            case 'H':
                if (state.player) state.player.currentHealth = Math.max(0, state.player.currentHealth - 10);
                break;

            case 'm':
            case 'M':
                if (state.player) state.player.currentMana = Math.max(0, state.player.currentMana - 10);
                break;
        }
    });

    // ── Teleport (Shift+Click when teleport mode is on) ─────────────

    app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
        if (!window.DEBUG.active || !window.DEBUG.teleportMode || !state.player) return;
        if (!(event.data?.originalEvent as unknown as MouseEvent)?.shiftKey) return;

        const pos = event.data.global;
        const worldX = pos.x - state.area!.container.x;
        const worldY = pos.y - state.area!.container.y;

        state.player.x = worldX;
        state.player.y = worldY;
        state.player.container.x = worldX;
        state.player.container.y = worldY;
        state.player.targetPosition = null;
        state.player.stopWalkAnimation();
    });

    // ── Activation message ──────────────────────────────────────────

    console.log(
        '%c[DaggerQuest] Debug mode activated!',
        'color: #00ff00; font-weight: bold; font-size: 14px;',
    );
}

export { initDebug };
