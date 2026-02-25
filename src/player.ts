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

    async pickupAndEquip(loot: Loot): Promise<void> {
        const item = loot.pickup();
        if (state.area?.lootOnGround) {
            const idx = state.area.lootOnGround.indexOf(loot);
            if (idx !== -1) state.area.lootOnGround.splice(idx, 1);
        }
        const slot = item.slot;
        const newGear = item.createGear();
        await newGear.equip(this);
        const oldGear = this.equippedGear[slot];
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }
        this._applyItemStats(item);
        if (oldGear) {
            await oldGear.unequip();
        }
        this.equippedGear[slot] = newGear;
        bus.emit('item-equipped', { slot, item });
    }

    async unequipSlot(slot: GearSlot): Promise<void> {
        const oldGear = this.equippedGear[slot] || null;
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }
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
        bus.emit('item-unequipped', { slot });
    }

    async equipItem(item: Item): Promise<void> {
        const slot = item.slot;
        const newGear = item.createGear();
        await newGear.equip(this);
        const oldGear = this.equippedGear[slot];
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }
        this._applyItemStats(item);
        if (oldGear) {
            await oldGear.unequip();
        }
        this.equippedGear[slot] = newGear;
        bus.emit('item-equipped', { slot, item });
    }

    async unequipSlotSilent(slot: GearSlot): Promise<void> {
        const oldGear = this.equippedGear[slot] || null;
        if (oldGear && oldGear.item) {
            this._removeItemStats(oldGear.item);
        }
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

    onAnimationChanged(): void {
        for (const gear of Object.values(this.equippedGear)) {
            if (gear) gear.syncNow();
        }
    }
}

export { Player };
