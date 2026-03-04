import * as PIXI from 'pixi.js';
import { Character } from './character';
import { Entity } from './entity';
import { safeDestroy } from './safeDestroy';
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

const DIALOG_FONT_SIZE = 14;
const DIALOG_PAD_X = 8;
const DIALOG_PAD_Y = 5;
const DIALOG_WRAP_WIDTH = 200;
const DIALOG_OFFSET_Y = 8;
const DIALOG_MAX_HEIGHT = 50;
const DIALOG_SCROLL_SPEED = 15;

class NPC extends Character {
    readonly name: string;
    readonly interactRange: number;
    readonly dialog: readonly string[];
    private dialogIndex: number;
    isInteracting: boolean;
    private readonly wanderOrigin: { readonly x: number; readonly y: number };
    readonly wanderRadius: number;
    private _dialogWrapper: PIXI.Container | null = null;
    private _dialogText: PIXI.Text | null = null;
    private _dialogBg: PIXI.Graphics | null = null;
    private _dialogScrollContainer: PIXI.Container | null = null;
    private _dialogMask: PIXI.Graphics | null = null;
    private _scrollTickerFn: (() => void) | null = null;
    private _scrollOffset: number = 0;
    private _scrollMax: number = 0;
    private _displayHeight: number = 0;

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
    }

    showDialog(text: string): void {
        if (!this.sprite) return;

        // Clean up any previous dialog fully so we rebuild with correct sizing
        this.hideDialog();

        this._dialogWrapper = new PIXI.Container();
        this.container.addChild(this._dialogWrapper);

        // Create the text element to measure its natural height
        this._dialogText = new PIXI.Text({
            text,
            style: {
                fontFamily: 'Grenze, serif',
                fontSize: DIALOG_FONT_SIZE,
                fontWeight: '600',
                fill: 0xFFFFFF,
                stroke: { color: 0x000000, width: 3 },
                align: 'center',
                padding: 4,
                wordWrap: true,
                wordWrapWidth: DIALOG_WRAP_WIDTH,
            },
        });
        this._dialogText.anchor.set(0.5, 0);

        const textH = this._dialogText.height;
        const needsScroll = textH > DIALOG_MAX_HEIGHT;
        this._displayHeight = needsScroll ? DIALOG_MAX_HEIGHT : textH;

        const labelY = this.sprite.y - (this.sprite.height * this.sprite.anchor.y) - DIALOG_OFFSET_Y;

        // Background
        this._dialogBg = new PIXI.Graphics();
        this._dialogBg.y = labelY;
        this._dialogWrapper.addChild(this._dialogBg);

        if (needsScroll) {
            // Scrolling container with mask
            this._dialogScrollContainer = new PIXI.Container();
            this._dialogScrollContainer.y = labelY - this._displayHeight;
            this._dialogText.x = 0;
            this._dialogText.y = 0;
            this._dialogScrollContainer.addChild(this._dialogText);

            // Mask to clip text to max height
            const textW = this._dialogText.width;
            this._dialogMask = new PIXI.Graphics();
            this._dialogMask.rect(
                -textW / 2 - DIALOG_PAD_X,
                0,
                textW + DIALOG_PAD_X * 2,
                this._displayHeight,
            );
            this._dialogMask.fill({ color: 0xFFFFFF });
            this._dialogMask.y = labelY - this._displayHeight;
            this._dialogWrapper.addChild(this._dialogMask);
            this._dialogScrollContainer.mask = this._dialogMask;

            this._dialogWrapper.addChild(this._dialogScrollContainer);

            // Set up auto-scroll
            this._scrollOffset = 0;
            this._scrollMax = textH - this._displayHeight;
            this._scrollTickerFn = () => {
                if (!this._dialogScrollContainer || this._scrollMax <= 0) return;
                this._scrollOffset += DIALOG_SCROLL_SPEED * (PIXI.Ticker.shared.deltaTime / 60);
                if (this._scrollOffset > this._scrollMax) {
                    this._scrollOffset = this._scrollMax;
                }
                this._dialogScrollContainer.y = (labelY - this._displayHeight) - this._scrollOffset;
            };
            PIXI.Ticker.shared.add(this._scrollTickerFn);
        } else {
            // No scrolling needed — place text directly
            this._dialogText.anchor.set(0.5, 1);
            this._dialogText.y = labelY;
            this._dialogWrapper.addChild(this._dialogText);
        }

        this._drawDialogBg();
        requestAnimationFrame(() => this._drawDialogBg());
    }

    private _drawDialogBg(): void {
        if (!this._dialogText || !this._dialogBg) return;
        const w = this._dialogText.width;
        const h = this._displayHeight;
        this._dialogBg.clear();
        this._dialogBg.roundRect(
            -w / 2 - DIALOG_PAD_X,
            -h - DIALOG_PAD_Y,
            w + DIALOG_PAD_X * 2,
            h + DIALOG_PAD_Y * 2,
            4,
        );
        this._dialogBg.fill({ color: 0x000000, alpha: 0.7 });
    }

    private _stopScrollTicker(): void {
        if (this._scrollTickerFn) {
            PIXI.Ticker.shared.remove(this._scrollTickerFn);
            this._scrollTickerFn = null;
        }
    }

    hideDialog(): void {
        this._stopScrollTicker();
        if (this._dialogWrapper) {
            safeDestroy(this._dialogWrapper, { children: true });
            this._dialogWrapper = null;
            this._dialogText = null;
            this._dialogBg = null;
            this._dialogScrollContainer = null;
            this._dialogMask = null;
        }
    }

    getDialogBounds(): PIXI.Bounds | null {
        if (!this._dialogText) return null;
        return this._dialogText.getBounds();
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
