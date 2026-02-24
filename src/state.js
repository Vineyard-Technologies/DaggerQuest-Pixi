/**
 * Shared mutable game state.
 *
 * All modules that need to read or write the core game references
 * (app, area, player, ui, etc.) import this object and access its
 * properties.  Because every module shares the same object reference,
 * mutations are immediately visible everywhere.
 */
const state = {
    /** @type {PIXI.Application|null} */
    app: null,

    /** @type {Area|null} */
    area: null,

    /** @type {Player|null} */
    player: null,

    /** @type {UI|null} */
    ui: null,

    // Input state
    pointerHeld: false,
    pointerScreenX: 0,
    pointerScreenY: 0,

    // Hover outline state
    /** @type {Entity|null} */
    hoveredEntity: null,

    /**
     * When the player clicks loot that is out of pickup range, we store
     * it here so the player walks toward it and auto-picks it up once
     * close enough.
     * @type {Loot|null}
     */
    pendingLootPickup: null,
};

export default state;
