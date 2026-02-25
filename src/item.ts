import * as PIXI from 'pixi.js';
import { Area } from './area';
import { rollMods, aggregateModStats, formatMod } from './mods';
import { Loot } from './loot';
import { Gear } from './gear';
import type { RolledMod } from './mods';
import type { GearSlot } from './types';

interface ItemOptions {
    id: string;
    name: string;
    description?: string;
    slot: GearSlot;
    baseStats?: Record<string, number>;
    stats?: Record<string, number>;
    mods?: RolledMod[];
}

class Item {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly slot: GearSlot;
    readonly baseStats: Readonly<Record<string, number>>;
    readonly mods: readonly RolledMod[];
    private _iconTexture: PIXI.Texture | null;
    private _iconAssetPaths: string[];

    constructor({ id, name, description = '', slot, baseStats = {}, stats = {}, mods = undefined }: ItemOptions) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.slot = slot;
        this.baseStats = Object.keys(baseStats).length > 0 ? baseStats : stats;
        this.mods = mods !== undefined ? mods : rollMods();
        this._iconTexture = null;
        this._iconAssetPaths = [];
    }

    get stats(): Record<string, number> {
        const modStats = aggregateModStats(this.mods);
        const merged: Record<string, number> = { ...this.baseStats };
        for (const [key, val] of Object.entries(modStats)) {
            merged[key] = (merged[key] || 0) + val;
        }
        return merged;
    }

    get modDescriptions(): string[] {
        return this.mods.map(m => formatMod(m));
    }

    get modCount(): number {
        return this.mods.length;
    }

    get iconSpriteKey(): string {
        return `${this.id}_item`;
    }

    get lootSpriteKey(): string {
        return `${this.id}_loot`;
    }

    gearSpriteKey(characterSpriteKey: string): string {
        return `${characterSpriteKey}_${this.id}_gear`;
    }

    async loadIcon(): Promise<PIXI.Texture | null> {
        if (this._iconTexture) return this._iconTexture;

        const manifest = await Item.fetchManifest();
        const sheets = manifest[this.iconSpriteKey] || [];

        if (sheets.length === 0) {
            console.warn(`No icon spritesheets found for "${this.iconSpriteKey}"`);
            return null;
        }

        for (const sheetPath of sheets) {
            const fullPath = `./images/spritesheets/${sheetPath.replace('./', '')}`;
            this._iconAssetPaths.push(fullPath);
            const spritesheet: PIXI.Spritesheet = await PIXI.Assets.load(fullPath);

            if (!this._iconTexture) {
                const names = Object.keys(spritesheet.textures);
                if (names.length > 0) {
                    this._iconTexture = spritesheet.textures[names[0]!]!;
                }
            }
        }

        return this._iconTexture;
    }

    createIcon(): PIXI.Sprite | null {
        if (!this._iconTexture) {
            console.warn(`Icon not loaded for "${this.id}". Call loadIcon() first.`);
            return null;
        }
        return new PIXI.Sprite(this._iconTexture);
    }

    async unloadIcon(): Promise<void> {
        for (const path of this._iconAssetPaths) {
            await PIXI.Assets.unload(path);
        }
        this._iconTexture = null;
        this._iconAssetPaths = [];
    }

    createLoot(x: number, y: number): Loot {
        return new Loot({ item: this, x, y });
    }

    createGear(): Gear {
        return new Gear({ item: this });
    }

    static async fetchManifest(): Promise<Record<string, string[]>> {
        return Area.fetchManifest();
    }
}

export { Item };
