import { Character, type CharacterOptions } from './character';
import { Gear } from './gear';
import state from './state';
import { bus } from './events';
import { isCharacterStatKey, type GearSlot } from './types';
import { xpForLevel, LEVEL_UP_BONUSES } from './config';
import type { Item } from './item';
import type { Loot } from './loot';
import type { Enemy } from './enemy';
import {
    PlayerAbility, Prayer,
    ABILITY_KEYS, PRAYER_KEYS, SLOT_UNLOCK_LEVELS,
    type AbilityKey, type PrayerKey,
} from './ability';

class Player extends Character {
    equippedGear: Record<string, Gear>;
    defaultGearSlots: Record<string, string>;
    private _equipGeneration: Record<string, number>;

    /** Active abilities keyed to Q/W/E/R/T. */
    playerAbilities: Partial<Record<AbilityKey, PlayerAbility>> = {};
    /** Prayer toggles keyed to A/S/D/F/G. */
    prayers: Partial<Record<PrayerKey, Prayer>> = {};
    /** Spritesheet key for ability icons (e.g. 'chevalier_ability'). */
    abilityIconSheet: string | null = null;

    constructor({ x, y, spriteKey, speed = 0, animFps = {}, pickupRange = 150, ...rest }: CharacterOptions) {
        super({ x, y, spriteKey, speed, animFps, pickupRange, ...rest });
        this.equippedGear = {};
        this.defaultGearSlots = {};
        this._equipGeneration = {};
    }

    private _adjustItemStats(item: Item, sign: 1 | -1): void {
        if (!item) return;
        for (const [key, value] of Object.entries(item.stats)) {
            if (isCharacterStatKey(key) && typeof this[key] === 'number') {
                (this[key] as number) += value * sign;
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
        if (!this.isAlive || this.isCasting) return;
        const item = loot.pickup();
        if (state.area?.lootOnGround) {
            const idx = state.area.lootOnGround.indexOf(loot);
            if (idx !== -1) state.area.lootOnGround.splice(idx, 1);
        }
        this.equipItem(item);
    }

    equipItem(item: Item): void {
        if (!this.isAlive || this.isCasting) return;
        const slot = item.slot;
        const oldGear = this.equippedGear[slot];
        if (oldGear && oldGear.item) {
            this._adjustItemStats(oldGear.item, -1);
        }
        this._adjustItemStats(item, 1);

        const gen = (this._equipGeneration[slot] ?? 0) + 1;
        this._equipGeneration[slot] = gen;

        const newGear = item.createGear();
        this.equippedGear[slot] = newGear;
        newGear.equip(this).then(() => {
            if (this._equipGeneration[slot] === gen && oldGear) oldGear.unequip();
        }).catch(() => {
            if (this._equipGeneration[slot] === gen && oldGear) oldGear.unequip();
        });

        bus.emit('item-equipped', { slot, item });
    }

    unequipSlot(slot: GearSlot): void {
        if (!this.isAlive || this.isCasting) return;
        const oldGear = this.equippedGear[slot] || null;
        if (oldGear && oldGear.item) {
            this._adjustItemStats(oldGear.item, -1);
        }

        const gen = (this._equipGeneration[slot] ?? 0) + 1;
        this._equipGeneration[slot] = gen;

        const base = this.defaultGearSlots[slot];
        if (base) {
            const defaultGear = new Gear({ slot, spriteKeyBase: base, isDefault: true });
            this.equippedGear[slot] = defaultGear;
            defaultGear.equip(this).then(() => {
                if (this._equipGeneration[slot] === gen && oldGear) oldGear.unequip();
            }).catch(() => {
                if (this._equipGeneration[slot] === gen && oldGear) oldGear.unequip();
            });
        } else {
            delete this.equippedGear[slot];
            if (oldGear) oldGear.unequip();
        }

        bus.emit('item-unequipped', { slot });
    }

    onAnimationChanged(): void {
        for (const gear of Object.values(this.equippedGear)) {
            if (gear) gear.syncNow();
        }
    }

    /** Execute the player's basic attack against the given enemy. */
    performBasicAttack(target: Enemy): void {
        if (!this.isAlive || this.isCasting) return;
        if (!target.isAlive) return;
        if (!this.basicAbility || !this.basicAbility.isReady()) return;

        this.targetPosition = null;
        this.stopWalkAnimation();
        this.basicAbility.use({ caster: this, target });
    }

    /** Activate a player ability bound to the given key. */
    useAbility(key: AbilityKey): void {
        if (!this.isAlive || this.isCasting) return;
        const ability = this.playerAbilities[key];
        if (!ability) return;
        if (this.level < (SLOT_UNLOCK_LEVELS[key] ?? 1)) return;
        if (!ability.canUse(this)) return;

        this.targetPosition = null;
        this.stopWalkAnimation();

        const fireFrame = this.frameTags[ability.animName]?.fireFrame ?? 0;

        ability.use({ caster: this });

        this.playAbilityAnimation(ability.animName, undefined, {
            [fireFrame]: () => {},
        });

        bus.emit('ability-used', { key, abilityId: ability.id });
    }

    /** Toggle a prayer bound to the given key. */
    togglePrayer(key: PrayerKey): void {
        if (!this.isAlive) return;
        const prayer = this.prayers[key];
        if (!prayer) return;
        if (this.level < (SLOT_UNLOCK_LEVELS[key] ?? 1)) return;
        prayer.toggle(this);
        bus.emit('prayer-toggled', { key, prayerId: prayer.id, active: prayer.active });
    }

    /** Award experience to this player, triggering level ups as needed. */
    gainExperience(amount: number): void {
        this.experience += amount;
        bus.emit('xp-gained', { amount, total: this.experience });

        let needed = xpForLevel(this.level);
        while (this.experience >= needed) {
            this.experience -= needed;
            this.level += 1;
            for (const [stat, bonus] of Object.entries(LEVEL_UP_BONUSES)) {
                if (isCharacterStatKey(stat) && typeof this[stat] === 'number') {
                    (this[stat] as number) += bonus;
                }
            }
            // Fully heal on level up
            this.currentHealth = this.maxHealth;
            this.currentMana = this.maxMana;
            bus.emit('level-up', { newLevel: this.level });
            needed = xpForLevel(this.level);
        }
    }
}

export { Player };
