import * as PIXI from 'pixi.js';
import { Entity } from './entity';
import { SHADOW_BLUR } from './assets';
import { safeDestroy } from './safeDestroy';
import type { Item } from './item';

class Loot extends Entity {
    item: Item;
    nameLabel: PIXI.Text | null;
    private _labelWrapper: PIXI.Container | null;
    private _nameLabelBg: PIXI.Graphics | null;
    private _updateLabelBg: (() => void) | null;

    constructor({ item, x, y }: { item: Item; x: number; y: number }) {
        super({
            x,
            y,
            spriteKey: `${item.id}_loot`,
            directions: 16,
            animFps: {},
        });
        this.item = item;
        this.nameLabel = null;
        this._labelWrapper = null;
        this._nameLabelBg = null;
        this._updateLabelBg = null;
    }

    initSprite(): void {
        const animName = this.textures['static']
            ? 'static'
            : Object.keys(this.textures)[0];
        if (!animName) return;

        const anim = this.textures[animName];
        if (!anim) return;
        const availableDirections = Object.keys(anim).map(Number);
        if (availableDirections.length === 0) return;

        const randomDir = availableDirections[
            Math.floor(Math.random() * availableDirections.length)
        ];
        if (randomDir === undefined) return;
        const frames = anim[randomDir];
        if (!frames || frames.length === 0) return;

        if (this.shadowTextures) {
            const shadowFrames = this.getShadowFrames(animName, randomDir);
            if (shadowFrames.length > 0) {
                this.shadowSprite = new PIXI.AnimatedSprite({
                    textures: shadowFrames,
                    updateAnchor: true,
                });
                this.shadowSprite.alpha = 0.5;
                this.shadowSprite.filters = [SHADOW_BLUR];
                this.container.addChild(this.shadowSprite);
                this.shadowSprite.gotoAndStop(0);
            }
        }

        this.sprite = new PIXI.AnimatedSprite({
            textures: frames,
            updateAnchor: true,
        });
        this.container.addChild(this.sprite);
        this.sprite.gotoAndStop(0);
        this.direction = randomDir;

        this._labelWrapper = new PIXI.Container();

        this.nameLabel = new PIXI.Text({
            text: this.item.name,
            style: {
                fontFamily: 'Cinzel, serif',
                fontSize: 14,
                fontWeight: '600',
                fill: 0xFFD700,
                stroke: { color: 0x000000, width: 3 },
                align: 'center',
                padding: 4,
            },
        });
        this.nameLabel.anchor.set(0.5, 1);
        const labelY = this.sprite.y - (this.sprite.height * this.sprite.anchor.y) - 6;
        this.nameLabel.y = labelY;

        const padX = 6;
        const padY = 3;
        this._nameLabelBg = new PIXI.Graphics();
        this._nameLabelBg.y = labelY;
        this._labelWrapper.addChild(this._nameLabelBg);
        this._labelWrapper.addChild(this.nameLabel);

        this._updateLabelBg = () => {
            const lblW = this.nameLabel!.width;
            const lblH = this.nameLabel!.height;
            this._nameLabelBg!.clear();
            this._nameLabelBg!.roundRect(-lblW / 2 - padX, -lblH - padY, lblW + padX * 2, lblH + padY * 2, 4);
            this._nameLabelBg!.fill({ color: 0x000000, alpha: 0.7 });
        };
        this._updateLabelBg();
        requestAnimationFrame(() => {
            if (this.nameLabel && this._nameLabelBg) {
                this._updateLabelBg!();
            }
        });

        this._labelWrapper.x = 0;
        this._labelWrapper.y = 0;
        this.container.addChild(this._labelWrapper);
    }

    attachLabelsTo(overlayContainer: PIXI.Container): void {
        if (!this._labelWrapper) return;
        if (this._labelWrapper.parent) {
            this._labelWrapper.parent.removeChild(this._labelWrapper);
        }
        this._labelWrapper.x = this.x;
        this._labelWrapper.y = this.y;
        overlayContainer.addChild(this._labelWrapper);
    }

    pickup(): Item {
        const item = this.item;
        this.destroy();
        return item;
    }

    destroy(): void {
        if (this._labelWrapper) {
            safeDestroy(this._labelWrapper, { children: true });
            this._labelWrapper = null;
            this._nameLabelBg = null;
            this.nameLabel = null;
        }
        super.destroy();
    }
}

export { Loot };
