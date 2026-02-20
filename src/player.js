/**
 * The player character. Extends Character with click-to-move input
 * handling and camera tracking.
 */
class Player extends Character {
    constructor({ x, y, spriteKey, speed = 0, animFps = {}, pickupRange = 150, ...rest }) {
        super({ x, y, spriteKey, speed, animFps, pickupRange, ...rest });

        /** Currently equipped gear pieces, keyed by slot name */
        this.equippedGear = {};

        /**
         * Slots that have default body-cover gear (set by subclasses).
         * Each entry maps a slot name to its spriteKeyBase, e.g.
         * { head: 'headdefault', legs: 'legsdefault' }
         */
        this.defaultGearSlots = {};
    }

    /**
     * Load and equip default gear for every slot listed in defaultGearSlots.
     * Called once after the player's textures are loaded.
     */
    async loadDefaultGear() {
        for (const [slot, base] of Object.entries(this.defaultGearSlots)) {
            const gear = new Gear({ slot, spriteKeyBase: base, isDefault: true });
            await gear.equip(this);
            this.equippedGear[slot] = gear;
        }
    }

    /**
     * Try to pick up a Loot entity: remove it from the world and equip the
     * gear onto this character.  The new gear is fully loaded before the
     * old gear is removed so the body is never visible between swaps.
     * @param {Loot} loot
     */
    async pickupAndEquip(loot) {
        const item = loot.pickup();

        // Remove the loot from the area's tracking list
        if (area?.lootOnGround) {
            const idx = area.lootOnGround.indexOf(loot);
            if (idx !== -1) area.lootOnGround.splice(idx, 1);
        }

        const slot = item.slot;

        // Load the new gear fully (textures + sprites) before touching the old one
        const newGear = item.createGear();
        await newGear.equip(this);

        // Now remove the old gear (frees its textures from memory)
        const oldGear = this.equippedGear[slot];
        if (oldGear) {
            await oldGear.unequip();
        }

        this.equippedGear[slot] = newGear;

        // Update the HUD equipped-slot icon
        if (typeof ui !== 'undefined' && ui) {
            await ui.setEquippedItem(slot, item);
        }
    }

    /**
     * Unequip gear from a slot.  If a default gear exists for that slot,
     * the default is loaded first, then the old gear is removed — so the
     * body is never visible between swaps.
     * @param {string} slot - The equipment slot to clear
     */
    async unequipSlot(slot) {
        const oldGear = this.equippedGear[slot] || null;

        // Load and equip default gear first (if defined) so the body stays covered
        const base = this.defaultGearSlots[slot];
        if (base) {
            const defaultGear = new Gear({ slot, spriteKeyBase: base, isDefault: true });
            await defaultGear.equip(this);
            this.equippedGear[slot] = defaultGear;
        } else {
            delete this.equippedGear[slot];
        }

        // Now remove the old gear (frees its textures from memory)
        if (oldGear) {
            await oldGear.unequip();
        }

        // Clear the HUD equipped-slot icon and restore the placeholder
        if (typeof ui !== 'undefined' && ui) {
            await ui.clearEquippedItem(slot);
        }
    }

    /**
     * Equip an Item from the inventory (not from loot on the ground).
     * Loads gear, swaps it onto the character, and updates the equipped-slot icon.
     * @param {Item} item
     */
    async equipItem(item) {
        const slot = item.slot;

        const newGear = item.createGear();
        await newGear.equip(this);

        const oldGear = this.equippedGear[slot];
        if (oldGear) {
            await oldGear.unequip();
        }

        this.equippedGear[slot] = newGear;

        // Update the HUD equipped-slot icon
        if (typeof ui !== 'undefined' && ui) {
            await ui.setEquippedItem(slot, item);
        }
    }

    /**
     * Unequip gear from a slot WITHOUT touching the UI icons (the UI
     * manages its own icon state when the action originates from right-click).
     * @param {string} slot
     */
    async unequipSlotSilent(slot) {
        const oldGear = this.equippedGear[slot] || null;

        const base = this.defaultGearSlots[slot];
        if (base) {
            const defaultGear = new Gear({ slot, spriteKeyBase: base, isDefault: true });
            await defaultGear.equip(this);
            this.equippedGear[slot] = defaultGear;
        } else {
            delete this.equippedGear[slot];
        }

        if (oldGear) {
            await oldGear.unequip();
        }
    }

    /**
     * Immediately sync all equipped gear to match the character's current
     * animation and direction.  Called by the onAnimationChanged hook so
     * gear never lags a frame behind the body.
     */
    onAnimationChanged() {
        for (const gear of Object.values(this.equippedGear)) {
            if (gear) gear.syncNow();
        }
    }

    /** Handle a click/tap to move toward a world position */
    moveToward(worldX, worldY) {
        this.targetPosition = { x: worldX, y: worldY };

        // Calculate direction to target
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        const newDirection = this.findClosestDirection(angle);

        // Only restart the walk animation if direction changed or not already walking
        if (!this.isWalking || newDirection !== this.direction) {
            this.direction = newDirection;
            this.startWalkAnimation();
        }
    }
}

// Create the player character
async function createPlayer(PlayerClass) {
    player = new PlayerClass({
        x: area.playerStartX,
        y: area.playerStartY,
    });

    await player.loadTextures();

    area.container.addChild(player.container);
    await player.loadDefaultGear();
    player.startIdlePingPong();

    // Position camera on the player immediately
    updateCamera();
}
