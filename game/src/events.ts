/**
 * Lightweight typed event bus for decoupling game logic from presentation.
 *
 * Emit an event with `bus.emit(name, payload)`.
 * Subscribe with `bus.on(name, handler)`.
 * Unsubscribe with `bus.off(name, handler)`.
 */

import type { Item } from './item';
import type { GearSlot } from './types';
import type { AbilityKey, PrayerKey } from './ability';

// ── Event payload map ─────────────────────────────────────────────────────

export interface GameEventMap {
    'item-equipped':   { slot: GearSlot; item: Item };
    'item-unequipped': { slot: GearSlot };
    'player-died':     void;
    'enemy-killed':    { xpReward: number };
    'xp-gained':       { amount: number; total: number };
    'level-up':        { newLevel: number };
    'ability-used':    { key: AbilityKey; abilityId: string };
    'prayer-toggled':  { key: PrayerKey; prayerId: string; active: boolean };
}

export type GameEventName = keyof GameEventMap;
export type GameEventHandler<K extends GameEventName> = (payload: GameEventMap[K]) => void;

// ── EventBus implementation ───────────────────────────────────────────────

class EventBus {
    private _listeners: {
        [K in GameEventName]?: Set<GameEventHandler<K>>;
    } = {};

    on<K extends GameEventName>(event: K, handler: GameEventHandler<K>): void {
        if (!this._listeners[event]) {
            (this._listeners as Record<K, Set<GameEventHandler<K>>>)[event] = new Set();
        }
        (this._listeners[event] as Set<GameEventHandler<K>>).add(handler);
    }

    off<K extends GameEventName>(event: K, handler: GameEventHandler<K>): void {
        (this._listeners[event] as Set<GameEventHandler<K>> | undefined)?.delete(handler);
    }

    emit<K extends GameEventName>(event: K, payload: GameEventMap[K]): void {
        (this._listeners[event] as Set<GameEventHandler<K>> | undefined)?.forEach(h => h(payload));
    }

    /** Remove all listeners, optionally only for a specific event. */
    removeAll<K extends GameEventName>(event?: K): void {
        if (event) {
            delete this._listeners[event];
        } else {
            this._listeners = {};
        }
    }
}

/** Singleton event bus shared across the whole game. */
export const bus = new EventBus();
