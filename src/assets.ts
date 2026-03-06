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

// ── CPU memory management ─────────────────────────────────────────────────

const _trackedSources = new Set<PIXI.TextureSource>();

/** Register a spritesheet's texture sources for later CPU memory release. */
export function trackSpritesheet(spritesheet: PIXI.Spritesheet): void {
    for (const name in spritesheet.textures) {
        _trackedSources.add(spritesheet.textures[name]!.source);
    }
}

/** Register a single texture's source for later CPU memory release. */
export function trackTexture(texture: PIXI.Texture): void {
    _trackedSources.add(texture.source);
}

/**
 * Free CPU-side image data for all tracked texture sources.
 * Call after the first render frame so textures are already on the GPU.
 * After this call, textures remain usable for rendering but cannot be
 * re-uploaded on WebGL context loss.
 */
export function releaseTrackedCPUData(): void {
    for (const source of _trackedSources) {
        const res = source.resource;
        if (res && typeof (res as ImageBitmap).close === 'function') {
            (res as ImageBitmap).close();
        }
    }
    _trackedSources.clear();
}

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

// ── Frame tags ───────────────────────────────────────────────────────────

/** Per-animation tag data.  Extensible — add new tag keys as needed. */
export interface AnimFrameTags {
    fireFrame?: number;
    // Future: footstep?: number[];
    [key: string]: unknown;
}

/** animation name → tags.  Loaded from src/data/frameTags/{spriteKey}.json. */
export type FrameTags = Record<string, AnimFrameTags>;

const _frameTagsCache = new Map<string, FrameTags>();

/**
 * Fetch (and cache) the frame-tags file for a spriteKey.
 * Returns an empty object if no file exists for that key.
 */
export async function fetchFrameTags(spriteKey: string): Promise<FrameTags> {
    const cached = _frameTagsCache.get(spriteKey);
    if (cached) return cached;

    try {
        const resp = await fetch(assetPath(`src/data/frameTags/${spriteKey}.json`));
        if (!resp.ok) throw new Error(resp.statusText);
        const tags: FrameTags = await resp.json();
        _frameTagsCache.set(spriteKey, tags);
        return tags;
    } catch {
        const empty: FrameTags = {};
        _frameTagsCache.set(spriteKey, empty);
        return empty;
    }
}
