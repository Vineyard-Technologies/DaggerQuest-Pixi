import * as PIXI from 'pixi.js';
import { Area } from './area';
import state from './state';
import { GearSlot, UISource } from './types';
import type { Item } from './item';
import type { Character } from './character';
import type { Player } from './player';

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

/**
 * HUD overlay – health orb (bottom-left) and mana orb (bottom-right).
 *
 * Layer order per orb (back → front):
 *   1. orbcoverback             – rear frame (backmost)
 *   2. healthorb/manaorb        – liquid fill (tinted red / blue)
 *   3. orbcoverfront            – front frame
 *   4. healthcover/manacover   – orb cover
 *
 * The whole HUD lives in a PIXI.Container added directly to `app.stage`
 * so it stays fixed on screen regardless of camera movement.
 */
class UI {
    container: PIXI.Container;
    healthOrbContainer: PIXI.Container;
    manaOrbContainer: PIXI.Container;
    equippedMenuContainer: PIXI.Container;
    inventoryMenuContainer: PIXI.Container;
    abilityBarContainer: PIXI.Container;

    equippedSlots: EquippedSlotEntry[];
    inventorySlots: InventorySlotEntry[];
    abilitySlots: AbilitySlotEntry[];

    private _equippedMenuOpen: boolean;
    private _inventoryMenuOpen: boolean;
    private _equippedMenuSlide: number;
    private _inventoryMenuSlide: number;
    private _equippedMenuWidth: number;
    private _inventoryMenuWidth: number;
    private _rightClickBusy: boolean;
    private _drag: DragState | null;
    private _healthOrbSprite: OrbSprite | null;
    private _manaOrbSprite: OrbSprite | null;
    private _orbHeight: number;
    private _tooltipContainer: PIXI.Container | null;
    private _tooltipItem: Item | null;
    private _tooltipVisible: boolean;
    private _onDragMoveHandler: ((e: PIXI.FederatedPointerEvent) => void) | null;
    private _onDragEndHandler: ((e: PIXI.FederatedPointerEvent) => void) | null;

    constructor() {
        this.container = new PIXI.Container();
        this.container.label = 'hud';

        this.healthOrbContainer = new PIXI.Container();
        this.healthOrbContainer.label = 'healthOrb';
        this.manaOrbContainer = new PIXI.Container();
        this.manaOrbContainer.label = 'manaOrb';

        this.container.addChild(this.healthOrbContainer);
        this.container.addChild(this.manaOrbContainer);

        this.equippedMenuContainer = new PIXI.Container();
        this.equippedMenuContainer.label = 'equippedMenu';
        this.container.addChild(this.equippedMenuContainer);

        this.inventoryMenuContainer = new PIXI.Container();
        this.inventoryMenuContainer.label = 'inventoryMenu';
        this.container.addChild(this.inventoryMenuContainer);

        this.abilityBarContainer = new PIXI.Container();
        this.abilityBarContainer.label = 'abilityBar';
        this.container.addChild(this.abilityBarContainer);

        this._equippedMenuOpen = false;
        this._inventoryMenuOpen = false;
        this._equippedMenuSlide = 0;
        this._inventoryMenuSlide = 0;
        this._equippedMenuWidth = 0;
        this._inventoryMenuWidth = 0;

        this.equippedSlots = [];
        this.inventorySlots = [];
        this.abilitySlots = [];

        this._rightClickBusy = false;
        this._drag = null;

        this._healthOrbSprite = null;
        this._manaOrbSprite = null;
        this._orbHeight = 0;

        this._tooltipContainer = null;
        this._tooltipItem = null;
        this._tooltipVisible = false;

        this._onDragMoveHandler = null;
        this._onDragEndHandler = null;
    }

    // ------------------------------------------------------------------ Load

    async load(): Promise<void> {
        const manifest = await Area.fetchManifest();

        const loadTexture = async (key: string): Promise<PIXI.Texture | null> => {
            const sheets = manifest[key] || [];
            for (const sheetPath of sheets) {
                const fullPath = `./images/spritesheets/${sheetPath.replace('./', '')}`;
                const spritesheet: PIXI.Spritesheet = await PIXI.Assets.load(fullPath);
                const names = Object.keys(spritesheet.textures);
                if (names.length > 0) return spritesheet.textures[names[0]!]!;
            }
            console.warn(`UI: no texture found for "${key}"`);
            return null;
        };

        const [
            orbcoverbackTex,
            orbcoverfrontTex,
            healthorbTex,
            manaorbTex,
            healthcoverTex,
            manacoverTex,
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
            slotTex,
            abilityslotTex,
        ] = await Promise.all([
            loadTexture('orbcoverback'),
            loadTexture('orbcoverfront'),
            loadTexture('healthorb'),
            loadTexture('manaorb'),
            loadTexture('healthcover'),
            loadTexture('manacover'),
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
            loadTexture('slot'),
            loadTexture('abilityslot'),
        ]);

        if (charactermenuTex) (charactermenuTex as { defaultAnchor: { x: number; y: number } }).defaultAnchor = { x: 0, y: 0 };
        if (slotTex) (slotTex as { defaultAnchor: { x: number; y: number } }).defaultAnchor = { x: 0, y: 0 };
        if (abilityslotTex) (abilityslotTex as { defaultAnchor: { x: number; y: number } }).defaultAnchor = { x: 0, y: 0 };

        this._buildOrb(this.healthOrbContainer, {
            coverBackTex: orbcoverbackTex,
            coverFrontTex: orbcoverfrontTex,
            orbTex: healthorbTex,
            coverTex: healthcoverTex,
            tint: 0xff4444,
        });

        this._buildOrb(this.manaOrbContainer, {
            coverBackTex: orbcoverbackTex,
            coverFrontTex: orbcoverfrontTex,
            orbTex: manaorbTex,
            coverTex: manacoverTex,
            tint: 0x4488ff,
        });

        if (healthorbTex) this._orbHeight = healthorbTex.height;

        const equippedPlaceholders: EquippedPlaceholderDef[] = [
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
        this._buildEquippedMenu(charactermenuTex, equippedPlaceholders);

        this._buildInventoryMenu(slotTex, 5, 5);

        this._buildAbilityBar(abilityslotTex);

        this._buildTooltip();
        this._wireSlotHoverEvents();

        this.layout(window.innerWidth, window.innerHeight);
    }

    // ---------------------------------------------------------- Build helpers

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

            if (container === this.healthOrbContainer) {
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

    private _buildEquippedMenu(slotTex: PIXI.Texture | null, placeholders: EquippedPlaceholderDef[]): void {
        const slotSize = 90;
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
                    leftWidth: 14,
                    rightWidth: 14,
                    topHeight: 14,
                    bottomHeight: 14,
                });
                bg.width = slotSize;
                bg.height = slotSize;
                bg.tint = 0x4757FF;
                bgSprite = bg;

                borderMask = new PIXI.Graphics();
                borderMask.rect(0, 0, slotSize, slotSize);
                borderMask.fill({ color: 0xffffff });
                borderMask.rect(14, 14, slotSize - 28, slotSize - 28);
                borderMask.cut();
                slotContainer.addChild(borderMask);
                bg.mask = borderMask;

                slotContainer.addChild(bg);
            }

            let placeholderSprite: PIXI.Sprite | null = null;
            if (ph.tex) {
                placeholderSprite = new PIXI.Sprite(ph.tex);
                const maxIconSize = 62;
                const borderSize = 14;
                const phScale = Math.min(maxIconSize / ph.tex.width, maxIconSize / ph.tex.height);
                placeholderSprite.scale.set(phScale);
                if (ph.type === 'offhand') {
                    placeholderSprite.anchor.set(0, 0);
                    placeholderSprite.x = borderSize;
                    placeholderSprite.y = borderSize;
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
            slotContainer.on('rightclick', () => this._onEquippedSlotRightClick(slotType));
            slotContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                if (e.button === 0) this._onDragStart(UISource.Equipped, slotType, e);
            });

            slotsContainer.addChild(slotContainer);
            this.equippedSlots.push({ container: slotContainer, placeholder: placeholderSprite, slotType: ph.type, iconSprite: null, item: null, bgSprite, borderMask });
        }

        this.equippedMenuContainer.addChild(slotsContainer);

        const gridWidth = cols * (slotSize + gap) - gap;
        this._equippedMenuWidth = margin + gridWidth + margin;
    }

    private _buildInventoryMenu(slotTex: PIXI.Texture | null, cols: number, rows: number): void {
        const slotSize = 90;
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
                        leftWidth: 14,
                        rightWidth: 14,
                        topHeight: 14,
                        bottomHeight: 14,
                    });
                    bg.width = slotSize;
                    bg.height = slotSize;
                    bg.tint = 0xFFC8C8;
                    bgSprite = bg;

                    borderMask = new PIXI.Graphics();
                    borderMask.rect(0, 0, slotSize, slotSize);
                    borderMask.fill({ color: 0xffffff });
                    borderMask.rect(14, 14, slotSize - 28, slotSize - 28);
                    borderMask.cut();
                    slotContainer.addChild(borderMask);
                    bg.mask = borderMask;

                    slotContainer.addChild(bg);
                }

                slotContainer.eventMode = 'static';
                slotContainer.cursor = 'pointer';
                const invIndex = row * cols + col;
                slotContainer.on('rightclick', () => this._onInventorySlotRightClick(invIndex));
                slotContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                    if (e.button === 0) this._onDragStart(UISource.Inventory, invIndex, e);
                });

                slotsContainer.addChild(slotContainer);
                this.inventorySlots.push({ container: slotContainer, placeholder: null, iconSprite: null, item: null, bgSprite, borderMask });
            }
        }

        this.inventoryMenuContainer.addChild(slotsContainer);

        const gridWidth = cols * (slotSize + gap) - gap;
        this._inventoryMenuWidth = margin + gridWidth + margin;
    }

    private _buildAbilityBar(slotTex: PIXI.Texture | null): void {
        const slotSize = 82;
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
                        leftWidth: 11,
                        rightWidth: 11,
                        topHeight: 11,
                        bottomHeight: 11,
                    });
                    bg.width = slotSize;
                    bg.height = slotSize;
                    bg.filters = [grayscaleFilter];

                    const borderMask = new PIXI.Graphics();
                    borderMask.rect(0, 0, slotSize, slotSize);
                    borderMask.fill({ color: 0xffffff });
                    borderMask.rect(11, 11, slotSize - 22, slotSize - 22);
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
                this.abilitySlots.push({ container: slotContainer, row, col, key: keys[row]![col]! });
            }
        }

        this.abilityBarContainer.addChild(slotsContainer);
    }

    toggleEquippedMenu(): void {
        this._equippedMenuOpen = !this._equippedMenuOpen;
    }

    toggleInventoryMenu(): void {
        this._inventoryMenuOpen = !this._inventoryMenuOpen;
    }

    layout(screenW: number, screenH: number): void {
        const margin = 20;
        const orbRadius = 105;

        this.healthOrbContainer.x = margin + orbRadius;
        this.healthOrbContainer.y = screenH - margin - orbRadius + 5;

        this.manaOrbContainer.x = screenW - margin - orbRadius;
        this.manaOrbContainer.y = screenH - margin - orbRadius + 5;

        const healthOrbRight = margin + orbRadius + 250;
        const abSlotsHeight = 2 * 82;
        this.abilityBarContainer.x = healthOrbRight;
        this.abilityBarContainer.y = screenH - abSlotsHeight;

        const eqOffX = -this._equippedMenuWidth * (1 - this._equippedMenuSlide);
        this.equippedMenuContainer.x = eqOffX;
        this.equippedMenuContainer.y = 0;

        const invOffX = screenW - this._inventoryMenuWidth * this._inventoryMenuSlide;
        this.inventoryMenuContainer.x = invOffX;
        this.inventoryMenuContainer.y = 0;
    }

    // --------------------------------------------------------------- Update

    update(character: Character, deltaMs: number = 16.67): void {
        if (!character) return;

        const healthPct = Math.max(0, Math.min(1, character.currentHealth / character.maxHealth));
        const manaPct = Math.max(0, Math.min(1, character.currentMana / character.maxMana));

        this._setOrbFill(this._healthOrbSprite, healthPct);
        this._setOrbFill(this._manaOrbSprite, manaPct);

        const slideSpeed = 8;
        const dt = deltaMs / 1000;
        const eqTarget = this._equippedMenuOpen ? 1 : 0;
        this._equippedMenuSlide += (eqTarget - this._equippedMenuSlide) * Math.min(1, slideSpeed * dt);
        if (Math.abs(this._equippedMenuSlide - eqTarget) < 0.001) this._equippedMenuSlide = eqTarget;

        const invTarget = this._inventoryMenuOpen ? 1 : 0;
        this._inventoryMenuSlide += (invTarget - this._inventoryMenuSlide) * Math.min(1, slideSpeed * dt);
        if (Math.abs(this._inventoryMenuSlide - invTarget) < 0.001) this._inventoryMenuSlide = invTarget;
    }

    // ------------------------------------------------- Equipped slot icons

    async setEquippedItem(slot: GearSlot, item: Item): Promise<void> {
        const entry = this.equippedSlots.find(s => s.slotType === slot);
        if (!entry) {
            console.warn(`UI.setEquippedItem: no slot found for "${slot}"`);
            return;
        }

        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }

        if (entry.item) {
            await entry.item.unloadIcon();
        }

        await item.loadIcon();
        const icon = item.createIcon();
        if (!icon) {
            console.warn(`UI.setEquippedItem: could not create icon for "${item.id}"`);
            return;
        }

        const slotSize = 90;
        const maxIconSize = 62;
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

    async clearEquippedItem(slot: GearSlot): Promise<void> {
        const entry = this.equippedSlots.find(s => s.slotType === slot);
        if (!entry) return;

        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
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

    // ------------------------------------------------ Inventory slot icons

    async setInventoryItem(item: Item): Promise<boolean> {
        const entry = this.inventorySlots.find(s => !s.item);
        if (!entry) {
            console.warn('UI.setInventoryItem: inventory full');
            return false;
        }
        return this._setInventorySlot(entry, item);
    }

    private async _setInventorySlot(entry: InventorySlotEntry, item: Item): Promise<boolean> {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        if (entry.item) {
            await entry.item.unloadIcon();
        }

        await item.loadIcon();
        const icon = item.createIcon();
        if (!icon) return false;

        const slotSize = 90;
        const maxIconSize = 62;
        const scale = Math.min(maxIconSize / icon.texture.width, maxIconSize / icon.texture.height);
        icon.anchor.set(0.5);
        icon.scale.set(scale);
        icon.x = slotSize / 2;
        icon.y = slotSize / 2;

        entry.container.addChild(icon);
        entry.iconSprite = icon;
        entry.item = item;

        if (entry.bgSprite) entry.bgSprite.mask = null;

        return true;
    }

    private async _clearInventorySlot(entry: InventorySlotEntry): Promise<void> {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        if (entry.item) {
            await entry.item.unloadIcon();
            entry.item = null;
        }
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
    }

    // ----------------------------------------- Right-click slot interactions

    private async _onEquippedSlotRightClick(slotType: GearSlot): Promise<void> {
        if (this._rightClickBusy) return;
        const entry = this.equippedSlots.find(s => s.slotType === slotType);
        if (!entry || !entry.item) return;

        const freeInvSlot = this.inventorySlots.find(s => !s.item);
        if (!freeInvSlot) {
            console.warn('Inventory full – cannot unequip');
            return;
        }

        this._rightClickBusy = true;
        try {
            const item = entry.item;

            await this._setInventorySlot(freeInvSlot, item);

            if (entry.iconSprite) {
                entry.container.removeChild(entry.iconSprite);
                entry.iconSprite.destroy();
                entry.iconSprite = null;
            }
            entry.item = null;
            if (entry.placeholder) entry.placeholder.visible = true;

            if (state.player) {
                await state.player.unequipSlotSilent(slotType);
            }
        } finally {
            this._rightClickBusy = false;
        }
    }

    private async _onInventorySlotRightClick(index: number): Promise<void> {
        if (this._rightClickBusy) return;
        const entry = this.inventorySlots[index];
        if (!entry || !entry.item) return;

        this._rightClickBusy = true;
        try {
            const item = entry.item;
            const slot = item.slot;

            const eqEntry = this.equippedSlots.find(s => s.slotType === slot);
            const previousItem = eqEntry?.item || null;

            await this._clearInventorySlot(entry);

            if (state.player) {
                await state.player.equipItem(item);
            }

            if (previousItem) {
                await this._setInventorySlot(entry, previousItem);
            }
        } finally {
            this._rightClickBusy = false;
        }
    }

    // --------------------------------------------------- Drag-and-drop

    private _onDragStart(source: UISource, key: string | number, e: PIXI.FederatedPointerEvent): void {
        if (this._drag) return;

        let entry: EquippedSlotEntry | InventorySlotEntry | undefined;
        let item: Item | null | undefined;
        if (source === UISource.Equipped) {
            entry = this.equippedSlots.find(s => s.slotType === key);
            item = entry?.item;
        } else {
            entry = this.inventorySlots[key as number];
            item = entry?.item;
        }
        if (!entry || !item) return;

        e.stopPropagation();

        this._hideTooltip();

        if ((entry as EquippedSlotEntry | InventorySlotEntry).iconSprite) {
            (entry as EquippedSlotEntry | InventorySlotEntry).iconSprite!.visible = false;
        }

        const dragSprite = item.createIcon();
        if (!dragSprite) return;
        const maxIconSize = 62;
        const scale = Math.min(maxIconSize / dragSprite.texture.width, maxIconSize / dragSprite.texture.height);
        dragSprite.anchor.set(0.5);
        dragSprite.scale.set(scale);
        dragSprite.alpha = 0.85;

        const pos = e.global;
        dragSprite.x = pos.x;
        dragSprite.y = pos.y;

        this.container.addChild(dragSprite);

        this._drag = { source, key, entry, sprite: dragSprite, item };

        const stage = this.container.parent!;
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

        const stage = this.container.parent!;
        if (this._onDragMoveHandler) stage.off('pointermove', this._onDragMoveHandler);
        if (this._onDragEndHandler) {
            stage.off('pointerup', this._onDragEndHandler);
            stage.off('pointerupoutside', this._onDragEndHandler);
        }

        this.container.removeChild(drag.sprite);
        drag.sprite.destroy();

        const pos = e.global;
        const target = this._hitTestSlot(pos.x, pos.y);

        let handled = false;

        if (target) {
            handled = await this._tryDrop(drag, target);
        }

        if (!handled && !this.hitTest(pos.x, pos.y)) {
            handled = await this._dropAsLoot(drag, pos.x, pos.y);
        }

        if (!handled) {
            if (drag.entry.iconSprite) {
                drag.entry.iconSprite.visible = true;
            }
        }
    }

    private _hitTestSlot(screenX: number, screenY: number): HitTestResult | null {
        for (const entry of this.equippedSlots) {
            const bounds = entry.container.getBounds();
            if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
                screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
                return { type: UISource.Equipped, entry };
            }
        }
        for (let i = 0; i < this.inventorySlots.length; i++) {
            const entry = this.inventorySlots[i]!;
            const bounds = entry.container.getBounds();
            if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
                screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
                return { type: UISource.Inventory, entry, index: i };
            }
        }
        return null;
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
                await this._clearInventorySlot(dst);
                this._detachEquippedIcon(src);

                await this.setEquippedItem(src.slotType, dstItem);
                if (player) await player.equipItem(dstItem);

                await this._setInventorySlot(dst, srcItem);
                return true;
            }

            if (!dstItem) {
                this._detachEquippedIcon(src);
                await this._setInventorySlot(dst, srcItem);
                if (player) await player.unequipSlotSilent(src.slotType);
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

            this._detachInventoryIcon(src);

            if (dstItem) {
                this._detachEquippedIconKeepData(dst);
                await this._setInventorySlot(src, dstItem);
            }

            if (player) await player.equipItem(srcItem);
            return true;
        }

        // ── Drag from INVENTORY → INVENTORY ──
        if (drag.source === UISource.Inventory && target.type === UISource.Inventory) {
            const src = srcEntry as InventorySlotEntry;
            const dst = target.entry;
            const dstItem = dst.item;

            this._detachInventoryIcon(src);
            if (dstItem) {
                this._detachInventoryIcon(dst);
                await this._setInventorySlot(src, dstItem);
            }
            await this._setInventorySlot(dst, srcItem);
            return true;
        }

        // ── Drag from EQUIPPED → EQUIPPED ──
        if (drag.source === UISource.Equipped && target.type === UISource.Equipped) {
            const src = srcEntry as EquippedSlotEntry;
            const dst = target.entry;
            const dstItem = dst.item;
            if (src.slotType !== dst.slotType) return false;

            this._detachEquippedIcon(src);
            if (dstItem) {
                this._detachEquippedIconKeepData(dst);
                await this.setEquippedItem(src.slotType, dstItem);
                if (player) await player.equipItem(dstItem);
            }
            await this.setEquippedItem(dst.slotType, srcItem);
            if (player) await player.equipItem(srcItem);
            return true;
        }

        return false;
    }

    private _detachEquippedIcon(entry: EquippedSlotEntry): void {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        entry.item = null;
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
        if (entry.placeholder) entry.placeholder.visible = true;
    }

    private _detachEquippedIconKeepData(entry: EquippedSlotEntry): void {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
    }

    private _detachInventoryIcon(entry: InventorySlotEntry): void {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        entry.item = null;
        if (entry.bgSprite && entry.borderMask) entry.bgSprite.mask = entry.borderMask;
    }

    private async _dropAsLoot(drag: DragState, screenX: number, screenY: number): Promise<boolean> {
        if (!state.area) return false;

        const item = drag.item;

        const worldX = screenX - state.area.container.x;
        const worldY = screenY - state.area.container.y;

        if (drag.source === UISource.Equipped) {
            this._detachEquippedIcon(drag.entry as EquippedSlotEntry);
        } else {
            this._detachInventoryIcon(drag.entry as InventorySlotEntry);
        }

        const loot = item.createLoot(worldX, worldY);
        await loot.loadTextures();
        state.area.container.addChild(loot.container);
        loot.attachLabelsTo(state.area.lootLabelsContainer);
        state.area.lootOnGround.push(loot);

        if (drag.source === UISource.Equipped && state.player) {
            state.player.unequipSlotSilent((drag.entry as EquippedSlotEntry).slotType);
        }

        return true;
    }

    get isDragging(): boolean {
        return this._drag !== null;
    }

    hitTest(screenX: number, screenY: number): boolean {
        const containers = [
            this.equippedMenuContainer,
            this.inventoryMenuContainer,
            this.healthOrbContainer,
            this.manaOrbContainer,
            this.abilityBarContainer,
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

    // ------------------------------------------------------------ Tooltip

    private _buildTooltip(): void {
        this._tooltipContainer = new PIXI.Container();
        this._tooltipContainer.label = 'itemTooltip';
        this._tooltipContainer.visible = false;
        this._tooltipContainer.eventMode = 'none';
        this.container.addChild(this._tooltipContainer);
    }

    private _wireSlotHoverEvents(): void {
        for (const entry of this.equippedSlots) {
            entry.container.on('pointerover', (e: PIXI.FederatedPointerEvent) => this._onSlotHover(entry, e));
            entry.container.on('pointerout', () => this._hideTooltip());
        }
        for (const entry of this.inventorySlots) {
            entry.container.on('pointerover', (e: PIXI.FederatedPointerEvent) => this._onSlotHover(entry, e));
            entry.container.on('pointerout', () => this._hideTooltip());
        }
    }

    private _onSlotHover(entry: EquippedSlotEntry | InventorySlotEntry, e: PIXI.FederatedPointerEvent): void {
        if (!entry.item) {
            this._hideTooltip();
            return;
        }
        if (this._drag) return;

        this._showTooltip(entry.item, e.global.x, e.global.y);
    }

    private _showTooltip(item: Item, screenX: number, screenY: number): void {
        if (!this._tooltipContainer) return;
        this._tooltipItem = item;
        this._tooltipVisible = true;

        this._tooltipContainer.removeChildren();

        const pad = 12;
        const innerWidth = 220;
        let yOffset = pad;

        const nameText = new PIXI.Text({
            text: item.name,
            style: {
                fontFamily: 'Cinzel, serif',
                fontSize: 18,
                fontWeight: '600',
                fill: 0xFFD700,
                wordWrap: true,
                wordWrapWidth: innerWidth,
                stroke: { color: 0x000000, width: 2 },
            },
        });
        nameText.x = pad;
        nameText.y = yOffset;
        this._tooltipContainer.addChild(nameText);
        yOffset += nameText.height + 4;

        const slotLabel = item.slot.charAt(0).toUpperCase() + item.slot.slice(1);
        const slotText = new PIXI.Text({
            text: slotLabel,
            style: {
                fontFamily: 'Grenze, serif',
                fontSize: 14,
                fontStyle: 'italic',
                fill: 0xAAAAAA,
                stroke: { color: 0x000000, width: 1 },
            },
        });
        slotText.x = pad;
        slotText.y = yOffset;
        this._tooltipContainer.addChild(slotText);
        yOffset += slotText.height + 6;

        const baseEntries = Object.entries(item.baseStats);
        if (baseEntries.length > 0) {
            for (const [key, value] of baseEntries) {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c: string) => c.toUpperCase());
                const statText = new PIXI.Text({
                    text: `+${value} ${label}`,
                    style: {
                        fontFamily: 'Grenze, serif',
                        fontSize: 15,
                        fontWeight: '600',
                        fill: 0xFFFFFF,
                        stroke: { color: 0x000000, width: 1 },
                    },
                });
                statText.x = pad;
                statText.y = yOffset;
                this._tooltipContainer.addChild(statText);
                yOffset += statText.height + 2;
            }
            yOffset += 4;
        }

        if (item.mods && item.mods.length > 0) {
            const sepLine = new PIXI.Graphics();
            sepLine.moveTo(pad, yOffset);
            sepLine.lineTo(pad + innerWidth, yOffset);
            sepLine.stroke({ width: 1, color: 0x5566AA, alpha: 0.6 });
            this._tooltipContainer.addChild(sepLine);
            yOffset += 6;

            for (const modDesc of item.modDescriptions) {
                const modText = new PIXI.Text({
                    text: modDesc,
                    style: {
                        fontFamily: 'Grenze, serif',
                        fontSize: 15,
                        fontWeight: '600',
                        fill: 0x66CCFF,
                        wordWrap: true,
                        wordWrapWidth: innerWidth,
                        stroke: { color: 0x000000, width: 1 },
                    },
                });
                modText.x = pad;
                modText.y = yOffset;
                this._tooltipContainer.addChild(modText);
                yOffset += modText.height + 2;
            }
            yOffset += 2;
        }

        if (item.description) {
            const sepLine2 = new PIXI.Graphics();
            sepLine2.moveTo(pad, yOffset);
            sepLine2.lineTo(pad + innerWidth, yOffset);
            sepLine2.stroke({ width: 1, color: 0x5566AA, alpha: 0.4 });
            this._tooltipContainer.addChild(sepLine2);
            yOffset += 6;

            const descText = new PIXI.Text({
                text: item.description,
                style: {
                    fontFamily: 'Grenze, serif',
                    fontSize: 14,
                    fontStyle: 'italic',
                    fill: 0x999999,
                    wordWrap: true,
                    wordWrapWidth: innerWidth,
                    stroke: { color: 0x000000, width: 1 },
                },
            });
            descText.x = pad;
            descText.y = yOffset;
            this._tooltipContainer.addChild(descText);
            yOffset += descText.height + 2;
        }

        yOffset += pad;

        const totalWidth = innerWidth + pad * 2;
        const totalHeight = yOffset;
        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, totalWidth, totalHeight, 6);
        bg.fill({ color: 0x111122, alpha: 0.92 });
        bg.roundRect(0, 0, totalWidth, totalHeight, 6);
        bg.stroke({ width: 1.5, color: 0x4455AA, alpha: 0.7 });

        this._tooltipContainer.addChildAt(bg, 0);

        this._positionTooltip(screenX, screenY, totalWidth, totalHeight);
        this._tooltipContainer.visible = true;
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

        this._tooltipContainer!.x = tx;
        this._tooltipContainer!.y = ty;
    }

    private _hideTooltip(): void {
        if (this._tooltipContainer) {
            this._tooltipContainer.visible = false;
        }
        this._tooltipItem = null;
        this._tooltipVisible = false;
    }
}

export { UI };
export type { EquippedSlotEntry, InventorySlotEntry, AbilitySlotEntry, DragState };
