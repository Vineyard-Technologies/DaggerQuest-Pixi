import * as PIXI from 'pixi.js';
import { assetPath } from './assets';
import { isDefined } from './types';

/** Animation textures: { animName: { direction: Texture[] } } */
export type AnimationTextures = Record<string, Record<number, PIXI.Texture[]>>;

export interface LoadResult {
    textures: AnimationTextures;
    assetPaths: string[];
}

/**
 * Load spritesheets for a given key from the manifest, parse animation
 * frames using the standard `key-anim_direction-frame` naming convention,
 * and return the organised texture map plus the asset paths loaded.
 */
export async function loadSheetTextures(
    manifest: Record<string, string[]>,
    key: string,
): Promise<LoadResult> {
    const textures: AnimationTextures = {};
    const assetPaths: string[] = [];
    const sheets = manifest[key] || [];
    if (sheets.length === 0) return { textures, assetPaths };

    const pattern = new RegExp(`${key}-(\\w+)_([\\-\\d.]+)-(\\d+)`);

    for (const sheetPath of sheets) {
        const fullPath = assetPath(`images/spritesheets/${sheetPath.replace('./', '')}`);
        assetPaths.push(fullPath);
        const spritesheet: PIXI.Spritesheet = await PIXI.Assets.load(fullPath);

        for (const frameName in spritesheet.textures) {
            const match = frameName.match(pattern);
            if (!match) continue;

            const animName = match[1]!;
            const direction = parseFloat(match[2]!);
            const frameNum = parseInt(match[3]!);

            if (!textures[animName]) textures[animName] = {};
            if (!textures[animName]![direction]) textures[animName]![direction] = [];
            textures[animName]![direction]![frameNum] = spritesheet.textures[frameName]!;
        }
    }

    for (const anim in textures) {
        for (const dir in textures[anim]) {
            textures[anim]![Number(dir)] = textures[anim]![Number(dir)]!.filter(isDefined);
        }
    }

    return { textures, assetPaths };
}
