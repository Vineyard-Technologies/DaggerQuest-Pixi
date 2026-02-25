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

// ── Manifest loading ─────────────────────────────────────────────────────

let _manifest: Record<string, string[]> | null = null;

/**
 * Fetch (and cache) the spritesheet manifest.
 * Safe to call from any module — the network request only happens once.
 */
export async function fetchManifest(): Promise<Record<string, string[]>> {
    if (!_manifest) {
        _manifest = await fetch('./images/spritesheets/manifest.json').then(r => r.json());
    }
    return _manifest!;
}
