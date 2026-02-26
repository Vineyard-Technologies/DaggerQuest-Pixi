/**
 * Low-level asset utilities shared across the codebase.
 *
 * Centralises manifest fetching and common PixiJS filter instances so that
 * neither `Entity` nor any other base class needs to import from `Area`.
 */

import * as PIXI from 'pixi.js';

// ── Shared filter instances ───────────────────────────────────────────────

/** Reusable blur filter applied to every shadow sprite. */
export const SHADOW_BLUR = new PIXI.BlurFilter({ strength: 4 });

// ── Asset path resolution ─────────────────────────────────────────────────

/**
 * Resolve a relative asset path against Vite's configured `base`.
 *
 * In dev this returns the path unchanged (`/`-rooted), and in production
 * builds with `--base /game/` it returns e.g. `/game/images/…`.
 */
export function assetPath(relativePath: string): string {
    const base = import.meta.env.BASE_URL; // e.g. "/" or "/game/"
    // Strip leading "./" so we don't end up with "/game/./images/…"
    const clean = relativePath.replace(/^\.\/?/, '');
    return `${base}${clean}`;
}

// ── Manifest loading ─────────────────────────────────────────────────────

let _manifest: Record<string, string[]> | null = null;

/**
 * Fetch (and cache) the spritesheet manifest.
 * Safe to call from any module — the network request only happens once.
 */
export async function fetchManifest(): Promise<Record<string, string[]>> {
    if (!_manifest) {
        _manifest = await fetch(assetPath('images/spritesheets/manifest.json')).then(r => r.json());
    }
    return _manifest!;
}
