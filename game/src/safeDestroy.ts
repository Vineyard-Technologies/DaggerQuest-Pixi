import * as PIXI from 'pixi.js';

/**
 * Defer PixiJS display-object destruction so that any in-flight WebGPU
 * command buffers referencing the underlying GPU buffers have finished
 * executing before the buffers are released.
 *
 * The object is removed from its parent immediately (preventing it from
 * being included in any future render pass).  Destruction is deferred by
 * two animation frames: the first rAF fires *before* the PixiJS Ticker's
 * next frame (because rAFs registered during a Ticker callback precede
 * the Ticker's own re-registration), and the second rAF fires *after*
 * that render has been submitted to the GPU queue.
 */
export function safeDestroy(
    obj: PIXI.Container,
    ...args: Parameters<PIXI.Container['destroy']>
): void {
    if (obj.parent) obj.parent.removeChild(obj);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => obj.destroy(...args));
    });
}
