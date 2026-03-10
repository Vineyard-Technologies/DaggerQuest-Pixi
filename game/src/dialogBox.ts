import * as PIXI from 'pixi.js';
import { safeDestroy } from './safeDestroy';

const DIALOG_FONT_SIZE = 14;
const DIALOG_PAD_X = 8;
const DIALOG_PAD_Y = 5;
const DIALOG_WRAP_WIDTH = 200;
const DIALOG_OFFSET_Y = 8;
const DIALOG_MAX_HEIGHT = 50;
const DIALOG_SCROLL_SPEED = 15;

class DialogBox {
    private _wrapper: PIXI.Container | null = null;
    private _text: PIXI.Text | null = null;
    private _bg: PIXI.Graphics | null = null;
    private _scrollContainer: PIXI.Container | null = null;
    private _mask: PIXI.Graphics | null = null;
    private _scrollTickerFn: (() => void) | null = null;
    private _scrollOffset: number = 0;
    private _scrollMax: number = 0;
    private _displayHeight: number = 0;

    show(text: string, parent: PIXI.Container, anchorSprite: PIXI.AnimatedSprite): void {
        this.hide();

        this._wrapper = new PIXI.Container();
        parent.addChild(this._wrapper);

        this._text = new PIXI.Text({
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
        this._text.anchor.set(0.5, 0);

        const textH = this._text.height;
        const needsScroll = textH > DIALOG_MAX_HEIGHT;
        this._displayHeight = needsScroll ? DIALOG_MAX_HEIGHT : textH;

        const labelY = anchorSprite.y - (anchorSprite.height * anchorSprite.anchor.y) - DIALOG_OFFSET_Y;

        this._bg = new PIXI.Graphics();
        this._bg.y = labelY;
        this._wrapper.addChild(this._bg);

        if (needsScroll) {
            this._scrollContainer = new PIXI.Container();
            this._scrollContainer.y = labelY - this._displayHeight;
            this._text.x = 0;
            this._text.y = 0;
            this._scrollContainer.addChild(this._text);

            const textW = this._text.width;
            this._mask = new PIXI.Graphics();
            this._mask.rect(
                -textW / 2 - DIALOG_PAD_X,
                0,
                textW + DIALOG_PAD_X * 2,
                this._displayHeight,
            );
            this._mask.fill({ color: 0xFFFFFF });
            this._mask.y = labelY - this._displayHeight;
            this._wrapper.addChild(this._mask);
            this._scrollContainer.mask = this._mask;

            this._wrapper.addChild(this._scrollContainer);

            this._scrollOffset = 0;
            this._scrollMax = textH - this._displayHeight;
            this._scrollTickerFn = () => {
                if (!this._scrollContainer || this._scrollMax <= 0) return;
                this._scrollOffset += DIALOG_SCROLL_SPEED * (PIXI.Ticker.shared.deltaTime / 60);
                if (this._scrollOffset > this._scrollMax) {
                    this._scrollOffset = this._scrollMax;
                }
                this._scrollContainer.y = (labelY - this._displayHeight) - this._scrollOffset;
            };
            PIXI.Ticker.shared.add(this._scrollTickerFn);
        } else {
            this._text.anchor.set(0.5, 1);
            this._text.y = labelY;
            this._wrapper.addChild(this._text);
        }

        this._drawBg();
        requestAnimationFrame(() => this._drawBg());
    }

    private _drawBg(): void {
        if (!this._text || !this._bg) return;
        const w = this._text.width;
        const h = this._displayHeight;
        this._bg.clear();
        this._bg.roundRect(
            -w / 2 - DIALOG_PAD_X,
            -h - DIALOG_PAD_Y,
            w + DIALOG_PAD_X * 2,
            h + DIALOG_PAD_Y * 2,
            4,
        );
        this._bg.fill({ color: 0x000000, alpha: 0.7 });
    }

    hide(): void {
        if (this._scrollTickerFn) {
            PIXI.Ticker.shared.remove(this._scrollTickerFn);
            this._scrollTickerFn = null;
        }
        if (this._wrapper) {
            safeDestroy(this._wrapper, { children: true });
            this._wrapper = null;
            this._text = null;
            this._bg = null;
            this._scrollContainer = null;
            this._mask = null;
        }
    }

    getBounds(): PIXI.Bounds | null {
        if (!this._text) return null;
        return this._text.getBounds();
    }
}

export { DialogBox };
