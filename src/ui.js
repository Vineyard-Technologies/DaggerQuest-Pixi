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
        ] = await Promise.all([
            loadTexture('orbcoverback'),
            loadTexture('orbcoverfront'),
            loadTexture('healthorb'),
            loadTexture('manaorb'),
            loadTexture('healthcover'),
            loadTexture('manacover'),
            loadTexture('healthstatue'),
            loadTexture('manastatue'),
        ]);

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
    }

    // --------------------------------------------------------------- Update

    /**
     * Update orb fill levels and animate effects.
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
