import * as PIXI from 'pixi.js';
import { COLLISION_POLYS, DEFAULT_BOX, polyToWorld, WorldPoint, NormPoint, Boundary } from './collision';
import { SHADOW_BLUR, fetchManifest } from './assets';
import type { Enemy } from './enemy';
import type { NPC } from './npc';
import type { Loot } from './loot';

// Module augmentation: pixi.js Container doesn't expose sortDirty publicly
declare module 'pixi.js' {
    interface Container {
        sortDirty?: boolean;
    }
}

interface AreaOptions {
    width: number;
    height: number;
    backgroundTexture: string;
    playerStartX: number;
    playerStartY: number;
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
    container: PIXI.Container;
    lootOnGround: Loot[];
    enemies: Enemy[];
    npcs: NPC[];
    boundaries: Boundary[];
    colliders: WorldPoint[][];
    lootLabelsContainer: PIXI.Container & { sortY?: number };
    backgroundTile: PIXI.TilingSprite | null = null;

    constructor({ width, height, backgroundTexture, playerStartX, playerStartY }: AreaOptions) {
        this.width = width;
        this.height = height;
        this.backgroundTexture = backgroundTexture;
        this.playerStartX = playerStartX;
        this.playerStartY = playerStartY;
        this.container = new PIXI.Container();
        this.lootOnGround = [];
        this.enemies = [];
        this.npcs = [];
        this.boundaries = [];
        this.colliders = [];
        this.lootLabelsContainer = new PIXI.Container() as PIXI.Container & { sortY?: number };
        this.lootLabelsContainer.label = 'lootLabels';
        this.lootLabelsContainer.sortY = Infinity;
        this.container.addChild(this.lootLabelsContainer);
    }

    async spawnObjects(): Promise<void> {}

    async createBackground(): Promise<void> {
        const texture = await PIXI.Assets.load(this.backgroundTexture);
        this.backgroundTile = new PIXI.TilingSprite({ texture, width: this.width, height: this.height * 2 });
        this.backgroundTile.tileRotation = Math.PI / 8;
        this.backgroundTile.scale.y = 0.5;
        this.backgroundTile.x = 0;
        this.backgroundTile.y = 0;
        this.container.addChildAt(this.backgroundTile, 0);
    }

    /**
     * @deprecated Import `fetchManifest` from `./assets` instead.
     */
    static async fetchManifest(): Promise<Record<string, string[]>> {
        return fetchManifest();
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
                const shadowPath = `./images/spritesheets/${shadowSheets[0]!.replace('./', '')}`;
                const shadowSheet = await PIXI.Assets.load(shadowPath);
                const shadowTexName = Object.keys(shadowSheet.textures)[0];
                if (shadowTexName) {
                    const shadowSprite = new PIXI.Sprite(shadowSheet.textures[shadowTexName]);
                    shadowSprite.alpha = 0.5;
                    shadowSprite.filters = [SHADOW_BLUR];
                    container.addChild(shadowSprite);
                }
            }
        }

        const fullPath = `./images/spritesheets/${sheets[0]!.replace('./', '')}`;
        const spritesheet = await PIXI.Assets.load(fullPath);
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
        this.container.addChild(container);
        return container;
    }

    update(delta: number): void {
        for (const enemy of this.enemies) { enemy.update(delta); }
        for (const npc of this.npcs) { npc.update(delta); }

        const children = this.container.children as (PIXI.Container & { sortY?: number })[];
        if (children.length > 1) {
            const start = this.backgroundTile ? 1 : 0;
            for (let i = start + 1; i < children.length; i++) {
                const child = children[i]!;
                const yVal = child.sortY ?? child.y;
                let j = i - 1;
                while (j >= start && ((children[j]!.sortY ?? children[j]!.y) > yVal)) {
                    children[j + 1] = children[j]!;
                    j--;
                }
                children[j + 1] = child;
            }
            (this.container as PIXI.Container).sortDirty = true;
        }
    }
}

export { Area };
export type { AreaOptions, PlaceStaticSpriteOptions };
