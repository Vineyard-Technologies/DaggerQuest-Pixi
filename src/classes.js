/**
 * Playable character classes. Each extends Player with a specific spriteKey.
 */

class Man extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } } = {}) {
        super({ x, y, spriteKey: 'man', speed, animFps });
    }
}

class Woman extends Player {
    constructor({ x, y, speed = 250, animFps = { idle: 10 } } = {}) {
        super({ x, y, spriteKey: 'woman', speed, animFps });
    }
}
