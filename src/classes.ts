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

export { Man, Woman };
