import * as PIXI from 'pixi.js';
import { fetchManifest, assetPath } from './assets';
import { rollMods, aggregateModStats, formatMod } from './mods';
import { Loot } from './loot';
import { Gear } from './gear';
import type { RolledMod } from './mods';
import { rollRarity, Rarity } from './types';
import type { GearSlot } from './types';

interface ItemOptions {
    id: string;
    name: string;
    description?: string;
    slot: GearSlot;
    baseStats?: Record<string, number>;
    stats?: Record<string, number>;
    allowedClasses?: readonly string[];
    modTables?: readonly string[];
        level?: number;
}

class Item {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly slot: GearSlot;
    readonly baseStats: Readonly<Record<string, number>>;
    readonly mods: readonly RolledMod[];
    /** Player class spriteKeys allowed to equip this item (empty = all). */
    readonly allowedClasses: readonly string[];
    /** Mod-type tags this item can roll on (empty = full pool). */
    readonly modTables: readonly string[];
    readonly rarity: Rarity;
    /** Minimum player level required to use this item. */
    readonly level: number;
    private _iconTexture: PIXI.Texture | null;
    private _iconAssetPaths: string[];

    constructor({ id, name, description = '', slot, baseStats = {}, stats = {}, allowedClasses = [], modTables = [], level = 1 }: ItemOptions) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.slot = slot;
        this.allowedClasses = allowedClasses;
        this.modTables = modTables;
        this.level = level;
        this.baseStats = Object.keys(baseStats).length > 0 ? baseStats : stats;
        this.rarity = rollRarity();
        this.mods = rollMods({ count: this._modCountForRarity(), modTables: this.modTables });
        this._iconTexture = null;
        this._iconAssetPaths = [];
    }

    /** Mod count based on rarity: Common 0, Rare 1-2, Epic 3-4, Legendary 5-6. */
    private _modCountForRarity(): number {
        const high = Math.random() < 0.4;
        switch (this.rarity) {
            case Rarity.Common:    return 0;
            case Rarity.Rare:      return high ? 2 : 1;
            case Rarity.Epic:      return high ? 4 : 3;
            case Rarity.Legendary: return high ? 6 : 5;
        }
    }

    /** Whether the given player class spriteKey is allowed to equip this item. */
    canBeUsedBy(classSpriteKey: string): boolean {
        return this.allowedClasses.length === 0 || this.allowedClasses.includes(classSpriteKey);
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

        const manifest = await fetchManifest();
        const sheets = manifest[this.iconSpriteKey] || [];

        if (sheets.length === 0) {
            console.warn(`No icon spritesheets found for "${this.iconSpriteKey}"`);
            return null;
        }

        for (const sheetPath of sheets) {
            const fullPath = assetPath(`images/spritesheets/${sheetPath.replace('./', '')}`);
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
        // Defer asset unloads by two frames so WebGPU command buffers
        // referencing these textures have finished executing.
        const paths = [...this._iconAssetPaths];
        if (paths.length > 0) {
            await new Promise<void>(resolve => requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            }));
            for (const path of paths) {
                await PIXI.Assets.unload(path);
            }
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
}

export { Item };
