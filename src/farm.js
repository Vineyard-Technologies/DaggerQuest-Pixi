/**
 * The Farm area – the starting zone for the player.
 * Layout matches the original Construct 3 DaggerQuest farm.json.
 * Uses a dirt background and a 4096×4096 world.
 */
class Farm extends Area {
    constructor() {
        super({
            width: 4096,
            height: 4096,
            backgroundTexture: './spritesheets/dirt/dirt-0.webp',
            playerStartX: 3100,
            playerStartY: 3800,
        });
    }

    /** @override */
    async spawnObjects() {
        // All spawn groups run in parallel where possible
        await Promise.all([
            this._spawnBoundaries(),
            this._spawnBuildings(),
            this._spawnFences(),
            this._spawnProps(),
            this._spawnNpcs(),
            this._spawnEnemies(),
            this._spawnLoot(),
        ]);
    }

    // ── Boundaries (invisible collision rectangles) ──────────────────────

    async _spawnBoundaries() {
        this.boundaries.push(
            { x: 43,   y: 2309, width: 50,  height: 3570 }, // left wall
            { x: 4050, y: 2046, width: 50,  height: 4096 }, // right wall
            { x: 3813, y: 3614, width: 50,  height: 984  }, // partial right wall
        );
    }

    // ── Buildings & large structures ─────────────────────────────────────

    async _spawnBuildings() {
        await Promise.all([
            this.placeStaticSprite('farmhouse',        1594, 3337),
            this.placeStaticSprite('longhouse',         869, 3981),
            this.placeStaticSprite('cottageexterior',    733,  493, { shadow: true }),
            this.placeStaticSprite('farmhousetree',    4030, 4049),
        ]);

        // Cottage door (animated "open" sprite, placed atop the cottage – no collision)
        this.placeStaticSprite('cottagedoor', 728, 493, { shadow: false, collider: false });
    }

    // ── Fences ───────────────────────────────────────────────────────────

    async _spawnFences() {
        const fences = [
            // --- diagonal right-facing fences (NW → SE divider) ---
            ['fencepatchedright',   708, 2528],
            ['fenceright',         1032, 2365],
            ['fencepatchedright',  1355, 2204],
            ['fenceright',         1679, 2040],
            ['fencepatchedright',  2002, 1879],

            // --- diagonal left-facing fences ---
            ['fenceleft',          715, 2544],
            ['fencepatchedleft',  1040, 2710],
            ['fenceleft',         1364, 2870],
            ['fenceleft',         2326, 1721],
            ['fencepatchedleft',  2651, 1887],

            // --- top horizontal row (y ≈ 136) ---
            ['fencepatchedhorizontal',   905,  137],
            ['fencehorizontal',         1361,  136],
            ['fencepatchedhorizontal',  1817,  137],
            ['fencehorizontal',         2273,  136],
            ['fencepatchedhorizontal',  2729,  137],
            ['fencehorizontal',         3185,  136],
            ['fencepatchedhorizontal',  3641,  137],
            ['fencehorizontal',         4097,  136],

            // --- bottom horizontal row (y ≈ 4098) ---
            ['fencepatchedhorizontal',   448, 4099],
            ['fencehorizontal',          904, 4098],
            ['fencepatchedhorizontal',  1360, 4099],
            ['fencehorizontal',         1816, 4098],
            ['fencehorizontal',         2273, 4098],
            ['fencepatchedhorizontal',  2729, 4099],
            ['fencehorizontal',         3185, 4098],
            ['fencepatchedhorizontal',  3641, 4099],
            ['fencehorizontal',         4097, 4098],

            // --- left vertical column (x ≈ 15) ---
            ['fencevertical',  16,  866],
            ['fencevertical',  15, 1096],
            ['fencevertical',  16, 1328],
            ['fencevertical',  16, 1560],
            ['fencevertical',  15, 1790],
            ['fencevertical',  16, 2022],
            ['fencevertical',  16, 2254],
            ['fencevertical',  15, 2484],
            ['fencevertical',  16, 2716],
            ['fencevertical',  14, 2946],
            ['fencevertical',  14, 3177],

            // --- right vertical column (x ≈ 4098) ---
            ['fencevertical', 4097,  380],
            ['fencevertical', 4098,  611],
            ['fencevertical', 4099, 2150],
            ['fencevertical', 4098, 2380],
            ['fencevertical', 4099, 2612],
        ];

        // Left vertical fences have no shadows in the original layout
        await Promise.all(
            fences.map(([key, x, y]) => {
                const shadow = !(key === 'fencevertical' && x < 50);
                return this.placeStaticSprite(key, x, y, { shadow });
            })
        );
    }

    // ── Props & interactable objects ─────────────────────────────────────

    async _spawnProps() {
        await Promise.all([
            this.placeStaticSprite('cart',           3150, 3624),
            this.placeStaticSprite('table',          2065, 3661),
            this.placeStaticSprite('table',          1683, 3565),
            this.placeStaticSprite('woodenchest',    3834, 2156),
            this.placeStaticSprite('pillaroffate',   1377, 3702),
        ]);
    }

    // ── Guide NPC ────────────────────────────────────────────────────────

    async _spawnNpcs() {
        const guide = new NPC({
            x: 2571,
            y: 3584,
            spriteKey: 'guide',
            name: 'The Guide',
            speed: 50,
            interactRange: 350,
            dialog: [
                'Welcome, traveler. These lands grow ever more dangerous.',
                'Take what supplies you can from the tables and prepare yourself.',
            ],
        });
        await guide.loadTextures();
        this.container.addChild(guide.container);
        this.npcs.push(guide);
    }

    // ── Enemies ──────────────────────────────────────────────────────────

    async _spawnEnemies() {
        const enemyDefs = [
            // Goblin Underlings
            {
                x: 971, y: 1480,
                spriteKey: 'goblinunderling',
                speed: 200,
                health: 10,
                attackRange: 150,
                aggroRange: 300,
                attackDamage: 7,
                attackCooldown: 1000,
            },
            {
                x: 1429, y: 1614,
                spriteKey: 'goblinunderling',
                speed: 200,
                health: 10,
                attackRange: 150,
                aggroRange: 300,
                attackDamage: 7,
                attackCooldown: 1000,
            },
            // Goblin Archers
            {
                x: 3002, y: 304,
                spriteKey: 'goblinarcher',
                speed: 200,
                health: 10,
                attackRange: 400,
                aggroRange: 500,
                attackDamage: 10,
                attackCooldown: 1000,
            },
            {
                x: 3676, y: 466,
                spriteKey: 'goblinarcher',
                speed: 200,
                health: 10,
                attackRange: 400,
                aggroRange: 500,
                attackDamage: 10,
                attackCooldown: 1000,
            },
            // Goblin Warlock
            {
                x: 2374, y: 1195,
                spriteKey: 'goblinwarlock',
                speed: 200,
                health: 10,
                attackRange: 300,
                aggroRange: 400,
                attackDamage: 11,
                attackCooldown: 2500,
            },
        ];

        await Promise.all(enemyDefs.map(async (def) => {
            const enemy = new Enemy(def);
            await enemy.loadTextures();
            this.container.addChild(enemy.container);
            this.enemies.push(enemy);
        }));
    }

    // ── Loot items on tables ─────────────────────────────────────────────

    async _spawnLoot() {
        const items = [
            {
                x: 1750, y: 3480,
                item: new Item({
                    id: 'simplesword',
                    name: 'Simple Sword',
                    description: 'The first of many',
                    slot: 'mainhand',
                    stats: { slashDamage: 3 },
                }),
            },
            {
                x: 1833, y: 3531,
                item: new Item({
                    id: 'simpleshield',
                    name: 'Simple Shield',
                    description: 'No respite for the scorned',
                    slot: 'offhand',
                    stats: { armor: 5 },
                }),
            },
            {
                x: 2127, y: 3581,
                item: new Item({
                    id: 'simpleshirt',
                    name: 'Simple Shirt',
                    description: 'Deep in the midst, you conceal him',
                    slot: 'chest',
                    stats: { maxHealth: 2 },
                }),
            },
            {
                x: 2218, y: 3627,
                item: new Item({
                    id: 'simplepants',
                    name: 'Simple Pants',
                    description: 'Whoso is simple, let him perish!',
                    slot: 'legs',
                    stats: { manaRegen: 1 },
                }),
            },
        ];

        await Promise.all(items.map(async ({ x, y, item }) => {
            const loot = item.createLoot(x, y);
            await loot.loadTextures();
            this.container.addChild(loot.container);
            this.lootOnGround.push(loot);
        }));
    }
}
