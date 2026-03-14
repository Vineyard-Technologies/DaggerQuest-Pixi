import * as PIXI from 'pixi.js';
import { COLLISION_POLYS, DEFAULT_BOX, polyToWorld, WorldPoint, NormPoint, Boundary } from './collision';
import { fetchManifest, assetPath, trackSpritesheet, trackTexture, createShadowSprite } from './assets';
import { safeDestroy } from './safeDestroy';
import type { Enemy } from './enemy';
import type { NPC } from './npc';
import type { Loot } from './loot';

// Module augmentation: extend Container with sortY (used when placing loot)
declare module 'pixi.js' {
    interface Container {
        sortY?: number;
    }
}

interface AreaOptions {
    width: number;
    height: number;
    backgroundTexture: string;
    playerStartX: number;
    playerStartY: number;
    level?: number;
}

interface PlaceStaticSpriteOptions {
    shadow?: boolean;
    visible?: boolean;
    collider?: boolean;
}

class Area {
    readonly width: number;
    readonly height: number;
    readonly backgroundTexture: string;
    readonly playerStartX: number;
    readonly playerStartY: number;
    readonly level: number;
    container: PIXI.Container;
    lootOnGround: Loot[];
    enemies: Enemy[];
    npcs: NPC[];
    boundaries: Boundary[];
    colliders: WorldPoint[][];
    lootLabelsContainer: PIXI.Container & { sortY?: number };
    backgroundTile: PIXI.TilingSprite | null = null;

    constructor({ width, height, backgroundTexture, playerStartX, playerStartY, level = 1 }: AreaOptions) {
        this.width = width;
        this.height = height;
        this.backgroundTexture = backgroundTexture;
        this.playerStartX = playerStartX;
        this.playerStartY = playerStartY;
        this.level = level;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        this.lootOnGround = [];
        this.enemies = [];
        this.npcs = [];
        this.boundaries = [];
        this.colliders = [];
        this.lootLabelsContainer = new PIXI.Container() as PIXI.Container & { sortY?: number };
        this.lootLabelsContainer.label = 'lootLabels';
        this.lootLabelsContainer.zIndex = Infinity;
        this.container.addChild(this.lootLabelsContainer);
    }

    async createBackground(): Promise<void> {
        const texture = await PIXI.Assets.load(assetPath(this.backgroundTexture));
        trackTexture(texture);
        this.backgroundTile = new PIXI.TilingSprite({ texture, width: this.width, height: this.height * 2 });
        this.backgroundTile.tileRotation = Math.PI / 8;
        this.backgroundTile.scale.y = 0.5;
        this.backgroundTile.x = 0;
        this.backgroundTile.y = 0;
        this.backgroundTile.zIndex = -Infinity;
        this.container.addChild(this.backgroundTile);
    }

    async placeStaticSprite(
        spriteKey: string, x: number, y: number,
        { shadow = true, visible = true, collider = true }: PlaceStaticSpriteOptions = {},
    ): Promise<PIXI.Container | null> {
        const manifest = await fetchManifest();
        const sheets = manifest[spriteKey] || [];
        if (sheets.length === 0) {
            console.warn(`No spritesheets found for "${spriteKey}"`);
            return null;
        }

        const container = new PIXI.Container();
        container.x = x;
        container.y = y;

        if (shadow) {
            const shadowKey = `${spriteKey}_shadow`;
            const shadowSheets = manifest[shadowKey] || [];
            if (shadowSheets.length > 0) {
                const shadowPath = assetPath(`images/spritesheets/${shadowSheets[0]!.replace('./', '')}`);
                const shadowSheet = await PIXI.Assets.load(shadowPath);
                trackSpritesheet(shadowSheet);
                const shadowTexName = Object.keys(shadowSheet.textures)[0];
                if (shadowTexName) {
                    createShadowSprite(shadowSheet.textures[shadowTexName], container);
                }
            }
        }

        const fullPath = assetPath(`images/spritesheets/${sheets[0]!.replace('./', '')}`);
        const spritesheet = await PIXI.Assets.load(fullPath);
        trackSpritesheet(spritesheet);
        const textureName = Object.keys(spritesheet.textures)[0];
        if (textureName) {
            const sprite = new PIXI.Sprite(spritesheet.textures[textureName]);
            container.addChild(sprite);
            if (collider) {
                const normPoly = COLLISION_POLYS[spriteKey as keyof typeof COLLISION_POLYS] ?? DEFAULT_BOX;
                const texture = spritesheet.textures[textureName];
                const w = texture.width;
                const h = texture.height;
                const ax = sprite.anchor?.x ?? 0;
                const ay = sprite.anchor?.y ?? 0;
                const worldPoly = polyToWorld(normPoly, x, y, w, h, ax, ay);
                this.colliders.push(worldPoly);
            }
        }

        container.visible = visible;
        container.zIndex = y;
        this.container.addChild(container);
        return container;
    }

    update(delta: number): void {
        for (const enemy of this.enemies) {
            enemy.update(delta);
            const z = Math.round(enemy.y);
            if (enemy.container.zIndex !== z) enemy.container.zIndex = z;
        }
        for (const npc of this.npcs) {
            npc.update(delta);
            const z = Math.round(npc.y);
            if (npc.container.zIndex !== z) npc.container.zIndex = z;
        }
        for (const loot of this.lootOnGround) {
            const z = loot.container.sortY ?? loot.y;
            if (loot.container.zIndex !== z) loot.container.zIndex = z;
        }
    }

    destroy(): void {
        for (const enemy of this.enemies) enemy.destroy();
        for (const npc of this.npcs) npc.destroy();
        for (const loot of this.lootOnGround) loot.destroy();
        this.enemies.length = 0;
        this.npcs.length = 0;
        this.lootOnGround.length = 0;
        this.boundaries.length = 0;
        this.colliders.length = 0;
        if (this.backgroundTile) {
            safeDestroy(this.backgroundTile);
            this.backgroundTile = null;
        }
        safeDestroy(this.container, { children: true });
    }
}

export { Area };
export type { AreaOptions, PlaceStaticSpriteOptions };
