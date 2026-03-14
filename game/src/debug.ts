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
 * Deactivate without restarting:
 *   F1 key (toggles debug on/off)
 *   – or – exitdebug() from the browser console
 *
 * Features:
 *   F5  – Toggle collision polygon visualization
 *   F2  – Toggle noclip (walk through everything)
 *   F3  – Toggle teleport mode (Shift+Click to teleport)
 *   F4  – Reset game speed to 1×
 *   F9  – Level down
 *   F10 – Level up
 *   F11 – Slow down game speed
 *   F12 – Speed up game speed
 *   F1  – Toggle debug mode on/off
 *   H   – Reduce player health by 10
 *   M   – Reduce player mana by 10
 *   F6  – Toggle invincibility
 *   F7  – Spawn a random enemy at the cursor
 *   F8  – Spawn a random piece of loot at the cursor
 */

import * as PIXI from 'pixi.js';
import state from './state';
import { Character } from './character';
import { createEnemy } from './enemy';
import { createItem } from './items';

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
    invincible: boolean;
    gameSpeed: number;
    speedOptions: number[];
    speedIndex: number;
    overlay: PIXI.Text | null;
    collisionGraphics: PIXI.Graphics | null;
    tickerCallback: (() => void) | null;
    frameStartCallback: (() => void) | null;
    keydownHandler: ((e: KeyboardEvent) => void) | null;
    teleportHandler: ((e: PIXI.FederatedPointerEvent) => void) | null;
    origCharUpdate: ((delta: number) => void) | null;
    origTakeDamage: ((amount: number) => void) | null;
}

function formatUptime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(h + 'h');
    parts.push(String(m).padStart(h > 0 ? 2 : 1, '0') + 'm');
    parts.push(String(s).padStart(2, '0') + 's');
    return parts.join(' ');
}

function exitDebug(): void {
    if (!window.DEBUG?.active) {
        console.log('Debug mode is not active.');
        return;
    }

    const app = state.app!;

    // Reset game speed
    app.ticker.speed = 1;
    PIXI.Ticker.shared.speed = 1;

    // Remove overlay text
    if (window.DEBUG.overlay) {
        window.DEBUG.overlay.destroy();
        window.DEBUG.overlay = null;
    }

    // Remove ticker callbacks
    if (window.DEBUG.tickerCallback) {
        app.ticker.remove(window.DEBUG.tickerCallback);
        window.DEBUG.tickerCallback = null;
    }
    if (window.DEBUG.frameStartCallback) {
        app.ticker.remove(window.DEBUG.frameStartCallback);
        window.DEBUG.frameStartCallback = null;
    }

    // Remove collision graphics
    if (window.DEBUG.collisionGraphics) {
        window.DEBUG.collisionGraphics.clear();
        window.DEBUG.collisionGraphics.destroy();
        window.DEBUG.collisionGraphics = null;
    }

    // Remove keydown handler
    if (window.DEBUG.keydownHandler) {
        window.removeEventListener('keydown', window.DEBUG.keydownHandler);
        window.DEBUG.keydownHandler = null;
    }

    // Remove teleport handler
    if (window.DEBUG.teleportHandler) {
        app.stage.off('pointerdown', window.DEBUG.teleportHandler);
        window.DEBUG.teleportHandler = null;
    }

    // Restore original prototype methods
    if (window.DEBUG.origCharUpdate) {
        Character.prototype.update = window.DEBUG.origCharUpdate;
        window.DEBUG.origCharUpdate = null;
    }
    if (window.DEBUG.origTakeDamage) {
        Character.prototype.takeDamage = window.DEBUG.origTakeDamage;
        window.DEBUG.origTakeDamage = null;
    }

    // Reset all debug flags
    window.DEBUG.active = false;
    window.DEBUG.showCollision = false;
    window.DEBUG.noclip = false;
    window.DEBUG.teleportMode = false;
    window.DEBUG.invincible = false;
    window.DEBUG.gameSpeed = 1;
    window.DEBUG.speedIndex = 2;

    console.log(
        '%c[DaggerQuest] Debug mode deactivated.',
        'color: #ff8800; font-weight: bold; font-size: 14px;',
    );
}

function initDebug(): void {
    if (window.DEBUG?.active) {
        console.log('Debug mode is already active.');
        return;
    }

    // ── Debug state ─────────────────────────────────────────────────

    window.DEBUG = {
        active: true,
        showCollision: false,
        noclip: false,
        teleportMode: false,
        invincible: false,
        gameSpeed: 1,
        speedOptions: [0.25, 0.5, 1, 2, 5, 10],
        speedIndex: 2, // starts at 1×
        overlay: null,
        collisionGraphics: null,
        tickerCallback: null,
        frameStartCallback: null,
        keydownHandler: null,
        teleportHandler: null,
        origCharUpdate: null,
        origTakeDamage: null,
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
            lineHeight: 18,
        },
    });
    debugText.anchor.set(0, 1);
    debugText.x = 8;
    debugText.y = app.screen.height - 8;
    app.stage.addChild(debugText);
    window.DEBUG.overlay = debugText;

    // ── Collision graphics (world-space, moves with camera) ─────────

    const collGfx = new PIXI.Graphics();
    (collGfx as PIXI.Graphics & { sortY: number }).sortY = Infinity;
    window.DEBUG.collisionGraphics = collGfx;
    area.container.addChild(collGfx);

    // ── System metrics (queried once at debug activation) ───────────

    const renderer = app.renderer as any;
    const isWebGPU = renderer.name === 'webgpu';
    let gpuRendererName = 'N/A';

    try {
        if (isWebGPU) {
            // WebGPU path – adapter.info has GPU details
            const adapter: GPUAdapter | null = renderer.gpu?.adapter ?? null;
            if (adapter) {
                const info = adapter.info;
                const device = info.device || '';
                const vendor = info.vendor || '';
                const arch = info.architecture || '';
                let name = device || [vendor, arch].filter(Boolean).join(' ');
                if (!name) name = 'WebGPU';
                gpuRendererName = name.length > 48 ? name.substring(0, 48) + '\u2026' : name;
            } else {
                gpuRendererName = 'WebGPU';
            }
        } else {
            // WebGL path
            const glContext: WebGL2RenderingContext | null = renderer.context?.gl ?? null;
            if (glContext) {
                const debugExt = glContext.getExtension('WEBGL_debug_renderer_info');
                if (debugExt) {
                    let raw = glContext.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) as string;
                    const m = raw.match(/ANGLE \([^,]*,\s*([^,]+)/);
                    if (m?.[1]) raw = m[1].replace(/\s+Direct3D.*$/, '').trim();
                    gpuRendererName = raw.length > 48 ? raw.substring(0, 48) + '\u2026' : raw;
                }
            }
        }
    } catch { /* GPU info unavailable */ }

    /** Bytes per pixel for common GPU texture formats. */
    function bytesPerPixel(format: string): number {
        if (format.startsWith('rgba32'))  return 16;
        if (format.startsWith('rgba16'))  return 8;
        if (format.startsWith('rgba8'))   return 4;
        if (format.startsWith('bgra8'))   return 4;
        if (format.startsWith('rg32'))    return 8;
        if (format.startsWith('rg16'))    return 4;
        if (format.startsWith('rg8'))     return 2;
        if (format.startsWith('r32'))     return 4;
        if (format.startsWith('r16'))     return 2;
        if (format.startsWith('r8'))      return 1;
        if (format.startsWith('depth32')) return 4;
        if (format.startsWith('depth24')) return 4;
        if (format.startsWith('depth16')) return 2;
        // BC / ASTC compressed – rough average
        if (format.startsWith('bc1') || format.startsWith('bc4'))  return 0.5;
        if (format.startsWith('bc'))      return 1;
        if (format.startsWith('astc'))    return 1;
        return 4; // default assumption: 4 bytes (RGBA8)
    }

    /** Sum VRAM for all textures currently managed by the renderer. */
    function calcTextureVRAM(): number {
        let totalBytes = 0;
        const managed: PIXI.TextureSource[] = renderer.texture?.managedTextures ?? [];
        for (const src of managed) {
            if (!src) continue;
            const w = src.pixelWidth;
            const h = src.pixelHeight;
            const bpp = bytesPerPixel(src.format);
            let texBytes = w * h * bpp;
            // Account for mipmaps (adds ~33%)
            if (src.mipLevelCount > 1) texBytes *= 1.33;
            totalBytes += texBytes;
        }
        return totalBytes;
    }

    let frameDurationSmoothed = 0;
    let frameStartTime = 0;
    const frameStartCb = () => { frameStartTime = performance.now(); };
    app.ticker.add(frameStartCb, undefined, PIXI.UPDATE_PRIORITY.HIGH);
    window.DEBUG.frameStartCallback = frameStartCb;

    // ── Noclip – monkey-patch Character.prototype.update ────────────

    // ── Invincibility – monkey-patch Character.prototype.takeDamage ──

    const _origTakeDamage = Character.prototype.takeDamage;
    window.DEBUG.origTakeDamage = _origTakeDamage;
    Character.prototype.takeDamage = function (this: Character, amount: number) {
        if (window.DEBUG?.invincible && this === state.player) return;
        _origTakeDamage.call(this, amount);
    };

    const _origCharUpdate = Character.prototype.update;
    window.DEBUG.origCharUpdate = _origCharUpdate;
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

    const debugTicker = () => {
        if (!window.DEBUG.active) return;

        const player = state.player;

        // ── Overlay text ────────────────────────────────────────────
        // Frame processing time → CPU utilization estimate
        const frameProcessingMs = performance.now() - frameStartTime;
        frameDurationSmoothed = frameDurationSmoothed === 0
            ? frameProcessingMs
            : frameDurationSmoothed * 0.9 + frameProcessingMs * 0.1;
        const targetMs = 1000 / 60;
        const cpuPct = Math.min(100, Math.round((frameDurationSmoothed / targetMs) * 100));

        const lines = ['[DEBUG]'];
        lines.push('FPS: ' + Math.round(app.ticker.FPS));
        lines.push('CPU: ' + cpuPct + '% (' + frameDurationSmoothed.toFixed(1) + 'ms)');
        lines.push('GPU: ' + gpuRendererName + (isWebGPU ? ' (WebGPU)' : ' (WebGL)'));

        // JS heap memory (Chromium browsers only)
        const perfMem = (performance as any).memory;
        if (perfMem) {
            const usedMB = Math.round(perfMem.usedJSHeapSize / (1024 * 1024));
            const limitMB = Math.round(perfMem.jsHeapSizeLimit / (1024 * 1024));
            lines.push('RAM: ' + usedMB + ' MB / ' + limitMB + ' MB');
        } else {
            lines.push('RAM: N/A');
        }

        // GPU VRAM – running total of managed texture memory
        const vramBytes = calcTextureVRAM();
        const vramMB = (vramBytes / (1024 * 1024)).toFixed(1);
        const texCount = (renderer.texture?.managedTextures ?? []).length;
        lines.push('VRAM: ~' + vramMB + ' MB (' + texCount + ' textures)');

        lines.push('Uptime: ' + formatUptime(state.sessionUptimeMs));
        if (player) {
            lines.push('Pos: ' + Math.round(player.x) + ', ' + Math.round(player.y));
        }
        if (window.DEBUG.gameSpeed !== 1) {
            lines.push('Speed: ' + window.DEBUG.gameSpeed + '\u00d7');
        }
        if (window.DEBUG.noclip) lines.push('NOCLIP');
        if (window.DEBUG.invincible) lines.push('INVINCIBLE');
        if (window.DEBUG.teleportMode) lines.push('TELEPORT (Shift+Click)');
        if (window.DEBUG.showCollision) lines.push('COLLISION');
        lines.push('');
        lines.push('F1 toggle debug | F2 noclip');
        lines.push('F3 teleport     | F4 reset speed');
        lines.push('F5 show hitboxes | F6 invincible');
        lines.push('F7 spawn enemy   | F8 spawn loot');
        lines.push('F9 level down    | F10 level up');
        lines.push('F11 slow down    | F12 speed up');
        lines.push('H health | M mana');

        debugText.text = lines.join('\n');
        debugText.y = app.screen.height - 8;

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

        // Projectile collision polys (magenta)
        for (const proj of state.projectiles) {
            if (!proj.isAlive) continue;
            const pp = proj.getWorldPoly();
            drawPoly(pp, 0xff00ff, 0.15, 0xff00ff, 0.7, 1.5);
        }
    };

    app.ticker.add(debugTicker);
    window.DEBUG.tickerCallback = debugTicker;

    // ── Keyboard shortcuts ──────────────────────────────────────────

    const debugKeydownHandler = (e: KeyboardEvent) => {
        if (!window.DEBUG.active) return;

        switch (e.key) {
            case 'F5':
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

            case 'F9':
                e.preventDefault();
                if (state.player && state.player.level > 1) {
                    state.player.level -= 1;
                }
                break;

            case 'F10':
                e.preventDefault();
                if (state.player) {
                    state.player.level += 1;
                }
                break;

            case 'F11':
                e.preventDefault();
                window.DEBUG.speedIndex = Math.max(window.DEBUG.speedIndex - 1, 0);
                window.DEBUG.gameSpeed = window.DEBUG.speedOptions[window.DEBUG.speedIndex]!;
                app.ticker.speed = window.DEBUG.gameSpeed;
                PIXI.Ticker.shared.speed = window.DEBUG.gameSpeed;
                break;

            case 'F12':
                e.preventDefault();
                window.DEBUG.speedIndex = Math.min(window.DEBUG.speedIndex + 1, window.DEBUG.speedOptions.length - 1);
                window.DEBUG.gameSpeed = window.DEBUG.speedOptions[window.DEBUG.speedIndex]!;
                app.ticker.speed = window.DEBUG.gameSpeed;
                PIXI.Ticker.shared.speed = window.DEBUG.gameSpeed;
                break;

            case 'F6':
                e.preventDefault();
                window.DEBUG.invincible = !window.DEBUG.invincible;
                break;

            case 'F7':
                e.preventDefault();
                spawnRandomEnemy();
                break;

            case 'F8':
                e.preventDefault();
                spawnRandomLoot();
                break;

            case 'h':
            case 'H':
                if (state.player) {
                    state.player.currentHealth = Math.max(0, state.player.currentHealth - 10);
                    if (state.player.currentHealth <= 0) state.player.die();
                }
                break;

            case 'm':
            case 'M':
                if (state.player) state.player.currentMana = Math.max(0, state.player.currentMana - 10);
                break;
        }
    };

    window.addEventListener('keydown', debugKeydownHandler);
    window.DEBUG.keydownHandler = debugKeydownHandler;

    // ── Teleport (Shift+Click when teleport mode is on) ─────────────

    const teleportHandler = (event: PIXI.FederatedPointerEvent) => {
        if (!window.DEBUG.active || !window.DEBUG.teleportMode || !state.player) return;
        const nativeEvent = event.nativeEvent;
        if (!(nativeEvent instanceof MouseEvent) || !nativeEvent.shiftKey) return;

        event.stopPropagation();

        const pos = event.data.global;
        const worldX = pos.x - state.area!.container.x;
        const worldY = pos.y - state.area!.container.y;

        state.player.x = worldX;
        state.player.y = worldY;
        state.player.container.x = worldX;
        state.player.container.y = worldY;
        state.player.targetPosition = null;
        state.player.stopWalkAnimation();
    };

    app.stage.on('pointerdown', teleportHandler);
    window.DEBUG.teleportHandler = teleportHandler;

    // ── Spawn random enemy ────────────────────────────────────────

    const ENEMY_SPRITE_KEYS = ['goblinunderling', 'goblinarcher', 'goblinwarlock'];

    async function spawnRandomEnemy(): Promise<void> {
        if (!state.area) return;

        const spriteKey = ENEMY_SPRITE_KEYS[Math.floor(Math.random() * ENEMY_SPRITE_KEYS.length)]!;

        // Spawn at the cursor's world position
        const spawnX = state.input.pointerScreenX - state.area.container.x;
        const spawnY = state.input.pointerScreenY - state.area.container.y;

        const enemy = createEnemy(spriteKey, spawnX, spawnY);
        await enemy.loadTextures();
        state.area.container.addChild(enemy.container);
        state.area.enemies.push(enemy);
        enemy.startIdlePingPong();
    }

    // ── Spawn random loot ──────────────────────────────────────────

    const RANDOM_LOOT_IDS = [
        'simplesword', 'simpleshield', 'simpleshirt', 'simplepants',
        'simplemace', 'simplehelmet', 'simplegloves', 'strappedboots',
        'crudehelmet', 'leatherjacket', 'leggings',
        'maraudersbracers', 'maraudersstraps', 'ornateshield',
    ];

    async function spawnRandomLoot(): Promise<void> {
        if (!state.area) return;

        const id = RANDOM_LOOT_IDS[Math.floor(Math.random() * RANDOM_LOOT_IDS.length)]!;
        const item = createItem(id);

        const spawnX = state.input.pointerScreenX - state.area.container.x;
        const spawnY = state.input.pointerScreenY - state.area.container.y;

        const loot = item.createLoot(spawnX, spawnY);
        await loot.loadTextures();
        state.area.container.addChild(loot.container);
        loot.attachLabelsTo(state.area.lootLabelsContainer);
        state.area.lootOnGround.push(loot);
    }

    // ── Activation message ──────────────────────────────────────────

    console.log(
        '%c[DaggerQuest] Debug mode activated!',
        'color: #00ff00; font-weight: bold; font-size: 14px;',
    );
}

export { initDebug, exitDebug };
