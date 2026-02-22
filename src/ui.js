/**
 * HUD overlay – health orb (bottom-left) and mana orb (bottom-right).
 *
 * Layer order per orb (back → front):
 *   1. orbcoverback             – rear frame (backmost)
 *   2. healthorb/manaorb        – liquid fill (tinted red / blue)
 *   3. orbcoverfront            – front frame
 *   4. healthcover/manacover   – orb cover
 *   5. healthstatue/manastatue – decorative statue (frontmost)
 *
 * The whole HUD lives in a PIXI.Container added directly to `app.stage`
 * so it stays fixed on screen regardless of camera movement.
 */
class UI {
    constructor() {
        /** Root container – added to app.stage (not the world container). */
        this.container = new PIXI.Container();
        this.container.label = 'hud';

        // Orb sub-containers
        this.healthOrbContainer = new PIXI.Container();
        this.healthOrbContainer.label = 'healthOrb';
        this.manaOrbContainer = new PIXI.Container();
        this.manaOrbContainer.label = 'manaOrb';

        this.container.addChild(this.healthOrbContainer);
        this.container.addChild(this.manaOrbContainer);

        // ---- Equipped-items menu (upper-left, slides in from left) ----
        this.equippedMenuContainer = new PIXI.Container();
        this.equippedMenuContainer.label = 'equippedMenu';
        this.container.addChild(this.equippedMenuContainer);

        // ---- Inventory menu (right side, slides in from right) ----
        this.inventoryMenuContainer = new PIXI.Container();
        this.inventoryMenuContainer.label = 'inventoryMenu';
        this.container.addChild(this.inventoryMenuContainer);

        // Menu visibility state
        this._equippedMenuOpen = false;
        this._inventoryMenuOpen = false;

        // Slide animation progress (0 = hidden, 1 = fully visible)
        this._equippedMenuSlide = 0;
        this._inventoryMenuSlide = 0;

        // Computed widths for slide offset (set after build)
        this._equippedMenuWidth = 0;
        this._inventoryMenuWidth = 0;

        /** Slot arrays for external access (e.g. drag-and-drop). */
        this.equippedSlots = [];   // { container, placeholder, slotType, iconSprite, item }
        this.inventorySlots = [];  // { container, placeholder, iconSprite, item }

        /** Guard to prevent overlapping right-click operations */
        this._rightClickBusy = false;

        // ---- Drag-and-drop state ----
        /** @type {{ source: 'equipped'|'inventory', entry: object, sprite: PIXI.Sprite, item: Item }|null} */
        this._drag = null;

        // References to key sprites (set during load)
        this._healthOrbSprite = null;
        this._manaOrbSprite = null;

        // Orb fill dimensions (set after textures load)
        this._orbHeight = 0;
    }

    // ------------------------------------------------------------------ Load

    /**
     * Load all orb-related spritesheets and assemble the HUD sprites.
     * Call once during game init *after* the PIXI.Application is ready.
     */
    async load() {
        // Helpers to load a single-frame spritesheet and return the first texture
        const manifest = await fetch('./images/spritesheets/manifest.json').then(r => r.json());

        const loadTexture = async (key) => {
            const sheets = manifest[key] || [];
            for (const sheetPath of sheets) {
                const fullPath = `./images/spritesheets/${sheetPath.replace('./', '')}`;
                const spritesheet = await PIXI.Assets.load(fullPath);
                const names = Object.keys(spritesheet.textures);
                if (names.length > 0) return spritesheet.textures[names[0]];
            }
            console.warn(`UI: no texture found for "${key}"`);
            return null;
        };

        // Load textures in parallel
        const [
            orbcoverbackTex,
            orbcoverfrontTex,
            healthorbTex,
            manaorbTex,
            healthcoverTex,
            manacoverTex,
            healthstatueTex,
            manastatueTex,
            // Equipped menu textures
            charactermenuTex,
            equippedmenustatueTex,
            headplaceholderTex,
            chestplaceholderTex,
            handsplaceholderTex,
            legsplaceholderTex,
            feetplaceholderTex,
            mainhandplaceholderTex,
            offhandplaceholderTex,
            neckplaceholderTex,
            ringplaceholderTex,
            // Inventory menu textures
            slotTex,
            inventorymenustatueTex,
        ] = await Promise.all([
            loadTexture('orbcoverback'),
            loadTexture('orbcoverfront'),
            loadTexture('healthorb'),
            loadTexture('manaorb'),
            loadTexture('healthcover'),
            loadTexture('manacover'),
            loadTexture('healthstatue'),
            loadTexture('manastatue'),
            // Equipped menu
            loadTexture('charactermenu'),
            loadTexture('equippedmenustatue'),
            loadTexture('headplaceholder'),
            loadTexture('chestplaceholder'),
            loadTexture('handsplaceholder'),
            loadTexture('legsplaceholder'),
            loadTexture('feetplaceholder'),
            loadTexture('mainhandplaceholder'),
            loadTexture('offhandplaceholder'),
            loadTexture('neckplaceholder'),
            loadTexture('ringplaceholder'),
            // Inventory menu
            loadTexture('slot'),
            loadTexture('inventorymenustatue'),
        ]);

        // Reset default anchors on slot textures so NineSliceSprite renders from (0,0)
        if (charactermenuTex) charactermenuTex.defaultAnchor = { x: 0, y: 0 };
        if (slotTex) slotTex.defaultAnchor = { x: 0, y: 0 };

        // ---- Health orb (bottom‑left) ----
        this._buildOrb(this.healthOrbContainer, {
            coverBackTex: orbcoverbackTex,
            coverFrontTex: orbcoverfrontTex,
            orbTex: healthorbTex,
            coverTex: healthcoverTex,
            statueTex: healthstatueTex,
            statueOffsetX: 155,
            statueOffsetY: 0,
            tint: 0xff4444,    // red
        });

        // ---- Mana orb (bottom‑right) ----
        this._buildOrb(this.manaOrbContainer, {
            coverBackTex: orbcoverbackTex,
            coverFrontTex: orbcoverfrontTex,
            orbTex: manaorbTex,
            coverTex: manacoverTex,
            statueTex: manastatueTex,
            statueOffsetX: -150,
            statueOffsetY: 0,
            tint: 0x4488ff,    // blue
        });

        // Store orb height for fill calculations
        if (healthorbTex) this._orbHeight = healthorbTex.height;

        // ---- Equipped-items menu (2 cols × 5 rows, statue on right) ----
        const equippedPlaceholders = [
            // Column 0 (left – armour)       Column 1 (right – accessories/weapons)
            { col: 0, row: 0, tex: headplaceholderTex,     type: 'head' },
            { col: 0, row: 1, tex: chestplaceholderTex,    type: 'chest' },
            { col: 0, row: 2, tex: handsplaceholderTex,    type: 'hands' },
            { col: 0, row: 3, tex: legsplaceholderTex,     type: 'legs' },
            { col: 0, row: 4, tex: feetplaceholderTex,     type: 'feet' },
            { col: 1, row: 0, tex: mainhandplaceholderTex, type: 'mainhand' },
            { col: 1, row: 1, tex: offhandplaceholderTex,  type: 'offhand' },
            { col: 1, row: 2, tex: neckplaceholderTex,     type: 'neck' },
            { col: 1, row: 3, tex: ringplaceholderTex,     type: 'ring' },
            { col: 1, row: 4, tex: ringplaceholderTex,     type: 'ring2' },
        ];
        this._buildEquippedMenu(charactermenuTex, equippedmenustatueTex, equippedPlaceholders);

        // ---- Inventory menu (5 cols × 5 rows, statue on left) ----
        this._buildInventoryMenu(slotTex, inventorymenustatueTex, 5, 5);

        // Initial layout
        this.layout(window.innerWidth, window.innerHeight);
    }

    // ---------------------------------------------------------- Build helpers

    /**
     * Assemble one orb's sprite stack inside the given container.
     */
    _buildOrb(container, { coverBackTex, coverFrontTex, orbTex, coverTex, statueTex, statueOffsetX = 0, statueOffsetY = 0, tint }) {
        // Back → front: statue, orbcoverback, orb, orbcoverfront, cover

        // 1. Statue decoration (backmost) – offset toward the inner screen edge
        if (statueTex) {
            const statue = new PIXI.Sprite(statueTex);
            statue.anchor.set(0.5);
            statue.label = 'statue';
            statue.x = statueOffsetX;
            statue.y = statueOffsetY;
            container.addChild(statue);
        }

        // 2. Orb cover back
        if (coverBackTex) {
            const back = new PIXI.Sprite(coverBackTex);
            back.anchor.set(0.5);
            back.label = 'coverBack';
            container.addChild(back);
        }

        // 3. Orb fill (healthorb / manaorb)
        if (orbTex) {
            const orb = new PIXI.Sprite(orbTex);
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

        // 4. Orb cover front
        if (coverFrontTex) {
            const front = new PIXI.Sprite(coverFrontTex);
            front.anchor.set(0.5);
            front.label = 'coverFront';
            container.addChild(front);
        }

        // 5. Orb cover (healthcover / manacover) (frontmost)
        if (coverTex) {
            const cover = new PIXI.Sprite(coverTex);
            cover.anchor.set(0.5);
            cover.label = 'cover';
            container.addChild(cover);
        }
    }

    // -------------------------------------------------------------- Layout

    /**
     * Build the equipped-items menu: 2 cols × 5 rows of charactermenu slots
     * with placeholder icons, and the equippedmenustatue on the right.
     */
    _buildEquippedMenu(slotTex, statueTex, placeholders) {
        const slotSize = 90;    // slot display size
        const gap = 4;          // pixels between slots
        const cols = 2;
        const rows = 5;
        const margin = 10;      // padding inside the menu

        // Slots grid
        const slotsContainer = new PIXI.Container();
        slotsContainer.label = 'equippedSlots';
        slotsContainer.x = margin;
        slotsContainer.y = margin;

        for (const ph of placeholders) {
            const slotContainer = new PIXI.Container();
            slotContainer.label = `slot_${ph.type}`;
            slotContainer.x = ph.col * (slotSize + gap);
            slotContainer.y = ph.row * (slotSize + gap);

            // Slot background (9-patch with 14px margins)
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
                bg.tint = 0x4757FF; // rgb(71, 87, 255)
                slotContainer.addChild(bg);
            }

            // Placeholder icon (centred in slot, forced to 62×62)
            let placeholderSprite = null;
            if (ph.tex) {
                placeholderSprite = new PIXI.Sprite(ph.tex);
                placeholderSprite.anchor.set(0.5);
                placeholderSprite.width = 62;
                placeholderSprite.height = 62;
                placeholderSprite.x = slotSize / 2;
                placeholderSprite.y = slotSize / 2;
                slotContainer.addChild(placeholderSprite);
            }

            // Make slot interactive for right-click and drag
            slotContainer.eventMode = 'static';
            slotContainer.cursor = 'pointer';
            const slotType = ph.type;
            slotContainer.on('rightclick', () => this._onEquippedSlotRightClick(slotType));
            slotContainer.on('pointerdown', (e) => {
                if (e.button === 0) this._onDragStart('equipped', slotType, e);
            });

            slotsContainer.addChild(slotContainer);
            this.equippedSlots.push({ container: slotContainer, placeholder: placeholderSprite, slotType: ph.type, iconSprite: null, item: null });
        }

        this.equippedMenuContainer.addChild(slotsContainer);

        // Statue on the right side
        if (statueTex) {
            const statue = new PIXI.Sprite(statueTex);
            statue.anchor.set(0, 0.5);
            statue.x = margin + cols * (slotSize + gap) - gap + 4;
            statue.y = margin + (rows * (slotSize + gap) - gap) / 2;
            statue.label = 'equippedStatue';
            this.equippedMenuContainer.addChild(statue);
        }

        // Calculate total width for slide animation
        const gridWidth = cols * (slotSize + gap) - gap;
        const statueWidth = statueTex ? statueTex.width + 4 : 0;
        this._equippedMenuWidth = margin + gridWidth + statueWidth + margin;
    }

    /**
     * Build the inventory menu: cols × rows grid of slot sprites
     * with the inventorymenustatue on the left.
     */
    _buildInventoryMenu(slotTex, statueTex, cols, rows) {
        const slotSize = 90;
        const gap = 4;
        const margin = 10;

        // Statue on the left side
        let statueWidth = 0;
        if (statueTex) {
            const statue = new PIXI.Sprite(statueTex);
            statue.anchor.set(1, 0.5);
            statue.label = 'inventoryStatue';
            statueWidth = statueTex.width + 4;
            statue.x = margin + statueWidth;
            statue.y = margin + (rows * (slotSize + gap) - gap) / 2;
            this.inventoryMenuContainer.addChild(statue);
        }

        // Slots grid
        const slotsContainer = new PIXI.Container();
        slotsContainer.label = 'inventorySlots';
        slotsContainer.x = margin + statueWidth;
        slotsContainer.y = margin;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotContainer = new PIXI.Container();
                slotContainer.label = `invSlot_${row}_${col}`;
                slotContainer.x = col * (slotSize + gap);
                slotContainer.y = row * (slotSize + gap);

                // Slot background (9-patch with 14px margins)
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
                    bg.tint = 0xFFC8C8; // rgb(255, 200, 200)
                    slotContainer.addChild(bg);
                }

                // Make slot interactive for right-click and drag
                slotContainer.eventMode = 'static';
                slotContainer.cursor = 'pointer';
                const invIndex = row * cols + col;
                slotContainer.on('rightclick', () => this._onInventorySlotRightClick(invIndex));
                slotContainer.on('pointerdown', (e) => {
                    if (e.button === 0) this._onDragStart('inventory', invIndex, e);
                });

                slotsContainer.addChild(slotContainer);
                this.inventorySlots.push({ container: slotContainer, placeholder: null, iconSprite: null, item: null });
            }
        }

        this.inventoryMenuContainer.addChild(slotsContainer);

        // Calculate total width for slide animation
        const gridWidth = cols * (slotSize + gap) - gap;
        this._inventoryMenuWidth = margin + statueWidth + gridWidth + margin;
    }

    /** Toggle the equipped-items menu open/closed. */
    toggleEquippedMenu() {
        this._equippedMenuOpen = !this._equippedMenuOpen;
    }

    /** Toggle the inventory menu open/closed. */
    toggleInventoryMenu() {
        this._inventoryMenuOpen = !this._inventoryMenuOpen;
    }

    /**
     * Reposition the orbs based on the current screen size.
     * @param {number} screenW - current screen/canvas width
     * @param {number} screenH - current screen/canvas height
     */
    layout(screenW, screenH) {
        const margin = 20;
        const orbRadius = 105; // half of 210

        // Health orb – bottom‑left
        this.healthOrbContainer.x = margin + orbRadius;
        this.healthOrbContainer.y = screenH - margin - orbRadius;

        // Mana orb – bottom‑right
        this.manaOrbContainer.x = screenW - margin - orbRadius;
        this.manaOrbContainer.y = screenH - margin - orbRadius;

        // Equipped menu – upper-left, slides in from left
        // At slide=0 the menu is fully off-screen; at slide=1 it's at x=0
        const eqOffX = -this._equippedMenuWidth * (1 - this._equippedMenuSlide);
        this.equippedMenuContainer.x = eqOffX;
        this.equippedMenuContainer.y = 0;

        // Inventory menu – upper-right area, slides in from right
        const invOffX = screenW - this._inventoryMenuWidth * this._inventoryMenuSlide;
        this.inventoryMenuContainer.x = invOffX;
        this.inventoryMenuContainer.y = 0;
    }

    // --------------------------------------------------------------- Update

    /**
     * Update orb fill levels, animate menu slides, and other per-frame effects.
     * Call every frame.
     * @param {Character} character
     * @param {number} [deltaMs] – milliseconds since last frame (defaults to 16.67)
     */
    update(character, deltaMs = 16.67) {
        if (!character) return;

        const healthPct = Math.max(0, Math.min(1, character.currentHealth / character.maxHealth));
        const manaPct = Math.max(0, Math.min(1, character.currentMana / character.maxMana));

        this._setOrbFill(this._healthOrbSprite, healthPct);
        this._setOrbFill(this._manaOrbSprite, manaPct);

        // Animate menu slides (ease toward target)
        const slideSpeed = 8; // per-second factor (higher = snappier)
        const dt = deltaMs / 1000;
        const eqTarget = this._equippedMenuOpen ? 1 : 0;
        this._equippedMenuSlide += (eqTarget - this._equippedMenuSlide) * Math.min(1, slideSpeed * dt);
        if (Math.abs(this._equippedMenuSlide - eqTarget) < 0.001) this._equippedMenuSlide = eqTarget;

        const invTarget = this._inventoryMenuOpen ? 1 : 0;
        this._inventoryMenuSlide += (invTarget - this._inventoryMenuSlide) * Math.min(1, slideSpeed * dt);
        if (Math.abs(this._inventoryMenuSlide - invTarget) < 0.001) this._inventoryMenuSlide = invTarget;
    }

    // ------------------------------------------------- Equipped slot icons

    /**
     * Place an item's icon into the matching equipped slot and hide the placeholder.
     * @param {string} slot  - Equipment slot name (head, chest, legs, …)
     * @param {Item}   item  - The Item whose icon should be displayed
     */
    async setEquippedItem(slot, item) {
        const entry = this.equippedSlots.find(s => s.slotType === slot);
        if (!entry) {
            console.warn(`UI.setEquippedItem: no slot found for "${slot}"`);
            return;
        }

        // Remove any existing icon sprite first
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }

        // Unload previous item's icon assets
        if (entry.item) {
            await entry.item.unloadIcon();
        }

        // Load and create the new icon
        await item.loadIcon();
        const icon = item.createIcon();
        if (!icon) {
            console.warn(`UI.setEquippedItem: could not create icon for "${item.id}"`);
            return;
        }

        // Size and centre it in the slot (same treatment as placeholder: 62×62)
        const slotSize = 90;
        icon.anchor.set(0.5);
        icon.width = 62;
        icon.height = 62;
        icon.x = slotSize / 2;
        icon.y = slotSize / 2;

        entry.container.addChild(icon);
        entry.iconSprite = icon;
        entry.item = item;

        // Hide the placeholder
        if (entry.placeholder) {
            entry.placeholder.visible = false;
        }
    }

    /**
     * Remove the item icon from a slot and restore the placeholder.
     * @param {string} slot - Equipment slot name
     */
    async clearEquippedItem(slot) {
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

        // Restore the placeholder
        if (entry.placeholder) {
            entry.placeholder.visible = true;
        }
    }

    // ------------------------------------------------ Inventory slot icons

    /**
     * Place an item's icon into the first available inventory slot.
     * @param {Item} item - The Item whose icon should be displayed
     * @returns {boolean} true if placed, false if inventory is full
     */
    async setInventoryItem(item) {
        const entry = this.inventorySlots.find(s => !s.item);
        if (!entry) {
            console.warn('UI.setInventoryItem: inventory full');
            return false;
        }
        return this._setInventorySlot(entry, item);
    }

    /**
     * Place an item icon into a specific inventory slot entry.
     * @param {object} entry - inventorySlots entry
     * @param {Item}   item
     * @returns {boolean}
     */
    async _setInventorySlot(entry, item) {
        // Remove any existing icon
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
        icon.anchor.set(0.5);
        icon.width = 62;
        icon.height = 62;
        icon.x = slotSize / 2;
        icon.y = slotSize / 2;

        entry.container.addChild(icon);
        entry.iconSprite = icon;
        entry.item = item;
        return true;
    }

    /**
     * Remove the item icon from a specific inventory slot and free resources.
     * @param {object} entry - inventorySlots entry
     */
    async _clearInventorySlot(entry) {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        if (entry.item) {
            await entry.item.unloadIcon();
            entry.item = null;
        }
    }

    // ----------------------------------------- Right-click slot interactions

    /**
     * Right-click on an equipped slot → unequip item, send to first open
     * inventory slot.
     */
    async _onEquippedSlotRightClick(slotType) {
        if (this._rightClickBusy) return;
        const entry = this.equippedSlots.find(s => s.slotType === slotType);
        if (!entry || !entry.item) return; // nothing equipped (or default gear)

        // Check there is room in the inventory
        const freeInvSlot = this.inventorySlots.find(s => !s.item);
        if (!freeInvSlot) {
            console.warn('Inventory full – cannot unequip');
            return;
        }

        this._rightClickBusy = true;
        try {
            const item = entry.item;

            // 1. Place item icon in inventory
            await this._setInventorySlot(freeInvSlot, item);

            // 2. Clear the equipped slot icon & restore placeholder
            //    (don't unload icon – inventory now owns it; just detach sprite)
            if (entry.iconSprite) {
                entry.container.removeChild(entry.iconSprite);
                entry.iconSprite.destroy();
                entry.iconSprite = null;
            }
            entry.item = null;
            if (entry.placeholder) entry.placeholder.visible = true;

            // 3. Tell the player to swap back to default gear
            if (player) {
                await player.unequipSlotSilent(slotType);
            }
        } finally {
            this._rightClickBusy = false;
        }
    }

    /**
     * Right-click on an inventory slot → equip the item in its matching
     * equipment slot.
     */
    async _onInventorySlotRightClick(index) {
        if (this._rightClickBusy) return;
        const entry = this.inventorySlots[index];
        if (!entry || !entry.item) return;

        this._rightClickBusy = true;
        try {
            const item = entry.item;
            const slot = item.slot;

            // If something is already equipped in that slot (non-default),
            // swap it into the inventory slot we're freeing.
            const eqEntry = this.equippedSlots.find(s => s.slotType === slot);
            const previousItem = eqEntry?.item || null;

            // 1. Clear this inventory slot
            await this._clearInventorySlot(entry);

            // 2. Equip the item on the player (handles gear swap & UI equipped icon)
            if (player) {
                await player.equipItem(item);
            }

            // 3. If there was a previously equipped non-default item, put it
            //    into the inventory slot we just freed
            if (previousItem) {
                await this._setInventorySlot(entry, previousItem);
            }
        } finally {
            this._rightClickBusy = false;
        }
    }

    // --------------------------------------------------- Drag-and-drop

    /**
     * Begin dragging an item out of its slot.
     * @param {'equipped'|'inventory'} source
     * @param {string|number} key - slotType (equipped) or index (inventory)
     * @param {PIXI.FederatedPointerEvent} e
     */
    _onDragStart(source, key, e) {
        if (this._drag) return; // already dragging

        let entry, item;
        if (source === 'equipped') {
            entry = this.equippedSlots.find(s => s.slotType === key);
            item = entry?.item;
        } else {
            entry = this.inventorySlots[key];
            item = entry?.item;
        }
        if (!entry || !item) return;

        // Stop the event from propagating to the stage (prevents player movement)
        e.stopPropagation();

        // Hide the icon in the source slot (but keep the entry data so we can snap back)
        if (entry.iconSprite) {
            entry.iconSprite.visible = false;
        }

        // Create a floating sprite that follows the cursor
        const dragSprite = item.createIcon();
        if (!dragSprite) return;
        dragSprite.anchor.set(0.5);
        dragSprite.width = 62;
        dragSprite.height = 62;
        dragSprite.alpha = 0.85;

        const pos = e.global;
        dragSprite.x = pos.x;
        dragSprite.y = pos.y;

        // Add to the top-level HUD container so it renders above everything
        this.container.addChild(dragSprite);

        this._drag = { source, key, entry, sprite: dragSprite, item };

        // Listen on stage for move / up so we capture events everywhere
        const stage = this.container.parent; // app.stage
        stage.on('pointermove', this._onDragMoveHandler = (ev) => this._onDragMove(ev));
        stage.on('pointerup', this._onDragEndHandler = (ev) => this._onDragEnd(ev));
        stage.on('pointerupoutside', this._onDragEndHandler);
    }

    /** Update drag sprite position. */
    _onDragMove(e) {
        if (!this._drag) return;
        const pos = e.global;
        this._drag.sprite.x = pos.x;
        this._drag.sprite.y = pos.y;
    }

    /**
     * Finish the drag: hit-test against all slots, validate, and either
     * place the item or snap it back.
     */
    async _onDragEnd(e) {
        if (!this._drag) return;
        const drag = this._drag;
        this._drag = null;

        // Remove stage listeners
        const stage = this.container.parent;
        stage.off('pointermove', this._onDragMoveHandler);
        stage.off('pointerup', this._onDragEndHandler);
        stage.off('pointerupoutside', this._onDragEndHandler);

        // Remove the floating sprite
        this.container.removeChild(drag.sprite);
        drag.sprite.destroy();

        // Hit-test: find which slot (if any) the pointer is over
        const pos = e.global;
        const target = this._hitTestSlot(pos.x, pos.y);

        let handled = false;

        if (target) {
            handled = await this._tryDrop(drag, target);
        }

        // If not dropped on a valid slot and not over any UI element,
        // drop the item into the game world as loot
        if (!handled && !this.hitTest(pos.x, pos.y)) {
            handled = await this._dropAsLoot(drag, pos.x, pos.y);
        }

        // Snap back if drop was invalid
        if (!handled) {
            if (drag.entry.iconSprite) {
                drag.entry.iconSprite.visible = true;
            }
        }
    }

    /**
     * Hit-test a screen position against all equipped and inventory slot containers.
     * @returns {{ type: 'equipped'|'inventory', entry: object, index?: number }|null}
     */
    _hitTestSlot(screenX, screenY) {
        // Check equipped slots
        for (const entry of this.equippedSlots) {
            const bounds = entry.container.getBounds();
            if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
                screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
                return { type: 'equipped', entry };
            }
        }
        // Check inventory slots
        for (let i = 0; i < this.inventorySlots.length; i++) {
            const entry = this.inventorySlots[i];
            const bounds = entry.container.getBounds();
            if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
                screenY >= bounds.y && screenY <= bounds.y + bounds.height) {
                return { type: 'inventory', entry, index: i };
            }
        }
        return null;
    }

    /**
     * Attempt to drop the dragged item onto a target slot.
     * @returns {boolean} true if the drop was valid and executed
     */
    async _tryDrop(drag, target) {
        const srcEntry = drag.entry;
        const srcItem = drag.item;
        const dstEntry = target.entry;

        // Dropped back onto the same slot → snap back
        if (srcEntry === dstEntry) {
            return false; // treat as no-op, snap back handled by caller
        }

        // ── Drag from EQUIPPED → INVENTORY ──
        if (drag.source === 'equipped' && target.type === 'inventory') {
            const dstItem = dstEntry.item;

            // If target inventory slot has an item of the SAME slot type, swap
            if (dstItem && dstItem.slot === srcItem.slot) {
                // Clear both visuals
                await this._clearInventorySlot(dstEntry);
                this._detachEquippedIcon(srcEntry);

                // Place the inventory item into the equipped slot
                await this.setEquippedItem(srcEntry.slotType, dstItem);
                if (player) await player.equipItem(dstItem);

                // Place the equipped item into the inventory slot
                await this._setInventorySlot(dstEntry, srcItem);
                return true;
            }

            // If target is empty, just move it
            if (!dstItem) {
                this._detachEquippedIcon(srcEntry);
                await this._setInventorySlot(dstEntry, srcItem);
                if (player) await player.unequipSlotSilent(srcEntry.slotType);
                return true;
            }

            // Target has an item of a different slot type → invalid
            return false;
        }

        // ── Drag from INVENTORY → EQUIPPED ──
        if (drag.source === 'inventory' && target.type === 'equipped') {
            // The item must match the equipped slot type
            if (srcItem.slot !== dstEntry.slotType) return false;

            const dstItem = dstEntry.item;

            // Clear source inventory visual
            this._detachInventoryIcon(srcEntry);

            // If equipped slot has an item, swap it back to the source inv slot
            if (dstItem) {
                // Clear equipped visual
                this._detachEquippedIconKeepData(dstEntry);
                await this._setInventorySlot(srcEntry, dstItem);
            }

            // Equip the dragged item
            if (player) await player.equipItem(srcItem);
            // setEquippedItem is called inside equipItem → done
            return true;
        }

        // ── Drag from INVENTORY → INVENTORY ──
        if (drag.source === 'inventory' && target.type === 'inventory') {
            const dstItem = dstEntry.item;

            // Swap contents (or just move)
            this._detachInventoryIcon(srcEntry);
            if (dstItem) {
                this._detachInventoryIcon(dstEntry);
                await this._setInventorySlot(srcEntry, dstItem);
            }
            await this._setInventorySlot(dstEntry, srcItem);
            return true;
        }

        // ── Drag from EQUIPPED → EQUIPPED ──
        if (drag.source === 'equipped' && target.type === 'equipped') {
            // Only valid if both slots accept the same slot type AND the
            // target has an item of matching types
            const dstItem = dstEntry.item;
            if (srcEntry.slotType !== dstEntry.slotType) return false;

            // Swap
            this._detachEquippedIcon(srcEntry);
            if (dstItem) {
                this._detachEquippedIconKeepData(dstEntry);
                await this.setEquippedItem(srcEntry.slotType, dstItem);
                if (player) await player.equipItem(dstItem);
            }
            await this.setEquippedItem(dstEntry.slotType, srcItem);
            if (player) await player.equipItem(srcItem);
            return true;
        }

        return false;
    }

    /** Remove icon sprite from an equipped slot and restore placeholder (clears entry data). */
    _detachEquippedIcon(entry) {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        entry.item = null;
        if (entry.placeholder) entry.placeholder.visible = true;
    }

    /** Remove icon sprite from an equipped slot but keep the item ref for swapping. */
    _detachEquippedIconKeepData(entry) {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        // item is NOT cleared – caller will use it
    }

    /** Remove icon sprite from an inventory slot (clears entry data). */
    _detachInventoryIcon(entry) {
        if (entry.iconSprite) {
            entry.container.removeChild(entry.iconSprite);
            entry.iconSprite.destroy();
            entry.iconSprite = null;
        }
        entry.item = null;
    }

    /**
     * Drop a dragged item into the game world as loot at the pointer position.
     * @param {object} drag - drag state
     * @param {number} screenX
     * @param {number} screenY
     * @returns {boolean} true if successfully dropped
     */
    async _dropAsLoot(drag, screenX, screenY) {
        if (!area) return false;

        const item = drag.item;

        // Convert screen position to world coordinates
        const worldX = screenX - area.container.x;
        const worldY = screenY - area.container.y;

        // Clear the slot icon immediately
        if (drag.source === 'equipped') {
            this._detachEquippedIcon(drag.entry);
        } else {
            this._detachInventoryIcon(drag.entry);
        }

        // Spawn loot in the world immediately
        const loot = item.createLoot(worldX, worldY);
        await loot.loadTextures();
        area.container.addChild(loot.container);
        area.lootOnGround.push(loot);

        // Unequip gear in the background (visual only, non-blocking)
        if (drag.source === 'equipped' && player) {
            player.unequipSlotSilent(drag.entry.slotType);
        }

        return true;
    }

    /** Whether a drag is currently in progress (used by game loop). */
    get isDragging() {
        return this._drag !== null;
    }

    /**
     * Returns true if the given screen position is over any visible UI element
     * (equipped menu, inventory menu, health orb, mana orb).
     * Used by the game loop to suppress player movement on UI clicks.
     * @param {number} screenX
     * @param {number} screenY
     * @returns {boolean}
     */
    hitTest(screenX, screenY) {
        const containers = [
            this.equippedMenuContainer,
            this.inventoryMenuContainer,
            this.healthOrbContainer,
            this.manaOrbContainer,
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

    /**
     * Visually represent fill by cropping the orb sprite from the top.
     * A percentage of 1 shows the full orb; 0 hides it completely.
     */
    _setOrbFill(orbSprite, pct) {
        if (!orbSprite || !orbSprite.texture) return;

        const tex = orbSprite.texture;
        const fullH = tex.source.height;
        const fullW = tex.source.width;

        // Crop from the top – show only the bottom `pct` portion
        const visibleH = Math.round(fullH * pct);
        const yOffset = fullH - visibleH;

        // Create a sub-rectangle of the original texture
        const frame = new PIXI.Rectangle(0, yOffset, fullW, visibleH);
        const trimmedTex = new PIXI.Texture({ source: tex.source, frame });

        orbSprite.texture = trimmedTex;

        // Shift the sprite down so the visible portion stays at the bottom of the orb
        orbSprite.anchor.set(0.5, 0.5);
        orbSprite.y = yOffset / 2;
    }
}
