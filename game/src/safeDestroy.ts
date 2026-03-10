import * as PIXI from 'pixi.js';

/**
 * Defer PixiJS display-object destruction to the next frame so that any
 * in-flight WebGPU command buffers referencing the underlying GPU buffers
 * have finished executing before the buffers are released.
 *
 * The object is removed from its parent immediately (preventing it from
 * being included in any future render pass), but `.destroy()` is deferred
 * to the next animation frame.
 */
export function safeDestroy(
    obj: PIXI.Container,
    ...args: Parameters<PIXI.Container['destroy']>
): void {
    if (obj.parent) obj.parent.removeChild(obj);
    requestAnimationFrame(() => obj.destroy(...args));
}
