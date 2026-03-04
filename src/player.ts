import { Character, type CharacterOptions } from './character';
import { Gear } from './gear';
import state from './state';
import { bus } from './events';
import { isCharacterStatKey, type GearSlot } from './types';
import type { Item } from './item';
import type { Loot } from './loot';

class Player extends Character {
    equippedGear: Record<string, Gear>;
    defaultGearSlots: Record<string, string>;

    constructor({ x, y, spriteKey, speed = 0, animFps = {}, pickupRange = 150, ...rest }: CharacterOptions) {
        super({ x, y, spriteKey, speed, animFps, pickupRange, ...rest });
        this.equippedGear = {};
        this.defaultGearSlots = {};
    }

    protected _applyItemStats(item: Item): void {
        if (!item) return;
        const stats = item.stats;
        for (const [key, value] of Object.entries(stats)) {
            if (isCharacterStatKey(key) && typeof this[key] === 'number') {
                (this[key] as number) += value;
            }
        }
    }

    protected _removeItemStats(item: Item): void {
        if (!item) return;
        const stats = item.stats;
        for (const [key, value] of Object.entries(stats)) {
            if (isCharacterStatKey(key) && typeof this[key] === 'number') {
                (this[key] as number) -= value;
            }
        }
    }

    async loadDefaultGear(): Promise<void> {
        for (const [slot, base] of Object.entries(this.defaultGearSlots)) {
            const gear = new Gear({ slot: slot as GearSlot, spriteKeyBase: base, isDefault: true });
            await gear.equip(this);
            this.equippedGear[slot] = gear;
        }
    }

    pickupAndEquip(loot: Loot): void {
        if (!this.isAlive) return;
        const item = loot.pickup();
        if (state.area?.lootOnGround) {
            const idx = state.area.lootOnGround.indexOf(loot);
            if (idx !== -1) state.area.lootOnGround.splice(idx, 1);
        }
        const slot = item.slot;
        const oldGear = this.equippedGear[slot];
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }
        this._applyItemStats(item);

        // Gear visuals are fire-and-forget so the UI stays instantaneous.
        const newGear = item.createGear();
        this.equippedGear[slot] = newGear;
        newGear.equip(this).then(() => {
            if (oldGear) oldGear.unequip();
        });

        bus.emit('item-equipped', { slot, item });
    }

    unequipSlot(slot: GearSlot): void {
        if (!this.isAlive) return;
        const oldGear = this.equippedGear[slot] || null;
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }

        // Gear visuals are fire-and-forget so the UI stays instantaneous.
        const base = this.defaultGearSlots[slot];
        if (base) {
            const defaultGear = new Gear({ slot, spriteKeyBase: base, isDefault: true });
            this.equippedGear[slot] = defaultGear;
            defaultGear.equip(this).then(() => {
                if (oldGear) oldGear.unequip();
            });
        } else {
            delete this.equippedGear[slot];
            if (oldGear) oldGear.unequip();
        }

        bus.emit('item-unequipped', { slot });
    }

    equipItem(item: Item): void {
        if (!this.isAlive) return;
        const slot = item.slot;
        const oldGear = this.equippedGear[slot];
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }
        this._applyItemStats(item);

        // Gear visuals are fire-and-forget so the UI stays instantaneous.
        const newGear = item.createGear();
        this.equippedGear[slot] = newGear;
        newGear.equip(this).then(() => {
            if (oldGear) oldGear.unequip();
        });

        bus.emit('item-equipped', { slot, item });
    }

    unequipSlotSilent(slot: GearSlot): void {
        if (!this.isAlive) return;
        const oldGear = this.equippedGear[slot] || null;
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }

        // Gear visuals are fire-and-forget so the UI stays instantaneous.
        const base = this.defaultGearSlots[slot];
        if (base) {
            const defaultGear = new Gear({ slot, spriteKeyBase: base, isDefault: true });
            this.equippedGear[slot] = defaultGear;
            defaultGear.equip(this).then(() => {
                if (oldGear) oldGear.unequip();
            });
        } else {
            delete this.equippedGear[slot];
            if (oldGear) oldGear.unequip();
        }
    }

    onAnimationChanged(): void {
        for (const gear of Object.values(this.equippedGear)) {
            if (gear) gear.syncNow();
        }
    }
}

export { Player };
