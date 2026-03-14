import * as PIXI from 'pixi.js';
import { fetchManifest, assetPath, trackSpritesheet } from './assets';
import { safeDestroy } from './safeDestroy';
import state from './state';
import {
    SLOT_SIZE, SLOT_ICON_MAX, SLOT_BORDER,
    ABILITY_SLOT_SIZE, ABILITY_SLOT_BORDER,
    HUD_MARGIN, ORB_RADIUS,
    TOOLTIP_NAME_FONT_SIZE, TOOLTIP_STAT_FONT_SIZE, TOOLTIP_DESC_FONT_SIZE,
    TOOLTIP_INNER_WIDTH, TOOLTIP_PADDING,
} from './config';
import { GearSlot, UISource, RARITY_COLORS } from './types';
import type { Item } from './item';
import type { Character } from './character';
import type { Player } from './player';
import { ABILITY_KEYS, PRAYER_KEYS, SLOT_UNLOCK_LEVELS, type PlayerAbility, type Prayer } from './ability';

// ── Slot entry interfaces ──────────────────────────────────────────────────

interface EquippedSlotEntry {
    container: PIXI.Container;
    placeholder: PIXI.Sprite | null;
    slotType: GearSlot;
    iconSprite: PIXI.Sprite | null;
    item: Item | null;
    bgSprite: PIXI.NineSliceSprite | null;
    borderMask: PIXI.Graphics | null;
}

interface InventorySlotEntry {
    container: PIXI.Container;
    placeholder: null;
    iconSprite: PIXI.Sprite | null;
    item: Item | null;
    bgSprite: PIXI.NineSliceSprite | null;
    borderMask: PIXI.Graphics | null;
}

interface AbilitySlotEntry {
    container: PIXI.Container;
    row: number;
    col: number;
    key: string;
    iconSprite: PIXI.Sprite | null;
    cooldownOverlay: PIXI.Graphics | null;
    activeGlow: PIXI.Graphics | null;
}

interface DragState {
    source: UISource;
    key: string | number;
    entry: EquippedSlotEntry | InventorySlotEntry;
    sprite: PIXI.Sprite;
    item: Item;
}

type HitTestResult =
    | { type: UISource.Equipped; entry: EquippedSlotEntry }
    | { type: UISource.Inventory; entry: InventorySlotEntry; index: number };

interface OrbBuildOptions {
    coverBackTex: PIXI.Texture | null;
    coverFrontTex: PIXI.Texture | null;
    orbTex: PIXI.Texture | null;
    coverTex: PIXI.Texture | null;
    tint: number;
}

interface EquippedPlaceholderDef {
    readonly col: number;
    readonly row: number;
    readonly tex: PIXI.Texture | null;
    readonly type: GearSlot;
}

/** Extended sprite with orb fill metadata attached at runtime. */
interface OrbSprite extends PIXI.Sprite {
    _orbFillW?: number;
    _orbFillH?: number;
    _orbMask?: PIXI.Graphics;
    _orbLastPct?: number;
}

/** Shared texture loader signature used across UI sub-components. */
type TextureLoader = (key: string) => Promise<PIXI.Texture | null>;

// ── OrbHUD ─────────────────────────────────────────────────────────────────

/** Health / mana orb rendering & fill-masking. */
class OrbHUD {
    readonly healthContainer: PIXI.Container;
    readonly manaContainer: PIXI.Container;

    private _healthOrbSprite: OrbSprite | null = null;
    private _manaOrbSprite: OrbSprite | null = null;
    private _orbHeight = 0;

    constructor() {
        this.healthContainer = new PIXI.Container();
        this.healthContainer.label = 'healthOrb';
        this.manaContainer = new PIXI.Container();
        this.manaContainer.label = 'manaOrb';
    }

    async load(loadTexture: TextureLoader): Promise<void> {
        const [
            orbcoverbackTex,
            orbcoverfrontTex,
            healthorbTex,
            manaorbTex,
            healthcoverTex,
            manacoverTex,
        ] = await Promise.all([
            loadTexture('orbcoverback'),
            loadTexture('orbcoverfront'),
            loadTexture('healthorb'),
            loadTexture('manaorb'),
            loadTexture('healthcover'),
            loadTexture('manacover'),
        ]);

        this._buildOrb(this.healthContainer, {
            coverBackTex: orbcoverbackTex,
            coverFrontTex: orbcoverfrontTex,
            orbTex: healthorbTex,
            coverTex: healthcoverTex,
            tint: 0xff4444,
        });

        this._buildOrb(this.manaContainer, {
            coverBackTex: orbcoverbackTex,
            coverFrontTex: orbcoverfrontTex,
            orbTex: manaorbTex,
            coverTex: manacoverTex,
            tint: 0x4488ff,
        });

        if (healthorbTex) this._orbHeight = healthorbTex.height;
    }

    update(character: Character): void {
        if (!character) return;
        const healthPct = Math.max(0, Math.min(1, character.currentHealth / character.maxHealth));
        const manaPct = Math.max(0, Math.min(1, character.currentMana / character.maxMana));
        this._setOrbFill(this._healthOrbSprite, healthPct);
        this._setOrbFill(this._manaOrbSprite, manaPct);
    }

    layout(screenW: number, screenH: number): void {
        this.healthContainer.x = HUD_MARGIN + ORB_RADIUS;
        this.healthContainer.y = screenH - HUD_MARGIN - ORB_RADIUS + 5;
        this.manaContainer.x = screenW - HUD_MARGIN - ORB_RADIUS;
        this.manaContainer.y = screenH - HUD_MARGIN - ORB_RADIUS + 5;
    }

    private _buildOrb(container: PIXI.Container, { coverBackTex, coverFrontTex, orbTex, coverTex, tint }: OrbBuildOptions): void {
        if (coverBackTex) {
            const back = new PIXI.Sprite(coverBackTex);
            back.anchor.set(0.5);
            back.label = 'coverBack';
            container.addChild(back);
        }

        if (orbTex) {
            const orb = new PIXI.Sprite(orbTex) as OrbSprite;
            orb.anchor.set(0.5);
            orb.label = 'orbFill';
            if (tint != null) orb.tint = tint;
            container.addChild(orb);

            if (container === this.healthContainer) {
                this._healthOrbSprite = orb;
            } else {
                this._manaOrbSprite = orb;
            }
        }

        if (coverFrontTex) {
            const front = new PIXI.Sprite(coverFrontTex);
            front.anchor.set(0.5);
            front.label = 'coverFront';
            container.addChild(front);
        }

        if (coverTex) {
            const cover = new PIXI.Sprite(coverTex);
            cover.anchor.set(0.5);
            cover.label = 'cover';
            container.addChild(cover);
        }
    }

    private _setOrbFill(orbSprite: OrbSprite | null, pct: number): void {
        if (!orbSprite) return;

        if (orbSprite._orbFillH === undefined) {
            const tex = orbSprite.texture;
            orbSprite._orbFillW = tex.source.width;
            orbSprite._orbFillH = tex.source.height;

            const mask = new PIXI.Graphics();
            mask.label = 'orbMask';
            orbSprite.parent!.addChild(mask);
            orbSprite.mask = mask;
            orbSprite._orbMask = mask;
            orbSprite._orbLastPct = -1;
        }

        const clamped = Math.max(0, Math.min(1, pct));
        if (clamped === orbSprite._orbLastPct) return;
        orbSprite._orbLastPct = clamped;

        const fullW = orbSprite._orbFillW!;
        const fullH = orbSprite._orbFillH!;
        const mask = orbSprite._orbMask!;

        orbSprite.anchor.set(0.5, 0.5);
        orbSprite.y = 0;

        mask.clear();
        if (clamped > 0) {
            const visibleH = Math.round(fullH * clamped);
            const yOffset = fullH - visibleH;
            mask.rect(
                orbSprite.x - fullW / 2,
                orbSprite.y - fullH / 2 + yOffset,
                fullW,
                visibleH,
            );
            mask.fill({ color: 0xffffff });
        }
        orbSprite.visible = clamped > 0;
    }
}

// ── EquipmentPanel ─────────────────────────────────────────────────────────

/** Equipped-gear slot grid (left-side slide-out). */
class EquipmentPanel {
    readonly container: PIXI.Container;
    readonly slots: EquippedSlotEntry[] = [];

    private _menuOpen = false;
    private _menuSlide = 0;
    private _menuWidth = 0;

    constructor() {
        this.container = new PIXI.Container();
        this.container.label = 'equippedMenu';
    }

    async load(
        loadTexture: TextureLoader,
        onRightClick: (slotType: GearSlot) => void,
        onDragStart: (source: UISource, key: string | number, e: PIXI.FederatedPointerEvent) => void,
    ): Promise<void> {
        const [
            charactermenuTex,
            headplaceholderTex,
            chestplaceholderTex,
            handsplaceholderTex,
            legsplaceholderTex,
            feetplaceholderTex,
            mainhandplaceholderTex,
            offhandplaceholderTex,
            neckplaceholderTex,
            ringplaceholderTex,
        ] = await Promise.all([
            loadTexture('charactermenu'),
            loadTexture('headplaceholder'),
            loadTexture('chestplaceholder'),
            loadTexture('handsplaceholder'),
            loadTexture('legsplaceholder'),
            loadTexture('feetplaceholder'),
            loadTexture('mainhandplaceholder'),
            loadTexture('offhandplaceholder'),
            loadTexture('neckplaceholder'),
            loadTexture('ringplaceholder'),
        ]);

        if (charactermenuTex) (charactermenuTex as { defaultAnchor: { x: number; y: number } }).defaultAnchor = { x: 0, y: 0 };

        const placeholders: EquippedPlaceholderDef[] = [
            { col: 0, row: 0, tex: headplaceholderTex,     type: GearSlot.Head },
            { col: 0, row: 1, tex: chestplaceholderTex,    type: GearSlot.Chest },
            { col: 0, row: 2, tex: handsplaceholderTex,    type: GearSlot.Hands },
            { col: 0, row: 3, tex: legsplaceholderTex,     type: GearSlot.Legs },
            { col: 0, row: 4, tex: feetplaceholderTex,     type: GearSlot.Feet },
            { col: 1, row: 0, tex: mainhandplaceholderTex, type: GearSlot.MainHand },
            { col: 1, row: 1, tex: offhandplaceholderTex,  type: GearSlot.OffHand },
            { col: 1, row: 2, tex: neckplaceholderTex,     type: GearSlot.Neck },
            { col: 1, row: 3, tex: ringplaceholderTex,     type: GearSlot.Ring },
            { col: 1, row: 4, tex: ringplaceholderTex,     type: GearSlot.Ring2 },
        ];

        this._buildMenu(charactermenuTex, placeholders, onRightClick, onDragStart);
    }

    toggle(): void {
        this._menuOpen = !this._menuOpen;
    }

    update(deltaMs: number): void {
        const slideSpeed = 8;
        const dt = deltaMs / 1000;
        const target = this._menuOpen ? 1 : 0;
        this._menuSlide += (target - this._menuSlide) * Math.min(1, slideSpeed * dt);
        if (Math.abs(this._menuSlide - target) < 0.001) this._menuSlide = target;
    }

    layout(_screenW: number, _screenH: number): void {
        const eqOffX = -this._menuWidth * (1 - this._menuSlide);
        this.container.x = eqOffX;
        this.container.y = 0;
    }

    async setItem(slot: GearSlot, item: Item): Promise<void> {
        const entry = this.slots.find(s => s.slotType === slot);
        if (!entry) {
            console.warn(`EquipmentPanel.setItem: no slot found for "${slot}"`);
            return;
        }

        if (entry.iconSprite) {
            safeDestroy(entry.iconSprite);
            entry.iconSprite = null;
        }

        if (entry.item) {
            await entry.item.unloadIcon();
        }

        await item.loadIcon();
        const icon = item.createIcon();
        if (!icon) {
            console.warn(`EquipmentPanel.setItem: could not create icon for "${item.id}"`);
            return;
        }

        const slotSize = SLOT_SIZE;
        const maxIconSize = SLOT_ICON_MAX;
        const scale = Math.min(maxIconSize / icon.texture.width, maxIconSize / icon.texture.height);
        icon.anchor.set(0.5);
        icon.scale.set(scale);
        icon.x = slotSize / 2;
        icon.y = slotSize / 2;

        entry.container.addChild(icon);
        entry.iconSprite = icon;
        entry.item = item;

        if (entry.bgSprite) entry.bgSprite.mask = null;

        if (entry.placeholder) {
            entry.placeholder.visible = false;
        }
    }

    async clearItem(slot: GearSlot): Promise<void> {
        const entry = this.slots.find(s => s.slotType === slot);
        if (!entry) return;

        if (entry.iconSprite) {
            safeDestroy(entry.iconSprite);
            entry.iconSprite = null;
        }

        if (entry.item) {
            await entry.item.unloadIcon();
            entry.item = null;
        }

        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;

        if (entry.placeholder) {
            entry.placeholder.visible = true;
        }
    }

    detachIcon(entry: EquippedSlotEntry): void {
        if (entry.iconSprite) {
            safeDestroy(entry.iconSprite);
            entry.iconSprite = null;
        }
        entry.item = null;
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
        if (entry.placeholder) entry.placeholder.visible = true;
    }

    detachIconKeepData(entry: EquippedSlotEntry): void {
        if (entry.iconSprite) {
            safeDestroy(entry.iconSprite);
            entry.iconSprite = null;
        }
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
    }

    private _buildMenu(
        slotTex: PIXI.Texture | null,
        placeholders: EquippedPlaceholderDef[],
        onRightClick: (slotType: GearSlot) => void,
        onDragStart: (source: UISource, key: string | number, e: PIXI.FederatedPointerEvent) => void,
    ): void {
        const slotSize = SLOT_SIZE;
        const gap = 0;
        const cols = 2;
        const margin = 0;

        const slotsContainer = new PIXI.Container();
        slotsContainer.label = 'equippedSlots';
        slotsContainer.x = margin;
        slotsContainer.y = margin;

        for (const ph of placeholders) {
            const slotContainer = new PIXI.Container();
            slotContainer.label = `slot_${ph.type}`;
            slotContainer.x = ph.col * (slotSize + gap);
            slotContainer.y = ph.row * (slotSize + gap);

            let bgSprite: PIXI.NineSliceSprite | null = null;
            let borderMask: PIXI.Graphics | null = null;
            if (slotTex) {
                const bg = new PIXI.NineSliceSprite({
                    texture: slotTex,
                    leftWidth: SLOT_BORDER,
                    rightWidth: SLOT_BORDER,
                    topHeight: SLOT_BORDER,
                    bottomHeight: SLOT_BORDER,
                });
                bg.width = slotSize;
                bg.height = slotSize;
                bg.tint = 0x4757FF;
                bgSprite = bg;

                borderMask = new PIXI.Graphics();
                borderMask.rect(0, 0, slotSize, slotSize);
                borderMask.fill({ color: 0xffffff });
                borderMask.rect(SLOT_BORDER, SLOT_BORDER, slotSize - SLOT_BORDER * 2, slotSize - SLOT_BORDER * 2);
                borderMask.cut();
                slotContainer.addChild(borderMask);
                bg.mask = borderMask;

                slotContainer.addChild(bg);
            }

            let placeholderSprite: PIXI.Sprite | null = null;
            if (ph.tex) {
                placeholderSprite = new PIXI.Sprite(ph.tex);
                const phScale = Math.min(SLOT_ICON_MAX / ph.tex.width, SLOT_ICON_MAX / ph.tex.height);
                placeholderSprite.scale.set(phScale);
                if (ph.type === 'offhand') {
                    placeholderSprite.anchor.set(0, 0);
                    placeholderSprite.x = SLOT_BORDER;
                    placeholderSprite.y = SLOT_BORDER;
                } else {
                    placeholderSprite.anchor.set(0.5);
                    placeholderSprite.x = slotSize / 2;
                    placeholderSprite.y = slotSize / 2;
                }
                if (ph.type === 'ring2') {
                    placeholderSprite.scale.x *= -1;
                }
                const opaqueFilter = new PIXI.ColorMatrixFilter();
                opaqueFilter.matrix = [
                    1, 0, 0, 0, 0,
                    0, 1, 0, 0, 0,
                    0, 0, 1, 0, 0,
                    0, 0, 0, 3, 0,
                ];
                placeholderSprite.filters = [opaqueFilter];
                slotContainer.addChild(placeholderSprite);
            }

            slotContainer.eventMode = 'static';
            slotContainer.cursor = 'pointer';
            const slotType = ph.type;
            slotContainer.on('rightclick', () => onRightClick(slotType));
            slotContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                if (e.button === 0) onDragStart(UISource.Equipped, slotType, e);
            });

            slotsContainer.addChild(slotContainer);
            this.slots.push({ container: slotContainer, placeholder: placeholderSprite, slotType: ph.type, iconSprite: null, item: null, bgSprite, borderMask });
        }

        this.container.addChild(slotsContainer);

        const gridWidth = cols * (slotSize + gap) - gap;
        this._menuWidth = margin + gridWidth + margin;
    }
}

// ── InventoryPanel ─────────────────────────────────────────────────────────

/** Inventory grid (right-side slide-out). */
class InventoryPanel {
    readonly container: PIXI.Container;
    readonly slots: InventorySlotEntry[] = [];

    private _menuOpen = false;
    private _menuSlide = 0;
    private _menuWidth = 0;

    constructor() {
        this.container = new PIXI.Container();
        this.container.label = 'inventoryMenu';
    }

    async load(
        loadTexture: TextureLoader,
        onRightClick: (index: number) => void,
        onDragStart: (source: UISource, key: string | number, e: PIXI.FederatedPointerEvent) => void,
    ): Promise<void> {
        const slotTex = await loadTexture('slot');
        if (slotTex) (slotTex as { defaultAnchor: { x: number; y: number } }).defaultAnchor = { x: 0, y: 0 };
        this._buildGrid(slotTex, 5, 5, onRightClick, onDragStart);
    }

    toggle(): void {
        this._menuOpen = !this._menuOpen;
    }

    update(deltaMs: number): void {
        const slideSpeed = 8;
        const dt = deltaMs / 1000;
        const target = this._menuOpen ? 1 : 0;
        this._menuSlide += (target - this._menuSlide) * Math.min(1, slideSpeed * dt);
        if (Math.abs(this._menuSlide - target) < 0.001) this._menuSlide = target;
    }

    layout(screenW: number, _screenH: number): void {
        const invOffX = screenW - this._menuWidth * this._menuSlide;
        this.container.x = invOffX;
        this.container.y = 0;
    }

    async addItem(item: Item): Promise<boolean> {
        const index = state.inventory.add(item);
        if (index === -1) {
            console.warn('InventoryPanel.addItem: inventory full');
            return false;
        }
        const entry = this.slots[index];
        if (!entry) return false;
        return this.setSlot(entry, item);
    }

    async setSlot(entry: InventorySlotEntry, item: Item): Promise<boolean> {
        if (entry.iconSprite) {
            safeDestroy(entry.iconSprite);
            entry.iconSprite = null;
        }
        if (entry.item) {
            await entry.item.unloadIcon();
        }

        await item.loadIcon();
        const icon = item.createIcon();
        if (!icon) return false;

        const scale = Math.min(SLOT_ICON_MAX / icon.texture.width, SLOT_ICON_MAX / icon.texture.height);
        icon.anchor.set(0.5);
        icon.scale.set(scale);
        icon.x = SLOT_SIZE / 2;
        icon.y = SLOT_SIZE / 2;

        entry.container.addChild(icon);
        entry.iconSprite = icon;
        entry.item = item;
        const idx = this.slots.indexOf(entry);
        if (idx !== -1) state.inventory.set(idx, item);

        if (entry.bgSprite) entry.bgSprite.mask = null;

        return true;
    }

    async clearSlot(entry: InventorySlotEntry): Promise<void> {
        if (entry.iconSprite) {
            safeDestroy(entry.iconSprite);
            entry.iconSprite = null;
        }
        if (entry.item) {
            await entry.item.unloadIcon();
            entry.item = null;
        }
        const idx = this.slots.indexOf(entry);
        if (idx !== -1) state.inventory.set(idx, null);
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
    }

    detachIcon(entry: InventorySlotEntry): void {
        if (entry.iconSprite) {
            safeDestroy(entry.iconSprite);
            entry.iconSprite = null;
        }
        entry.item = null;
        const idx = this.slots.indexOf(entry);
        if (idx !== -1) state.inventory.set(idx, null);
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
    }

    private _buildGrid(
        slotTex: PIXI.Texture | null,
        cols: number,
        rows: number,
        onRightClick: (index: number) => void,
        onDragStart: (source: UISource, key: string | number, e: PIXI.FederatedPointerEvent) => void,
    ): void {
        const slotSize = SLOT_SIZE;
        const gap = 0;
        const margin = 0;

        const slotsContainer = new PIXI.Container();
        slotsContainer.label = 'inventorySlots';
        slotsContainer.x = margin;
        slotsContainer.y = margin;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotContainer = new PIXI.Container();
                slotContainer.label = `invSlot_${row}_${col}`;
                slotContainer.x = col * (slotSize + gap);
                slotContainer.y = row * (slotSize + gap);

                let bgSprite: PIXI.NineSliceSprite | null = null;
                let borderMask: PIXI.Graphics | null = null;
                if (slotTex) {
                    const bg = new PIXI.NineSliceSprite({
                        texture: slotTex,
                        leftWidth: SLOT_BORDER,
                        rightWidth: SLOT_BORDER,
                        topHeight: SLOT_BORDER,
                        bottomHeight: SLOT_BORDER,
                    });
                    bg.width = slotSize;
                    bg.height = slotSize;
                    bg.tint = 0xFFC8C8;
                    bgSprite = bg;

                    borderMask = new PIXI.Graphics();
                    borderMask.rect(0, 0, slotSize, slotSize);
                    borderMask.fill({ color: 0xffffff });
                    borderMask.rect(SLOT_BORDER, SLOT_BORDER, slotSize - SLOT_BORDER * 2, slotSize - SLOT_BORDER * 2);
                    borderMask.cut();
                    slotContainer.addChild(borderMask);
                    bg.mask = borderMask;

                    slotContainer.addChild(bg);
                }

                slotContainer.eventMode = 'static';
                slotContainer.cursor = 'pointer';
                const invIndex = row * cols + col;
                slotContainer.on('rightclick', () => onRightClick(invIndex));
                slotContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                    if (e.button === 0) onDragStart(UISource.Inventory, invIndex, e);
                });

                slotsContainer.addChild(slotContainer);
                this.slots.push({ container: slotContainer, placeholder: null, iconSprite: null, item: null, bgSprite, borderMask });
            }
        }

        this.container.addChild(slotsContainer);

        const gridWidth = cols * (slotSize + gap) - gap;
        this._menuWidth = margin + gridWidth + margin;
    }
}

// ── AbilityBar ─────────────────────────────────────────────────────────────

/** Bottom-centre ability slot grid. */
class AbilityBar {
    readonly container: PIXI.Container;
    readonly slots: AbilitySlotEntry[] = [];
    private _iconTextures: Record<string, PIXI.Texture> = {};

    constructor() {
        this.container = new PIXI.Container();
        this.container.label = 'abilityBar';
    }

    async load(loadTexture: TextureLoader): Promise<void> {
        const abilityslotTex = await loadTexture('abilityslot');
        if (abilityslotTex) (abilityslotTex as { defaultAnchor: { x: number; y: number } }).defaultAnchor = { x: 0, y: 0 };
        this._buildBar(abilityslotTex);
    }

    /** Load ability icon textures from a class ability spritesheet. */
    async loadIcons(sheetKey: string): Promise<void> {
        const manifest = await fetchManifest();
        const sheets = manifest[sheetKey] || [];
        for (const sheetPath of sheets) {
            const fullPath = assetPath(`images/spritesheets/${sheetPath.replace('./', '')}`);
            const spritesheet: PIXI.Spritesheet = await PIXI.Assets.load(fullPath);
            const prefix = `${sheetKey}-`;
            for (const frameName in spritesheet.textures) {
                if (!frameName.startsWith(prefix)) continue;
                // Extract icon key: "chevalier_ability-groundslam-000" → "groundslam"
                const rest = frameName.slice(prefix.length);
                const dashIdx = rest.lastIndexOf('-');
                const iconKey = dashIdx >= 0 ? rest.slice(0, dashIdx) : rest;
                if (iconKey !== 'none') {
                    this._iconTextures[iconKey] = spritesheet.textures[frameName]!;
                }
            }
        }
    }

    /** Bind player abilities and prayers to the UI slots, placing icons. */
    bindPlayer(player: Player): void {
        const slotSize = ABILITY_SLOT_SIZE;
        const innerSize = slotSize - ABILITY_SLOT_BORDER * 2;

        for (const slot of this.slots) {
            // Remove any previous icon/overlay
            if (slot.iconSprite) { slot.iconSprite.destroy(); slot.iconSprite = null; }
            if (slot.cooldownOverlay) { slot.cooldownOverlay.destroy(); slot.cooldownOverlay = null; }
            if (slot.activeGlow) { slot.activeGlow.destroy(); slot.activeGlow = null; }

            let iconKey: string | null = null;
            const isAbilityRow = slot.row === 0;

            if (isAbilityRow) {
                const ability = player.playerAbilities[slot.key as keyof typeof player.playerAbilities];
                if (ability) iconKey = ability.iconKey;
            } else {
                const prayer = player.prayers[slot.key as keyof typeof player.prayers];
                if (prayer) iconKey = prayer.iconKey;
            }

            if (iconKey && this._iconTextures[iconKey]) {
                const icon = new PIXI.Sprite(this._iconTextures[iconKey]);
                icon.width = innerSize;
                icon.height = innerSize;
                icon.anchor.set(0);
                icon.x = ABILITY_SLOT_BORDER;
                icon.y = ABILITY_SLOT_BORDER;
                // Insert icon behind the key label (last child)
                slot.container.addChildAt(icon, slot.container.children.length - 1);
                slot.iconSprite = icon;
            }

            // Cooldown sweep overlay for ability row
            if (isAbilityRow) {
                const overlay = new PIXI.Graphics();
                overlay.x = ABILITY_SLOT_BORDER;
                overlay.y = ABILITY_SLOT_BORDER;
                overlay.alpha = 0.6;
                overlay.visible = false;
                slot.container.addChildAt(overlay, slot.container.children.length - 1);
                slot.cooldownOverlay = overlay;
            }

            // Active glow border for prayer row
            if (!isAbilityRow) {
                const glow = new PIXI.Graphics();
                glow.visible = false;
                slot.container.addChildAt(glow, slot.container.children.length - 1);
                slot.activeGlow = glow;
            }
        }
    }

    /** Update cooldown sweeps and prayer active indicators. */
    updateSlots(player: Player): void {
        const slotSize = ABILITY_SLOT_SIZE;
        const innerSize = slotSize - ABILITY_SLOT_BORDER * 2;
        const cx = innerSize / 2;
        const cy = innerSize / 2;
        const radius = innerSize * 0.72;

        for (const slot of this.slots) {
            const unlockLvl = SLOT_UNLOCK_LEVELS[slot.key] ?? 1;
            const locked = player.level < unlockLvl;

            // Hide icon when locked
            if (slot.iconSprite) {
                slot.iconSprite.visible = !locked;
            }

            if (slot.row === 0 && slot.cooldownOverlay) {
                if (locked) {
                    slot.cooldownOverlay.visible = false;
                    continue;
                }
                const ability = player.playerAbilities[slot.key as keyof typeof player.playerAbilities];
                if (!ability || ability.cooldown === 0) {
                    slot.cooldownOverlay.visible = false;
                    continue;
                }
                const remaining = ability.remainingCooldown();
                if (remaining <= 0) {
                    slot.cooldownOverlay.visible = false;
                    continue;
                }
                const pct = remaining / ability.cooldown;
                slot.cooldownOverlay.visible = true;
                slot.cooldownOverlay.clear();
                // Draw a pie/clock-wipe from top, clockwise
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + pct * Math.PI * 2;
                slot.cooldownOverlay.moveTo(cx, cy);
                slot.cooldownOverlay.arc(cx, cy, radius, startAngle, endAngle);
                slot.cooldownOverlay.lineTo(cx, cy);
                slot.cooldownOverlay.fill({ color: 0x000000 });
            }

            if (slot.row === 1 && slot.activeGlow) {
                if (locked) {
                    slot.activeGlow.visible = false;
                    continue;
                }
                const prayer = player.prayers[slot.key as keyof typeof player.prayers];
                if (!prayer || !prayer.active) {
                    slot.activeGlow.visible = false;
                    continue;
                }
                slot.activeGlow.visible = true;
                slot.activeGlow.clear();
                slot.activeGlow.rect(0, 0, slotSize, slotSize);
                slot.activeGlow.stroke({ color: 0x44ff44, width: 3, alpha: 0.8 });
            }
        }
    }

    layout(screenW: number, screenH: number): void {
        const healthOrbRight = HUD_MARGIN + ORB_RADIUS + 250;
        const abSlotsHeight = 2 * ABILITY_SLOT_SIZE;
        this.container.x = healthOrbRight;
        this.container.y = screenH - abSlotsHeight;
    }

    private _buildBar(slotTex: PIXI.Texture | null): void {
        const slotSize = ABILITY_SLOT_SIZE;
        const gap = 0;
        const cols = 5;
        const rows = 2;
        const keys = [
            ['Q', 'W', 'E', 'R', 'T'],
            ['A', 'S', 'D', 'F', 'G'],
        ];

        const slotsContainer = new PIXI.Container();
        slotsContainer.label = 'abilitySlots';

        const grayscaleFilter = new PIXI.ColorMatrixFilter();
        grayscaleFilter.grayscale(0.35, false);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotContainer = new PIXI.Container();
                slotContainer.label = `abilitySlot_${keys[row]![col]!}`;
                slotContainer.x = col * (slotSize + gap);
                slotContainer.y = row * (slotSize + gap);

                if (slotTex) {
                    const bg = new PIXI.NineSliceSprite({
                        texture: slotTex,
                        leftWidth: ABILITY_SLOT_BORDER,
                        rightWidth: ABILITY_SLOT_BORDER,
                        topHeight: ABILITY_SLOT_BORDER,
                        bottomHeight: ABILITY_SLOT_BORDER,
                    });
                    bg.width = slotSize;
                    bg.height = slotSize;
                    bg.filters = [grayscaleFilter];

                    const borderMask = new PIXI.Graphics();
                    borderMask.rect(0, 0, slotSize, slotSize);
                    borderMask.fill({ color: 0xffffff });
                    borderMask.rect(ABILITY_SLOT_BORDER, ABILITY_SLOT_BORDER, slotSize - ABILITY_SLOT_BORDER * 2, slotSize - ABILITY_SLOT_BORDER * 2);
                    borderMask.cut();
                    slotContainer.addChild(borderMask);
                    bg.mask = borderMask;

                    slotContainer.addChild(bg);
                }

                const label = new PIXI.Text({
                    text: keys[row]![col]!,
                    style: {
                        fontFamily: 'serif',
                        fontSize: 18,
                        fill: 0xffffff,
                        stroke: { color: 0x000000, width: 3 },
                    },
                });
                label.x = 6;
                label.y = 2;
                slotContainer.addChild(label);

                slotsContainer.addChild(slotContainer);
                this.slots.push({
                    container: slotContainer, row, col,
                    key: keys[row]![col]!,
                    iconSprite: null,
                    cooldownOverlay: null,
                    activeGlow: null,
                });
            }
        }

        this.container.addChild(slotsContainer);
    }
}

// ── TooltipManager ─────────────────────────────────────────────────────────

/** Builds, positions, and shows / hides item tooltips. */
class TooltipManager {
    private _container: PIXI.Container | null = null;
    private _item: Item | null = null;
    private _visible = false;

    build(parent: PIXI.Container): void {
        this._container = new PIXI.Container();
        this._container.label = 'itemTooltip';
        this._container.visible = false;
        this._container.eventMode = 'none';
        parent.addChild(this._container);
    }

    wireSlotHoverEvents(
        equippedSlots: EquippedSlotEntry[],
        inventorySlots: InventorySlotEntry[],
        isDragging: () => boolean,
    ): void {
        for (const entry of equippedSlots) {
            entry.container.on('pointerover', (e: PIXI.FederatedPointerEvent) => this._onSlotHover(entry, e, isDragging));
            entry.container.on('pointerout', () => this.hide());
        }
        for (const entry of inventorySlots) {
            entry.container.on('pointerover', (e: PIXI.FederatedPointerEvent) => this._onSlotHover(entry, e, isDragging));
            entry.container.on('pointerout', () => this.hide());
        }
    }

    show(item: Item, screenX: number, screenY: number): void {
        if (!this._container) return;
        this._item = item;
        this._visible = true;

        this._container.removeChildren();

        const pad = TOOLTIP_PADDING;
        const innerWidth = TOOLTIP_INNER_WIDTH;
        let yOffset = pad;

        const nameText = new PIXI.Text({
            text: item.name,
            style: {
                fontFamily: 'Cinzel, serif',
                fontSize: TOOLTIP_NAME_FONT_SIZE,
                fontWeight: '600',
                fill: 0xFFD700,
                wordWrap: true,
                wordWrapWidth: innerWidth,
                stroke: { color: 0x000000, width: 2 },
            },
        });
        nameText.x = pad;
        nameText.y = yOffset;
        this._container.addChild(nameText);
        yOffset += nameText.height + 4;

        const rarityColor = RARITY_COLORS[item.rarity];
        const rarityLabel = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);
        const rarityText = new PIXI.Text({
            text: rarityLabel,
            style: {
                fontFamily: 'Grenze, serif',
                fontSize: TOOLTIP_DESC_FONT_SIZE,
                fontWeight: '600',
                fill: rarityColor,
                stroke: { color: 0x000000, width: 1 },
            },
        });
        rarityText.x = pad;
        rarityText.y = yOffset;
        this._container.addChild(rarityText);
        yOffset += rarityText.height + 4;

        const slotLabel = item.slot.charAt(0).toUpperCase() + item.slot.slice(1);
        const slotText = new PIXI.Text({
            text: slotLabel,
            style: {
                fontFamily: 'Grenze, serif',
                fontSize: TOOLTIP_DESC_FONT_SIZE,
                fontStyle: 'italic',
                fill: 0xAAAAAA,
                stroke: { color: 0x000000, width: 1 },
            },
        });
        slotText.x = pad;
        slotText.y = yOffset;
        this._container.addChild(slotText);
        yOffset += slotText.height + 4;

        if (item.allowedClasses.length > 0) {
            const classNames = item.allowedClasses
                .map((c: string) => c.charAt(0).toUpperCase() + c.slice(1))
                .join(', ');
            const classText = new PIXI.Text({
                text: classNames + ' Only',
                style: {
                    fontFamily: 'Grenze, serif',
                    fontSize: TOOLTIP_DESC_FONT_SIZE,
                    fill: 0xCC8844,
                    stroke: { color: 0x000000, width: 1 },
                },
            });
            classText.x = pad;
            classText.y = yOffset;
            this._container.addChild(classText);
            yOffset += classText.height + 4;
        }

        yOffset += 2;

        const baseEntries = Object.entries(item.baseStats);
        if (baseEntries.length > 0) {
            for (const [key, value] of baseEntries) {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c: string) => c.toUpperCase());
                const statText = new PIXI.Text({
                    text: `+${value} ${label}`,
                    style: {
                        fontFamily: 'Grenze, serif',
                        fontSize: TOOLTIP_STAT_FONT_SIZE,
                        fontWeight: '600',
                        fill: 0xFFFFFF,
                        stroke: { color: 0x000000, width: 1 },
                    },
                });
                statText.x = pad;
                statText.y = yOffset;
                this._container.addChild(statText);
                yOffset += statText.height + 2;
            }
            yOffset += 4;
        }

        if (item.mods && item.mods.length > 0) {
            const sepLine = new PIXI.Graphics();
            sepLine.moveTo(pad, yOffset);
            sepLine.lineTo(pad + innerWidth, yOffset);
            sepLine.stroke({ width: 1, color: 0x5566AA, alpha: 0.6 });
            this._container.addChild(sepLine);
            yOffset += 6;

            for (const modDesc of item.modDescriptions) {
                const modText = new PIXI.Text({
                    text: modDesc,
                    style: {
                        fontFamily: 'Grenze, serif',
                        fontSize: TOOLTIP_STAT_FONT_SIZE,
                        fontWeight: '600',
                        fill: 0x66CCFF,
                        wordWrap: true,
                        wordWrapWidth: innerWidth,
                        stroke: { color: 0x000000, width: 1 },
                    },
                });
                modText.x = pad;
                modText.y = yOffset;
                this._container.addChild(modText);
                yOffset += modText.height + 2;
            }
            yOffset += 2;
        }

        if (item.description) {
            const sepLine2 = new PIXI.Graphics();
            sepLine2.moveTo(pad, yOffset);
            sepLine2.lineTo(pad + innerWidth, yOffset);
            sepLine2.stroke({ width: 1, color: 0x5566AA, alpha: 0.4 });
            this._container.addChild(sepLine2);
            yOffset += 6;

            const descText = new PIXI.Text({
                text: item.description,
                style: {
                    fontFamily: 'Grenze, serif',
                    fontSize: TOOLTIP_DESC_FONT_SIZE,
                    fontStyle: 'italic',
                    fill: 0x999999,
                    wordWrap: true,
                    wordWrapWidth: innerWidth,
                    stroke: { color: 0x000000, width: 1 },
                },
            });
            descText.x = pad;
            descText.y = yOffset;
            this._container.addChild(descText);
            yOffset += descText.height + 2;
        }

        yOffset += pad;

        const totalWidth = innerWidth + pad * 2;
        const totalHeight = yOffset;
        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, totalWidth, totalHeight, 6);
        bg.fill({ color: 0x111122, alpha: 0.92 });
        bg.roundRect(0, 0, totalWidth, totalHeight, 6);
        bg.stroke({ width: 1.5, color: rarityColor, alpha: 0.7 });

        this._container.addChildAt(bg, 0);

        this._positionTooltip(screenX, screenY, totalWidth, totalHeight);
        this._container.visible = true;
    }

    hide(): void {
        if (this._container) {
            this._container.visible = false;
        }
        this._item = null;
        this._visible = false;
    }

    private _onSlotHover(
        entry: EquippedSlotEntry | InventorySlotEntry,
        e: PIXI.FederatedPointerEvent,
        isDragging: () => boolean,
    ): void {
        if (!entry.item) {
            this.hide();
            return;
        }
        if (isDragging()) return;

        this.show(entry.item, e.global.x, e.global.y);
    }

    private _positionTooltip(screenX: number, screenY: number, tipW: number, tipH: number): void {
        const margin = 14;
        const screenW = state.app?.screen?.width || window.innerWidth;
        const screenH = state.app?.screen?.height || window.innerHeight;

        let tx = screenX + margin;
        let ty = screenY + margin;

        if (tx + tipW > screenW) {
            tx = screenX - tipW - margin;
        }
        if (ty + tipH > screenH) {
            ty = screenH - tipH - 4;
        }
        if (tx < 0) tx = 4;
        if (ty < 0) ty = 4;

        this._container!.x = tx;
        this._container!.y = ty;
    }
}

// ── DragDropController ─────────────────────────────────────────────────────

/** Drag-and-drop + right-click item-movement logic. */
class DragDropController {
    private _drag: DragState | null = null;
    private _rightClickBusy = false;
    private _onDragMoveHandler: ((e: PIXI.FederatedPointerEvent) => void) | null = null;
    private _onDragEndHandler: ((e: PIXI.FederatedPointerEvent) => void) | null = null;

    private _equipment: EquipmentPanel;
    private _inventory: InventoryPanel;
    private _tooltip: TooltipManager;
    private _hudContainer: PIXI.Container;

    constructor(
        equipment: EquipmentPanel,
        inventory: InventoryPanel,
        tooltip: TooltipManager,
        hudContainer: PIXI.Container,
    ) {
        this._equipment = equipment;
        this._inventory = inventory;
        this._tooltip = tooltip;
        this._hudContainer = hudContainer;
    }

    get isDragging(): boolean {
        return this._drag !== null;
    }

    // ─── Right-click interactions ─────────────────────────────────────

    async onEquippedSlotRightClick(slotType: GearSlot): Promise<void> {
        if (this._rightClickBusy) return;
        if (state.player && !state.player.isAlive) return;
        const entry = this._equipment.slots.find(s => s.slotType === slotType);
        if (!entry || !entry.item) return;

        const freeInvSlot = this._inventory.slots.find(s => !s.item);
        if (!freeInvSlot) {
            console.warn('Inventory full – cannot unequip');
            return;
        }

        this._rightClickBusy = true;
        try {
            const item = entry.item;

            await this._inventory.setSlot(freeInvSlot, item);

            if (entry.iconSprite) {
                safeDestroy(entry.iconSprite);
                entry.iconSprite = null;
            }
            entry.item = null;
            if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
            if (entry.placeholder) entry.placeholder.visible = true;

            if (state.player) {
                await state.player.unequipSlot(slotType);
            }
        } finally {
            this._rightClickBusy = false;
        }
    }

    async onInventorySlotRightClick(index: number): Promise<void> {
        if (this._rightClickBusy) return;
        if (state.player && !state.player.isAlive) return;
        const entry = this._inventory.slots[index];
        if (!entry || !entry.item) return;

        this._rightClickBusy = true;
        try {
            const item = entry.item;
            const slot = item.slot;

            const eqEntry = this._equipment.slots.find(s => s.slotType === slot);
            const previousItem = eqEntry?.item || null;

            await this._inventory.clearSlot(entry);

            if (state.player) {
                await state.player.equipItem(item);
            }

            if (previousItem) {
                await this._inventory.setSlot(entry, previousItem);
            }
        } finally {
            this._rightClickBusy = false;
        }
    }

    // ─── Drag-and-drop ────────────────────────────────────────────────

    onDragStart(source: UISource, key: string | number, e: PIXI.FederatedPointerEvent): void {
        if (this._drag) return;
        if (state.player && !state.player.isAlive) return;

        let entry: EquippedSlotEntry | InventorySlotEntry | undefined;
        let item: Item | null | undefined;
        if (source === UISource.Equipped) {
            entry = this._equipment.slots.find(s => s.slotType === key);
            item = entry?.item;
        } else {
            entry = this._inventory.slots[key as number];
            item = entry?.item;
        }
        if (!entry || !item) return;

        e.stopPropagation();

        this._tooltip.hide();

        if ((entry as EquippedSlotEntry | InventorySlotEntry).iconSprite) {
            (entry as EquippedSlotEntry | InventorySlotEntry).iconSprite!.visible = false;
        }

        const dragSprite = item.createIcon();
        if (!dragSprite) return;
        const scale = Math.min(SLOT_ICON_MAX / dragSprite.texture.width, SLOT_ICON_MAX / dragSprite.texture.height);
        dragSprite.anchor.set(0.5);
        dragSprite.scale.set(scale);
        dragSprite.alpha = 0.85;

        const pos = e.global;
        dragSprite.x = pos.x;
        dragSprite.y = pos.y;

        this._hudContainer.addChild(dragSprite);

        this._drag = { source, key, entry, sprite: dragSprite, item };

        const stage = this._hudContainer.parent!;
        this._onDragMoveHandler = (ev: PIXI.FederatedPointerEvent) => this._onDragMove(ev);
        this._onDragEndHandler = (ev: PIXI.FederatedPointerEvent) => this._onDragEnd(ev);
        stage.on('pointermove', this._onDragMoveHandler);
        stage.on('pointerup', this._onDragEndHandler);
        stage.on('pointerupoutside', this._onDragEndHandler);
    }

    private _onDragMove(e: PIXI.FederatedPointerEvent): void {
        if (!this._drag) return;
        const pos = e.global;
        this._drag.sprite.x = pos.x;
        this._drag.sprite.y = pos.y;
    }

    private async _onDragEnd(e: PIXI.FederatedPointerEvent): Promise<void> {
        if (!this._drag) return;
        const drag = this._drag;
        this._drag = null;

        const stage = this._hudContainer.parent!;
        if (this._onDragMoveHandler) stage.off('pointermove', this._onDragMoveHandler);
        if (this._onDragEndHandler) {
            stage.off('pointerup', this._onDragEndHandler);
            stage.off('pointerupoutside', this._onDragEndHandler);
        }

        safeDestroy(drag.sprite);

        const pos = e.global;
        const target = this._hitTestSlot(pos.x, pos.y);

        let handled = false;

        if (target) {
            handled = await this._tryDrop(drag, target);
        }

        if (!handled && !this._hitTestAnyContainer(pos.x, pos.y)) {
            handled = await this._dropAsLoot(drag, pos.x, pos.y);
        }

        if (!handled) {
            if (drag.entry.iconSprite) {
                drag.entry.iconSprite.visible = true;
            }
        }
    }

    private _hitTestSlot(screenX: number, screenY: number): HitTestResult | null {
        for (const entry of this._equipment.slots) {
            const bounds = entry.container.getBounds();
            if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
                screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
                return { type: UISource.Equipped, entry };
            }
        }
        for (let i = 0; i < this._inventory.slots.length; i++) {
            const entry = this._inventory.slots[i]!;
            const bounds = entry.container.getBounds();
            if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
                screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
                return { type: UISource.Inventory, entry, index: i };
            }
        }
        return null;
    }

    /** Check whether a screen position overlaps any HUD container. */
    _hitTestAnyContainer(screenX: number, screenY: number): boolean {
        for (const c of this._hudContainer.children) {
            if (!c.visible) continue;
            const b = c.getBounds();
            if (screenX >= b.x && screenX <= b.x + b.width &&
                screenY >= b.y && screenY <= b.y + b.height) {
                return true;
            }
        }
        return false;
    }

    private async _tryDrop(drag: DragState, target: HitTestResult): Promise<boolean> {
        const srcEntry = drag.entry;
        const srcItem = drag.item;
        const dstEntry = target.entry;
        const player = state.player;

        if (srcEntry === dstEntry) {
            return false;
        }

        // ── Drag from EQUIPPED → INVENTORY ──
        if (drag.source === UISource.Equipped && target.type === UISource.Inventory) {
            const src = srcEntry as EquippedSlotEntry;
            const dst = target.entry;
            const dstItem = dst.item;

            if (dstItem && dstItem.slot === srcItem.slot) {
                await this._inventory.clearSlot(dst);
                this._equipment.detachIcon(src);

                await this._equipment.setItem(src.slotType, dstItem);
                if (player) await player.equipItem(dstItem);

                await this._inventory.setSlot(dst, srcItem);
                return true;
            }

            if (!dstItem) {
                this._equipment.detachIcon(src);
                await this._inventory.setSlot(dst, srcItem);
                if (player) await player.unequipSlot(src.slotType);
                return true;
            }

            return false;
        }

        // ── Drag from INVENTORY → EQUIPPED ──
        if (drag.source === UISource.Inventory && target.type === UISource.Equipped) {
            const src = srcEntry as InventorySlotEntry;
            const dst = target.entry;
            if (srcItem.slot !== dst.slotType) return false;

            const dstItem = dst.item;

            this._inventory.detachIcon(src);

            if (dstItem) {
                this._equipment.detachIconKeepData(dst);
                await this._inventory.setSlot(src, dstItem);
            }

            if (player) await player.equipItem(srcItem);
            return true;
        }

        // ── Drag from INVENTORY → INVENTORY ──
        if (drag.source === UISource.Inventory && target.type === UISource.Inventory) {
            const src = srcEntry as InventorySlotEntry;
            const dst = target.entry;
            const dstItem = dst.item;

            this._inventory.detachIcon(src);
            if (dstItem) {
                this._inventory.detachIcon(dst);
                await this._inventory.setSlot(src, dstItem);
            }
            await this._inventory.setSlot(dst, srcItem);
            return true;
        }

        // ── Drag from EQUIPPED → EQUIPPED ──
        if (drag.source === UISource.Equipped && target.type === UISource.Equipped) {
            const src = srcEntry as EquippedSlotEntry;
            const dst = target.entry;
            const dstItem = dst.item;
            if (src.slotType !== dst.slotType) return false;

            this._equipment.detachIcon(src);
            if (dstItem) {
                this._equipment.detachIconKeepData(dst);
                await this._equipment.setItem(src.slotType, dstItem);
                if (player) await player.equipItem(dstItem);
            }
            await this._equipment.setItem(dst.slotType, srcItem);
            if (player) await player.equipItem(srcItem);
            return true;
        }

        return false;
    }

    private async _dropAsLoot(drag: DragState, screenX: number, screenY: number): Promise<boolean> {
        if (!state.area) return false;

        const item = drag.item;

        const worldX = screenX - state.area.container.x;
        const worldY = screenY - state.area.container.y;

        if (drag.source === UISource.Equipped) {
            this._equipment.detachIcon(drag.entry as EquippedSlotEntry);
        } else {
            this._inventory.detachIcon(drag.entry as InventorySlotEntry);
        }

        const loot = item.createLoot(worldX, worldY);
        await loot.loadTextures();
        state.area.container.addChild(loot.container);
        loot.attachLabelsTo(state.area.lootLabelsContainer);
        state.area.lootOnGround.push(loot);

        if (drag.source === UISource.Equipped && state.player) {
            state.player.unequipSlot((drag.entry as EquippedSlotEntry).slotType);
        }

        return true;
    }
}

// ── Hover Health Bar ───────────────────────────────────────────────────────

const HOVER_BAR_WIDTH  = 260;
const HOVER_BAR_HEIGHT = 28;
const HOVER_BAR_Y      = 12;
const HOVER_BAR_BG     = 0x111111;
const HOVER_BAR_FILL   = 0xcc2222;
const HOVER_BAR_BORDER = 0x444444;

class HoverHealthBar {
    readonly container: PIXI.Container;
    private readonly _bg: PIXI.Graphics;
    private readonly _fill: PIXI.Graphics;
    private readonly _label: PIXI.Text;

    constructor() {
        this.container = new PIXI.Container();
        this.container.label = 'hoverHealthBar';
        this.container.visible = false;

        this._bg = new PIXI.Graphics();
        this._fill = new PIXI.Graphics();
        this._label = new PIXI.Text({
            text: '',
            style: {
                fontFamily: 'Cinzel, serif',
                fontSize: 14,
                fontWeight: '600',
                fill: 0xffffff,
                align: 'center',
            },
        });
        this._label.anchor.set(0.5);

        this.container.addChild(this._bg, this._fill, this._label);
    }

    show(name: string, currentHealth: number, maxHealth: number): void {
        const pct = maxHealth > 0 ? Math.max(0, Math.min(1, currentHealth / maxHealth)) : 0;

        // Background + border
        this._bg.clear();
        this._bg.roundRect(0, 0, HOVER_BAR_WIDTH, HOVER_BAR_HEIGHT, 4);
        this._bg.fill({ color: HOVER_BAR_BG, alpha: 0.85 });
        this._bg.roundRect(0, 0, HOVER_BAR_WIDTH, HOVER_BAR_HEIGHT, 4);
        this._bg.stroke({ color: HOVER_BAR_BORDER, width: 1.5 });

        // Health fill
        const fillW = Math.round((HOVER_BAR_WIDTH - 4) * pct);
        this._fill.clear();
        if (fillW > 0) {
            this._fill.roundRect(2, 2, fillW, HOVER_BAR_HEIGHT - 4, 3);
            this._fill.fill({ color: HOVER_BAR_FILL, alpha: 0.9 });
        }

        // Name label
        this._label.text = name;
        this._label.x = HOVER_BAR_WIDTH / 2;
        this._label.y = HOVER_BAR_HEIGHT / 2;

        this.container.visible = true;
    }

    hide(): void {
        this.container.visible = false;
    }

    layout(screenW: number): void {
        this.container.x = Math.round((screenW - HOVER_BAR_WIDTH) / 2);
        this.container.y = HOVER_BAR_Y;
    }
}

// ── UI (coordinator) ───────────────────────────────────────────────────────

/**
 * HUD overlay – composes OrbHUD, EquipmentPanel, InventoryPanel,
 * AbilityBar, TooltipManager, and DragDropController.
 *
 * The whole HUD lives in a PIXI.Container added directly to `app.stage`
 * so it stays fixed on screen regardless of camera movement.
 */
class UI {
    container: PIXI.Container;

    readonly orbs: OrbHUD;
    readonly equipment: EquipmentPanel;
    readonly inventory: InventoryPanel;
    readonly abilityBar: AbilityBar;
    readonly tooltip: TooltipManager;
    readonly dragDrop: DragDropController;
    readonly hoverHealth: HoverHealthBar;

    // Backward-compatible accessors (used by external files)
    get healthOrbContainer(): PIXI.Container { return this.orbs.healthContainer; }
    get manaOrbContainer(): PIXI.Container { return this.orbs.manaContainer; }
    get equippedMenuContainer(): PIXI.Container { return this.equipment.container; }
    get inventoryMenuContainer(): PIXI.Container { return this.inventory.container; }
    get abilityBarContainer(): PIXI.Container { return this.abilityBar.container; }
    get equippedSlots(): EquippedSlotEntry[] { return this.equipment.slots; }
    get inventorySlots(): InventorySlotEntry[] { return this.inventory.slots; }
    get abilitySlots(): AbilitySlotEntry[] { return this.abilityBar.slots; }

    private _deathOverlay: PIXI.Container | null = null;
    private _deathFadeTicker: ((ticker: PIXI.Ticker) => void) | null = null;

    constructor() {
        this.container = new PIXI.Container();
        this.container.label = 'hud';

        this.orbs = new OrbHUD();
        this.equipment = new EquipmentPanel();
        this.inventory = new InventoryPanel();
        this.abilityBar = new AbilityBar();
        this.tooltip = new TooltipManager();
        this.hoverHealth = new HoverHealthBar();
        this.dragDrop = new DragDropController(this.equipment, this.inventory, this.tooltip, this.container);

        this.container.addChild(this.orbs.healthContainer);
        this.container.addChild(this.orbs.manaContainer);
        this.container.addChild(this.equipment.container);
        this.container.addChild(this.inventory.container);
        this.container.addChild(this.abilityBar.container);
        this.container.addChild(this.hoverHealth.container);
    }

    // ------------------------------------------------------------------ Load

    async load(): Promise<void> {
        const manifest = await fetchManifest();

        const loadTexture: TextureLoader = async (key: string): Promise<PIXI.Texture | null> => {
            const sheets = manifest[key] || [];
            for (const sheetPath of sheets) {
                const fullPath = assetPath(`images/spritesheets/${sheetPath.replace('./', '')}`);
                const spritesheet: PIXI.Spritesheet = await PIXI.Assets.load(fullPath);
                trackSpritesheet(spritesheet);
                const names = Object.keys(spritesheet.textures);
                if (names.length > 0) return spritesheet.textures[names[0]!]!;
            }
            console.warn(`UI: no texture found for "${key}"`);
            return null;
        };

        await Promise.all([
            this.orbs.load(loadTexture),
            this.equipment.load(
                loadTexture,
                (slotType) => this.dragDrop.onEquippedSlotRightClick(slotType),
                (source, key, e) => this.dragDrop.onDragStart(source, key, e),
            ),
            this.inventory.load(
                loadTexture,
                (index) => this.dragDrop.onInventorySlotRightClick(index),
                (source, key, e) => this.dragDrop.onDragStart(source, key, e),
            ),
            this.abilityBar.load(loadTexture),
        ]);

        this.tooltip.build(this.container);
        this.tooltip.wireSlotHoverEvents(
            this.equipment.slots,
            this.inventory.slots,
            () => this.dragDrop.isDragging,
        );

        this.layout(window.innerWidth, window.innerHeight);
    }

    // ------------------------------------------------------------ Layout

    layout(screenW: number, screenH: number): void {
        this.orbs.layout(screenW, screenH);
        this.equipment.layout(screenW, screenH);
        this.inventory.layout(screenW, screenH);
        this.abilityBar.layout(screenW, screenH);
        this.hoverHealth.layout(screenW);
        this._layoutDeathOverlay(screenW, screenH);
    }

    // --------------------------------------------------------------- Update

    update(character: Character, deltaMs: number = 16.67): void {
        if (!character) return;
        this.orbs.update(character);
        this.equipment.update(deltaMs);
        this.inventory.update(deltaMs);
        if (state.player) {
            this.abilityBar.updateSlots(state.player);
        }
    }

    // ─── Delegated public API ─────────────────────────────────────────

    toggleEquippedMenu(): void { this.equipment.toggle(); }
    toggleInventoryMenu(): void { this.inventory.toggle(); }

    showHoverHealth(name: string, currentHealth: number, maxHealth: number): void {
        this.hoverHealth.show(name, currentHealth, maxHealth);
    }

    hideHoverHealth(): void {
        this.hoverHealth.hide();
    }

    async setEquippedItem(slot: GearSlot, item: Item): Promise<void> { return this.equipment.setItem(slot, item); }
    async clearEquippedItem(slot: GearSlot): Promise<void> { return this.equipment.clearItem(slot); }
    async setInventoryItem(item: Item): Promise<boolean> { return this.inventory.addItem(item); }

    /** Load ability icons and bind abilities/prayers from the player. */
    async bindPlayerAbilities(player: Player): Promise<void> {
        if (player.abilityIconSheet) {
            await this.abilityBar.loadIcons(player.abilityIconSheet);
        }
        this.abilityBar.bindPlayer(player);
    }

    get isDragging(): boolean { return this.dragDrop.isDragging; }

    showDeathScreen(): void {
        if (this._deathOverlay) return;

        // Grayscale filter on the whole stage (everything behind the HUD)
        const grayscale = new PIXI.ColorMatrixFilter();
        grayscale.desaturate();
        grayscale.enabled = true;

        // Semi-transparent dark overlay
        const overlay = new PIXI.Container();
        overlay.label = 'deathOverlay';

        const bg = new PIXI.Graphics();
        overlay.addChild(bg);

        const text = new PIXI.Text({
            text: 'you have\nbeen slain',
            style: {
                fontFamily: 'Cinzel',
                fontWeight: '600',
                fontSize: 72,
                fill: 0xcc2222,
                align: 'center',
                lineHeight: 90,
                stroke: { color: 0x000000, width: 4 },
            },
        });
        text.anchor.set(0.5);
        overlay.addChild(text);

        this.container.addChild(overlay);
        this._deathOverlay = overlay;

        // Start fully transparent, fade in
        overlay.alpha = 0;
        let saturation = 1;

        const stage = state.app?.stage;
        const areaContainer = state.area?.container;

        this._deathFadeTicker = (ticker: PIXI.Ticker) => {
            const dt = ticker.deltaTime / 60;
            overlay.alpha = Math.min(1, overlay.alpha + dt * 0.8);
            saturation = Math.max(0, saturation - dt * 0.8);

            // Apply desaturation to the area container
            if (areaContainer) {
                const filter = new PIXI.ColorMatrixFilter();
                filter.saturate(saturation - 1, false);
                areaContainer.filters = [filter];
            }

            if (overlay.alpha >= 1 && saturation <= 0) {
                PIXI.Ticker.shared.remove(this._deathFadeTicker!);
                this._deathFadeTicker = null;
            }

            this._layoutDeathOverlay(
                state.app?.screen.width ?? window.innerWidth,
                state.app?.screen.height ?? window.innerHeight,
            );
        };

        PIXI.Ticker.shared.add(this._deathFadeTicker);
    }

    private _layoutDeathOverlay(screenW: number, screenH: number): void {
        if (!this._deathOverlay) return;
        const bg = this._deathOverlay.children[0] as PIXI.Graphics;
        const text = this._deathOverlay.children[1] as PIXI.Text;
        bg.clear();
        bg.rect(0, 0, screenW, screenH);
        bg.fill({ color: 0x000000, alpha: 0.5 });
        text.x = screenW / 2;
        text.y = screenH / 2;
    }

    hitTest(screenX: number, screenY: number): boolean {
        const containers = [
            this.equipment.container,
            this.inventory.container,
            this.orbs.healthContainer,
            this.orbs.manaContainer,
            this.abilityBar.container,
        ];
        for (const c of containers) {
            if (!c.visible) continue;
            const b = c.getBounds();
            if (screenX >= b.x && screenX <= b.x + b.width &&
                screenY >= b.y && screenY <= b.y + b.height) {
                return true;
            }
        }
        return false;
    }
}

export { UI };
export type { EquippedSlotEntry, InventorySlotEntry, AbilitySlotEntry, DragState };
