import * as PIXI from 'pixi.js';
import { SHADOW_BLUR, fetchManifest, assetPath } from './assets';
import { safeDestroy } from './safeDestroy';
import type { Character } from './character';
import type { AnimationTextures } from './entity';
import type { Item } from './item';
import { GearSlot, isDefined } from './types';

const GEAR_SLOT_Z_ORDER = {
    [GearSlot.Feet]:     0,
    [GearSlot.Legs]:     1,
    [GearSlot.Chest]:    2,
    [GearSlot.Neck]:     3,
    [GearSlot.Hands]:    4,
    [GearSlot.OffHand]:  5,
    [GearSlot.MainHand]: 6,
    [GearSlot.Head]:     7,
} as const satisfies Partial<Record<GearSlot, number>>;

interface GearOptions {
    item?: Item | null;
    slot?: GearSlot | null;
    spriteKeyBase?: string | null;
    isDefault?: boolean;
}

interface GearCharacter extends Character {
    equippedGear?: Record<string, Gear>;
}

// ── Shared gear syncer (single ticker for all equipped gear) ──────────────

const _equippedGear = new Set<Gear>();
let _syncerTickerFn: ((ticker: PIXI.Ticker) => void) | null = null;

function _ensureSyncerRunning(): void {
    if (_syncerTickerFn) return;
    _syncerTickerFn = () => { for (const g of _equippedGear) g.syncNow(); };
    PIXI.Ticker.shared.add(_syncerTickerFn);
}

function _registerGear(gear: Gear): void {
    _equippedGear.add(gear);
    _ensureSyncerRunning();
}

function _unregisterGear(gear: Gear): void {
    _equippedGear.delete(gear);
    if (_equippedGear.size === 0 && _syncerTickerFn) {
        PIXI.Ticker.shared.remove(_syncerTickerFn);
        _syncerTickerFn = null;
    }
}


class Gear {
    readonly item: Item | null;
    readonly slot: GearSlot | null;
    readonly isDefault: boolean;
    sprite: PIXI.AnimatedSprite | null;
    shadowSprite: PIXI.AnimatedSprite | null;

    private _spriteKeyBase: string | null;
    private _textures: AnimationTextures;
    private _shadowTextures: AnimationTextures;
    private _character: GearCharacter | null;
    private _spriteKey: string | null;
    private _assetPaths: string[];
    private _currentAnimName: string | null;
    private _currentDirection: number | null;

    constructor({ item = null, slot = null, spriteKeyBase = null, isDefault = false }: GearOptions = {}) {
        this.item = item;
        this.slot = slot || (item && item.slot) || null;
        this.isDefault = isDefault;
        this._spriteKeyBase = spriteKeyBase || (item && item.id) || null;
        this.sprite = null;
        this.shadowSprite = null;
        this._textures = {};
        this._shadowTextures = {};
        this._character = null;
        this._spriteKey = null;
        this._assetPaths = [];
        this._currentAnimName = null;
        this._currentDirection = null;
    }

    async equip(character: GearCharacter): Promise<void> {
        if (this._character) {
            await this.unequip();
        }
        this._character = character;
        this._spriteKey = `${character.spriteKey}_${this._spriteKeyBase}_gear`;

        const manifest = await fetchManifest();

        await this._loadSheetTextures(manifest, this._spriteKey, this._textures);

        const shadowKey = `${this._spriteKey}_shadow`;
        await this._loadSheetTextures(manifest, shadowKey, this._shadowTextures);

        this._createSprites();

        _registerGear(this);
    }

    async unequip(): Promise<void> {
        _unregisterGear(this);
        if (this.sprite) {
            safeDestroy(this.sprite);
            this.sprite = null;
        }
        if (this.shadowSprite) {
            safeDestroy(this.shadowSprite);
            this.shadowSprite = null;
        }
        // Defer asset unloads to next frame so WebGPU command buffers
        // referencing these textures have finished executing.
        const paths = [...this._assetPaths];
        if (paths.length > 0) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            for (const path of paths) {
                await PIXI.Assets.unload(path);
            }
        }
        this._textures = {};
        this._shadowTextures = {};
        this._assetPaths = [];
        this._character = null;
        this._spriteKey = null;
        this._currentAnimName = null;
        this._currentDirection = null;
    }

    private async _loadSheetTextures(
        manifest: Record<string, string[]>,
        key: string,
        targetObj: AnimationTextures,
    ): Promise<void> {
        const sheets = manifest[key] || [];
        if (sheets.length === 0) return;

        const pattern = new RegExp(`${key}-(\\w+)_([\\-\\d.]+)-(\\d+)`);

        for (const sheetPath of sheets) {
            const fullPath = assetPath(`images/spritesheets/${sheetPath.replace('./', '')}`);
            this._assetPaths.push(fullPath);
            const spritesheet: PIXI.Spritesheet = await PIXI.Assets.load(fullPath);

            for (const frameName in spritesheet.textures) {
                const match = frameName.match(pattern);
                if (!match) continue;

                const animName = match[1]!;
                const direction = parseFloat(match[2]!);
                const frameNum = parseInt(match[3]!);

                if (!targetObj[animName]) targetObj[animName] = {};
                if (!targetObj[animName]![direction]) targetObj[animName]![direction] = [];
                targetObj[animName]![direction]![frameNum] = spritesheet.textures[frameName]!;
            }
        }

        for (const anim in targetObj) {
            for (const dir in targetObj[anim]) {
                targetObj[anim]![Number(dir)] = targetObj[anim]![Number(dir)]!.filter(isDefined);
            }
        }
    }

    private _createSprites(): void {
        if (!this._character?.sprite) return;

        const info = this._character._textureMap?.get(this._character.sprite.textures as PIXI.Texture[]);
        const animName = (info as { animName?: string } | undefined)?.animName || Object.keys(this._textures)[0];
        if (!animName || !this._textures[animName]) return;

        const direction = (info as { direction?: number } | undefined)?.direction ?? parseFloat(Object.keys(this._textures[animName]!)[0] ?? '0');

        const insertIdx = this._getInsertIndex();

        if (Object.keys(this._shadowTextures).length > 0) {
            const shadowFrames = this._getFrames(this._shadowTextures, animName, direction);
            if (shadowFrames.length > 0) {
                this.shadowSprite = new PIXI.AnimatedSprite({
                    textures: shadowFrames,
                    updateAnchor: true,
                });
                this.shadowSprite.alpha = 0.5;
                this.shadowSprite.filters = [SHADOW_BLUR];
                this._character.container.addChildAt(this.shadowSprite, insertIdx);
                this.shadowSprite.gotoAndStop(0);
            }
        }

        const frames = this._getFrames(this._textures, animName, direction);
        if (frames.length === 0) return;

        this.sprite = new PIXI.AnimatedSprite({
            textures: frames,
            updateAnchor: true,
        });

        const mainIdx = this.shadowSprite
            ? this._character.container.getChildIndex(this.shadowSprite) + 1
            : insertIdx;
        this._character.container.addChildAt(this.sprite, mainIdx);
        this.sprite.gotoAndStop(0);
    }

    private _getInsertIndex(): number {
        const container = this._character!.container;
        const myZ = GEAR_SLOT_Z_ORDER[this.slot as keyof typeof GEAR_SLOT_Z_ORDER] ?? 0;

        const charIdx = container.getChildIndex(this._character!.sprite!);
        let idx = charIdx + 1;

        const equippedGear = this._character!.equippedGear || {};
        const gearBySprite = new Map<PIXI.Container, Gear>();
        for (const g of Object.values(equippedGear)) {
            if (g.sprite) gearBySprite.set(g.sprite, g);
            if (g.shadowSprite) gearBySprite.set(g.shadowSprite, g);
        }

        for (let i = charIdx + 1; i < container.children.length; i++) {
            const child = container.children[i];
            const ownerGear = gearBySprite.get(child as PIXI.Container);
            if (!ownerGear) {
                idx = i + 1;
                continue;
            }
            const otherZ = GEAR_SLOT_Z_ORDER[ownerGear.slot as keyof typeof GEAR_SLOT_Z_ORDER] ?? 0;
            if (otherZ >= myZ) {
                return i;
            }
            idx = i + 1;
        }

        return idx;
    }

    syncNow(): void {
        this._sync();
    }

    private _sync(): void {
        if (!this._character?.sprite || !this.sprite) return;

        const info = this._character._textureMap?.get(this._character.sprite.textures as PIXI.Texture[]);
        if (info) {
            const { animName, direction } = info as { animName: string; direction: number };

            if (animName !== this._currentAnimName || direction !== this._currentDirection) {
                this._currentAnimName = animName;
                this._currentDirection = direction;

                const frames = this._getFrames(this._textures, animName, direction);
                if (frames.length > 0) {
                    this.sprite.textures = frames;
                }

                if (this.shadowSprite) {
                    const shadowFrames = this._getFrames(this._shadowTextures, animName, direction);
                    if (shadowFrames.length > 0) {
                        this.shadowSprite.textures = shadowFrames;
                    }
                }
            }
        }

        const charFrame = this._character.sprite.currentFrame;

        const gearFrame = Math.min(charFrame, this.sprite.totalFrames - 1);
        if (this.sprite.currentFrame !== gearFrame) {
            this.sprite.gotoAndStop(gearFrame);
        }

        if (this.shadowSprite) {
            const shadowFrame = Math.min(charFrame, this.shadowSprite.totalFrames - 1);
            if (this.shadowSprite.currentFrame !== shadowFrame) {
                this.shadowSprite.gotoAndStop(shadowFrame);
            }
        }
    }

    private _getFrames(textureSet: AnimationTextures, animName: string, direction: number): PIXI.Texture[] {
        const anim = textureSet[animName];
        if (!anim) return [];

        const frames = anim[direction];
        if (frames && frames.length > 0) return frames;

        const fallbackDir = Object.keys(anim)[0];
        return (fallbackDir && anim[parseFloat(fallbackDir)]) || [];
    }
}

export { GEAR_SLOT_Z_ORDER, Gear };
