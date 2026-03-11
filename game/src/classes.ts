import { Player } from './player';
import { GearSlot } from './types';
import type { CharacterOptions } from './character';

interface ClassOptions {
    x: number;
    y: number;
    speed?: number;
    animFps?: Record<string, number>;
}

class Chevalier extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } }: ClassOptions = {} as ClassOptions) {
        super({ x, y, spriteKey: 'chevalier', speed, animFps });
        this.defaultGearSlots = {
            [GearSlot.Head]: 'headdefault',
            [GearSlot.Legs]: 'legsdefault',
        };
    }
}

class Vanguard extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } }: ClassOptions = {} as ClassOptions) {
        super({ x, y, spriteKey: 'vanguard', speed, animFps });
        this.defaultGearSlots = {
            [GearSlot.Head]: 'headdefault',
            [GearSlot.Chest]: 'chestdefault',
            [GearSlot.Legs]: 'legsdefault',
        };
    }
}

// ── Factory ─────────────────────────────────────────────────────────────────

interface PlayerSpawnOptions {
    x: number;
    y: number;
}

const PLAYER_CLASSES: Record<string, new (opts: PlayerSpawnOptions) => Player> = {
    chevalier: Chevalier,
    vanguard: Vanguard,
};

function createPlayer(spriteKey: string, x: number, y: number): Player {
    const PlayerClass = PLAYER_CLASSES[spriteKey];
    if (!PlayerClass) throw new Error(`Unknown player class: "${spriteKey}"`);
    return new PlayerClass({ x, y });
}

export { Chevalier, Vanguard, createPlayer };
