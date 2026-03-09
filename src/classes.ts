import { Player } from './player';
import { GearSlot } from './types';
import type { CharacterOptions } from './character';

interface ClassOptions {
    x: number;
    y: number;
    speed?: number;
    animFps?: Record<string, number>;
}

class Man extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } }: ClassOptions = {} as ClassOptions) {
        super({ x, y, spriteKey: 'man', speed, animFps });
        this.defaultGearSlots = {
            [GearSlot.Head]: 'headdefault',
            [GearSlot.Legs]: 'legsdefault',
        };
    }
}

class Woman extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } }: ClassOptions = {} as ClassOptions) {
        super({ x, y, spriteKey: 'woman', speed, animFps });
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
    man: Man,
    woman: Woman,
};

function createPlayer(spriteKey: string, x: number, y: number): Player {
    const PlayerClass = PLAYER_CLASSES[spriteKey];
    if (!PlayerClass) throw new Error(`Unknown player class: "${spriteKey}"`);
    return new PlayerClass({ x, y });
}

export { Man, Woman, createPlayer };
