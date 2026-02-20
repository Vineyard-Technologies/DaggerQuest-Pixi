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
        this.equippedSlots = [];   // { container, placeholder, slotType }
        this.inventorySlots = [];  // { container, placeholder }

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
        const manifest = await fetch('./spritesheets/manifest.json').then(r => r.json());

        const loadTexture = async (key) => {
            const sheets = manifest[key] || [];
            for (const sheetPath of sheets) {
                const fullPath = `./spritesheets/${sheetPath.replace('./', '')}`;
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

            slotsContainer.addChild(slotContainer);
            this.equippedSlots.push({ container: slotContainer, placeholder: placeholderSprite, slotType: ph.type });
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

                slotsContainer.addChild(slotContainer);
                this.inventorySlots.push({ container: slotContainer, placeholder: null });
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
