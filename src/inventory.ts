/**
 * Pure data model for the player's inventory.
 *
 * Holds a fixed-size array of item slots and provides `add`, `remove`,
 * `swap`, and `serialize` operations that are independent of any UI.
 * The `InventoryPanel` in `ui.ts` is a view over this model.
 */

import type { Item } from './item';

interface SerializedInventory {
    size: number;
    items: ({ id: string; slot: string } | null)[];
}

class Inventory {
    private readonly _slots: (Item | null)[];

    constructor(size = 25) {
        this._slots = new Array<Item | null>(size).fill(null);
    }

    get size(): number {
        return this._slots.length;
    }

    /** Return the item at `index`, or `null` if the slot is empty. */
    getSlot(index: number): Item | null {
        return this._slots[index] ?? null;
    }

    /**
     * Place `item` in the first empty slot.
     * Returns the slot index on success, or `-1` when the inventory is full.
     */
    add(item: Item): number {
        const idx = this._slots.indexOf(null);
        if (idx === -1) return -1;
        this._slots[idx] = item;
        return idx;
    }

    /**
     * Remove and return the item at `index`.
     * Returns `null` if the slot is already empty.
     */
    remove(index: number): Item | null {
        const item = this._slots[index] ?? null;
        if (item) this._slots[index] = null;
        return item;
    }

    /**
     * Place `item` into a specific slot, replacing whatever was there.
     * Returns the previous occupant (or `null`).
     */
    set(index: number, item: Item | null): Item | null {
        const prev = this._slots[index] ?? null;
        this._slots[index] = item;
        return prev;
    }

    /** Swap the contents of two slots. */
    swap(indexA: number, indexB: number): void {
        const tmp = this._slots[indexA] ?? null;
        this._slots[indexA] = this._slots[indexB] ?? null;
        this._slots[indexB] = tmp;
    }

    /** Return a lightweight serialisable snapshot (item IDs only). */
    serialize(): SerializedInventory {
        return {
            size: this._slots.length,
            items: this._slots.map(item =>
                item ? { id: item.id, slot: item.slot } : null,
            ),
        };
    }
}

export { Inventory };
export type { SerializedInventory };
