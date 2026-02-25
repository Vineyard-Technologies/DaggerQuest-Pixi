import * as PIXI from 'pixi.js';
import { Area, SHADOW_BLUR } from './area';
import { polyToWorld, NormPoint, WorldPoint } from './collision';
import { isDefined } from './types';

/** Animation textures: { animName: { direction: Texture[] } } */
export type AnimationTextures = Record<string, Record<number, PIXI.Texture[]>>;

interface EntityOptions {
    x: number;
    y: number;
    spriteKey?: string | null;
    directions?: number;
    direction?: number;
    animFps?: Record<string, number>;
}

class Entity {
    x: number;
    y: number;
    readonly spriteKey: string | null;
    direction: number;
    readonly animFps: Record<string, number>;
    readonly directions: number;
    readonly angles: readonly number[];
    textures: AnimationTextures;
    container: PIXI.Container & { sortY?: number };
    sprite: PIXI.AnimatedSprite | null;
    shadowSprite: PIXI.AnimatedSprite | null = null;
    shadowTextures: AnimationTextures | null = null;
    private _collisionPolyNorm: NormPoint[] | null;
    _textureMap: Map<PIXI.Texture[], { animName: string; direction: number }> | null = null;
    private _lastSpriteTextures: PIXI.Texture[] | null = null;
    private _shadowTickerFn: (() => void) | null = null;

    constructor({ x, y, spriteKey = null, directions = 16, direction = 0, animFps = {} }: EntityOptions) {
        this.x = x;
        this.y = y;
        this.spriteKey = spriteKey;
        this.direction = direction;
        this.animFps = animFps;
        this.directions = directions;
        this.angles = Array.from({ length: directions }, (_, i) => {
            const step = 360 / directions;
            const angle = i * step;
            return angle > 180 ? angle - 360 : angle;
        }).sort((a, b) => a - b);
        this.textures = {};
        this.container = new PIXI.Container() as PIXI.Container & { sortY?: number };
        this.container.x = x;
        this.container.y = y;
        this.sprite = null;
        this._collisionPolyNorm = null;
    }

    async loadTextures(): Promise<void> {
        if (!this.spriteKey) {
            console.warn('Entity has no spriteKey – skipping texture load');
            return;
        }

        const animationTextures: AnimationTextures = {};
        const manifest = await Area.fetchManifest();
        const sheets = manifest[this.spriteKey] || [];

        if (sheets.length === 0) {
            console.error(`No ${this.spriteKey} spritesheets found in manifest!`);
            return;
        }

        const spritesheets: PIXI.Spritesheet[] = [];
        for (const sheetPath of sheets) {
            const fullPath = `./images/spritesheets/${sheetPath.replace('./', '')}`;
            const spritesheet = await PIXI.Assets.load(fullPath);
            spritesheets.push(spritesheet);
        }

        const keyPattern = new RegExp(`${this.spriteKey}-(\\w+)_([\\-\\d.]+)-(\\d+)`);
        for (const spritesheet of spritesheets) {
            for (const frameName in spritesheet.textures) {
                const match = frameName.match(keyPattern);
                if (match) {
                    const animName = match[1]!;
                    const direction = parseFloat(match[2]!);
                    const frameNum = parseInt(match[3]!);
                    if (!animationTextures[animName]) animationTextures[animName] = {};
                    if (!animationTextures[animName]![direction]) animationTextures[animName]![direction] = [];
                    animationTextures[animName]![direction]![frameNum] = spritesheet.textures[frameName]!;
                }
            }
        }

        for (const animName in animationTextures) {
            for (const direction in animationTextures[animName]) {
                animationTextures[animName]![Number(direction)] =
                    animationTextures[animName]![Number(direction)]!.filter(isDefined);
            }
        }

        this.textures = animationTextures;

        this._textureMap = new Map();
        for (const animName in this.textures) {
            for (const direction in this.textures[animName]) {
                const frames = this.textures[animName]![Number(direction)];
                if (frames) this._textureMap.set(frames, { animName, direction: parseFloat(direction) });
            }
        }

        const shadowKey = `${this.spriteKey}_shadow`;
        const shadowSheets = manifest[shadowKey] || [];

        if (shadowSheets.length > 0) {
            const shadowAnimationTextures: AnimationTextures = {};
            const shadowKeyPattern = new RegExp(`${shadowKey}-(\\w+)_([\\-\\d.]+)-(\\d+)`);

            for (const sheetPath of shadowSheets) {
                const fullPath = `./images/spritesheets/${sheetPath.replace('./', '')}`;
                const spritesheet = await PIXI.Assets.load(fullPath);
                for (const frameName in spritesheet.textures) {
                    const match = frameName.match(shadowKeyPattern);
                    if (match) {
                        const animName = match[1]!;
                        const direction = parseFloat(match[2]!);
                        const frameNum = parseInt(match[3]!);
                        if (!shadowAnimationTextures[animName]) shadowAnimationTextures[animName] = {};
                        if (!shadowAnimationTextures[animName]![direction]) shadowAnimationTextures[animName]![direction] = [];
                        shadowAnimationTextures[animName]![direction]![frameNum] = spritesheet.textures[frameName]!;
                    }
                }
            }

            for (const animName in shadowAnimationTextures) {
                for (const direction in shadowAnimationTextures[animName]) {
                    shadowAnimationTextures[animName]![Number(direction)] =
                        shadowAnimationTextures[animName]![Number(direction)]!.filter(isDefined);
                }
            }

            this.shadowTextures = shadowAnimationTextures;
        }

        this.initSprite();
    }

    initSprite(): void {
        const firstAnim = Object.keys(this.textures)[0];
        if (!firstAnim) return;

        const animData = this.textures[firstAnim];
        if (!animData) return;
        const firstDirection = Object.keys(animData)[0];
        if (!firstDirection) return;
        const frames = animData[Number(firstDirection)] ?? [];

        if (frames.length > 0) {
            if (this.shadowTextures) {
                const shadowFrames = this.getShadowFrames(firstAnim, parseFloat(firstDirection));
                if (shadowFrames.length > 0) {
                    this.shadowSprite = new PIXI.AnimatedSprite({ textures: shadowFrames, updateAnchor: true });
                    this.shadowSprite.x = 0;
                    this.shadowSprite.y = 0;
                    this.shadowSprite.alpha = 0.5;
                    this.shadowSprite.filters = [SHADOW_BLUR];
                    this.container.addChild(this.shadowSprite);
                }
            }

            this.sprite = new PIXI.AnimatedSprite({ textures: frames, updateAnchor: true });
            this.sprite.x = 0;
            this.sprite.y = 0;
            this.sprite.animationSpeed = this.getAnimFps(firstAnim) / 60;
            this.container.addChild(this.sprite);
            this.direction = parseFloat(firstDirection);

            if (this.shadowSprite) {
                this._lastSpriteTextures = this.sprite.textures as PIXI.Texture[];
                this._shadowTickerFn = () => this._syncShadow();
                PIXI.Ticker.shared.add(this._shadowTickerFn);
            }
        }
    }

    getShadowFrames(animName: string, direction: number): PIXI.Texture[] {
        const anim = this.shadowTextures?.[animName];
        if (!anim) return [];
        let frames = anim[direction];
        if (frames && frames.length > 0) return frames;
        const fallbackDir = Object.keys(anim)[0];
        return (fallbackDir && anim[Number(fallbackDir)]) || [];
    }

    private _syncShadow(): void {
        if (!this.shadowSprite || !this.sprite) return;
        if (this.sprite.textures !== this._lastSpriteTextures) {
            this._lastSpriteTextures = this.sprite.textures as PIXI.Texture[];
            const info = this._textureMap?.get(this.sprite.textures as PIXI.Texture[]);
            if (info) {
                const shadowFrames = this.getShadowFrames(info.animName, info.direction);
                if (shadowFrames.length > 0) {
                    this.shadowSprite.textures = shadowFrames;
                }
            }
        }
        const frame = Math.min(this.sprite.currentFrame, this.shadowSprite.totalFrames - 1);
        if (this.shadowSprite.currentFrame !== frame) {
            this.shadowSprite.gotoAndStop(frame);
        }
    }

    destroy(): void {
        if (this._shadowTickerFn) {
            PIXI.Ticker.shared.remove(this._shadowTickerFn);
            this._shadowTickerFn = null;
        }
        if (this.container.parent) {
            this.container.parent.removeChild(this.container);
        }
    }

    getAnimFps(animName: string): number {
        return this.animFps[animName] ?? 30;
    }

    setCollisionPoly(normPoly: NormPoint[]): void {
        this._collisionPolyNorm = normPoly;
    }

    getWorldCollisionPoly(): WorldPoint[] | null {
        if (!this._collisionPolyNorm) return null;
        if (!this.sprite) return null;
        const texture = this.sprite.texture;
        if (!texture) return null;
        const w = texture.width;
        const h = texture.height;
        const ax = this.sprite.anchor?.x ?? 0;
        const ay = this.sprite.anchor?.y ?? 0;
        return polyToWorld(this._collisionPolyNorm, this.x, this.y, w, h, ax, ay);
    }

    getAnimationFrames(animName: string, direction: number): PIXI.Texture[] {
        const anim = this.textures[animName];
        if (!anim) return [];
        let frames = anim[direction];
        if (frames && frames.length > 0) return frames;
        const fallbackDir = Object.keys(anim)[0];
        return (fallbackDir && anim[Number(fallbackDir)]) || [];
    }

    findClosestDirection(angle: number): number {
        let normalized = angle;
        while (normalized > 180) normalized -= 360;
        while (normalized < -180) normalized += 360;
        let closest = this.angles[0] ?? 0;
        let minDiff = Infinity;
        for (const dir of this.angles) {
            let diff = Math.abs(normalized - dir);
            if (diff > 180) diff = 360 - diff;
            if (diff < minDiff) { minDiff = diff; closest = dir; }
        }
        return closest;
    }
}

export { Entity };
