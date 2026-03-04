import * as PIXI from 'pixi.js';
import { Character } from './character';
import { DialogBox } from './dialogBox';
import state from './state';

interface NPCOptions {
    x: number;
    y: number;
    spriteKey?: string;
    name?: string;
    speed?: number;
    animFps?: Record<string, number>;
    interactRange?: number;
    dialog?: string[];
    wanderRadius?: number;
}

class NPC extends Character {
    readonly name: string;
    readonly interactRange: number;
    readonly dialog: readonly string[];
    private dialogIndex: number;
    isInteracting: boolean;
    private readonly wanderOrigin: { readonly x: number; readonly y: number };
    readonly wanderRadius: number;
    private _dialogBox: DialogBox;

    constructor({
        x, y, spriteKey = 'guide', name = 'NPC', speed = 50, animFps = {},
        interactRange = 100, dialog = [], wanderRadius = 0,
    }: NPCOptions) {
        super({ x, y, spriteKey, speed, animFps });
        this.name = name;
        this.interactRange = interactRange;
        this.dialog = dialog;
        this.dialogIndex = 0;
        this.isInteracting = false;
        this.wanderOrigin = { x, y };
        this.wanderRadius = wanderRadius;
        this._dialogBox = new DialogBox();
    }

    showDialog(text: string): void {
        if (!this.sprite) return;
        this._dialogBox.show(text, this.container, this.sprite);
    }

    hideDialog(): void {
        this._dialogBox.hide();
    }

    getDialogBounds(): PIXI.Bounds | null {
        return this._dialogBox.getBounds();
    }

    interact(): string | null {
        if (this.dialog.length === 0) return null;
        this.isInteracting = true;
        this.targetPosition = null;
        this.stopWalkAnimation();
        if (state.player) {
            this.faceEntity(state.player);
        }
        return this.getCurrentDialog();
    }

    getCurrentDialog(): string | null {
        if (this.dialog.length === 0) return null;
        return this.dialog[this.dialogIndex] ?? null;
    }

    advanceDialog(): string | null {
        this.dialogIndex++;
        if (this.dialogIndex >= this.dialog.length) {
            this.endInteraction();
            return null;
        }
        return this.dialog[this.dialogIndex] ?? null;
    }

    endInteraction(): void {
        this.isInteracting = false;
        this.dialogIndex = 0;
        this.hideDialog();
    }

    isPlayerInRange(): boolean {
        if (!state.player) return false;
        return this.distanceTo(state.player) <= this.interactRange;
    }

    pickWanderTarget(): void {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.wanderRadius;
        const tx = this.wanderOrigin.x + Math.cos(angle) * radius;
        const ty = this.wanderOrigin.y + Math.sin(angle) * radius;
        this.moveToward(tx, ty);
    }

    update(delta: number): void {
        if (this.isInteracting) return;
        super.update(delta);
        if (!this.targetPosition && this.wanderRadius > 0 && Math.random() < 0.002) {
            this.pickWanderTarget();
        }
    }
}

export { NPC };
