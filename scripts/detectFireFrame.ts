/**
 * detectFireFrame.ts
 *
 * Extracts attack-animation frames from packed spritesheets, composites them
 * into a numbered strip, sends the image to a local vision-capable AI model
 * (OpenAI-compatible API), and writes the result into a per-sprite frame-tags
 * JSON file at  src/data/frameTags/{spriteKey}.json .
 *
 * The JSON files are loaded at runtime by the game to determine which
 * animation frame should trigger an event (e.g. spawning a projectile).
 *
 * Ollama is started automatically if it isn't already running (and stopped
 * when the script finishes).  Install a vision model first:
 *   ollama pull llama3.2-vision
 *
 * Usage:
 *   npx tsx scripts/detectFireFrame.ts [--anim <animName>] [spriteKey ...]
 *
 * Options:
 *   --anim <name>  Animation name to analyse (default: "attack")
 *
 * If no spriteKeys are given it processes every key that has matching frames.
 *
 * Environment variables:
 *   AI_BASE_URL – base URL of the local OpenAI-compatible server
 *                 (default: http://localhost:11434/v1  — Ollama)
 *   AI_MODEL    – model name to request (default: llama3.2-vision)
 *   AI_API_KEY  – API key if required (default: "none")
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, type ChildProcess } from 'child_process';
import sharp from 'sharp';

// Disable libvips disk cache — all work stays in RAM
sharp.cache(false);

// ── Paths ────────────────────────────────────────────────────────────────────

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..');
const spritesheetsDir = join(rootDir, 'images', 'spritesheets');
const frameTagsDir = join(rootDir, 'game', 'src', 'data', 'frameTags');

// ── Caches (avoid redundant disk I/O) ───────────────────────────────────────

interface DecodedAtlas {
    data: Buffer;
    width: number;
    height: number;
}

const jsonSheetCache = new Map<string, TPSheet>();
const decodedAtlasCache = new Map<string, DecodedAtlas>();

// ── AI endpoint config ──────────────────────────────────────────────────────

const AI_BASE_URL = process.env['AI_BASE_URL'] ?? 'http://localhost:11434/v1';
const AI_MODEL = process.env['AI_MODEL'] ?? 'llama3.2-vision';
const AI_API_KEY = process.env['AI_API_KEY'] ?? 'none';

// ── Ollama lifecycle ────────────────────────────────────────────────────────

let ollamaProcess: ChildProcess | null = null;

/** Check if the AI server is reachable. */
async function isServerUp(): Promise<boolean> {
    try {
        const resp = await fetch(`${AI_BASE_URL}/models`, { signal: AbortSignal.timeout(2000) });
        return resp.ok;
    } catch {
        return false;
    }
}

/** Try to start `ollama serve` if the configured URL looks like Ollama. */
async function ensureOllamaRunning(): Promise<void> {
    if (await isServerUp()) return;

    // Only auto-start for Ollama's default port
    if (!AI_BASE_URL.includes('11434')) {
        throw new Error(
            `AI server not reachable at ${AI_BASE_URL}. Start your server and try again.`,
        );
    }

    console.log('Ollama not running — starting ollama serve…');
    ollamaProcess = spawn('ollama', ['serve'], {
        stdio: 'ignore',
        detached: false,
    });

    ollamaProcess.on('error', () => {
        throw new Error(
            'Could not start Ollama. Install it from https://ollama.com and make sure "ollama" is on your PATH.',
        );
    });

    // Wait for the server to become reachable
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (await isServerUp()) {
            console.log('Ollama is ready.\n');
            return;
        }
    }
    throw new Error('Timed out waiting for Ollama to start.');
}

function stopOllama(): void {
    if (ollamaProcess) {
        console.log('Stopping Ollama…');
        ollamaProcess.kill();
        ollamaProcess = null;
    }
}

// ── Types ───────────────────────────────────────────────────────────────────

interface TPFrame {
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
    anchor: { x: number; y: number };
}

interface TPSheet {
    frames: Record<string, TPFrame>;
    meta: {
        image: string;
        size: { w: number; h: number };
        related_multi_packs?: string[];
    };
}

/** Per-animation frame tag data. Extensible for future tags. */
interface AnimFrameTags {
    fireFrame?: number;
    // Future: footstep?: number[];
    [key: string]: unknown;
}

/** Top-level frame-tags file: animation name → tags. */
type FrameTagsFile = Record<string, AnimFrameTags>;

// ── Frame extraction helpers ────────────────────────────────────────────────

async function collectAnimFrames(
    spriteKey: string,
    animName: string,
    direction: string = '0',
): Promise<{ frameNum: number; sheet: TPSheet; sheetPath: string; entry: TPFrame }[]> {
    const sheetDir = join(spritesheetsDir, spriteKey);
    const files = await readdir(sheetDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const pattern = new RegExp(
        `^${escapeRegExp(spriteKey)}-${escapeRegExp(animName)}_${escapeRegExp(direction)}-(\\d+)$`,
    );

    const results: { frameNum: number; sheet: TPSheet; sheetPath: string; entry: TPFrame }[] = [];

    for (const jsonFile of jsonFiles) {
        const jsonPath = join(sheetDir, jsonFile);
        let sheet = jsonSheetCache.get(jsonPath);
        if (!sheet) {
            const raw = await readFile(jsonPath, 'utf-8');
            sheet = JSON.parse(raw) as TPSheet;
            jsonSheetCache.set(jsonPath, sheet);
        }

        for (const [frameName, entry] of Object.entries(sheet.frames)) {
            const m = frameName.match(pattern);
            if (!m) continue;
            results.push({
                frameNum: parseInt(m[1]!, 10),
                sheet,
                sheetPath: join(sheetDir, sheet.meta.image),
                entry,
            });
        }
    }

    results.sort((a, b) => a.frameNum - b.frameNum);
    return results;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Decode an atlas image to raw RGBA pixels (once per file). */
async function getDecodedAtlas(atlasPath: string): Promise<DecodedAtlas> {
    let decoded = decodedAtlasCache.get(atlasPath);
    if (!decoded) {
        const fileBuffer = await readFile(atlasPath);
        const { data, info } = await sharp(fileBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        decoded = { data, width: info.width, height: info.height };
        decodedAtlasCache.set(atlasPath, decoded);
    }
    return decoded;
}

/** Extract a rectangular region from raw RGBA pixels (pure memory, no I/O). */
function extractRegionRaw(
    atlas: DecodedAtlas,
    x: number, y: number, w: number, h: number,
): Buffer {
    const bpp = 4; // RGBA
    const srcStride = atlas.width * bpp;
    const dstStride = w * bpp;
    const out = Buffer.allocUnsafe(w * h * bpp);
    for (let r = 0; r < h; r++) {
        const srcOff = (y + r) * srcStride + x * bpp;
        atlas.data.copy(out, r * dstStride, srcOff, srcOff + dstStride);
    }
    return out;
}

/** Rotate raw RGBA pixels 90° counter-clockwise. Input (inW×inH) → output (inH×inW). */
function rotateCCW90(
    data: Buffer, inW: number, inH: number,
): { data: Buffer; width: number; height: number } {
    const bpp = 4;
    const outW = inH;
    const outH = inW;
    const out = Buffer.allocUnsafe(outW * outH * bpp);
    for (let r = 0; r < inH; r++) {
        for (let c = 0; c < inW; c++) {
            const srcOff = (r * inW + c) * bpp;
            const outR = inW - 1 - c;
            const outC = r;
            const dstOff = (outR * outW + outC) * bpp;
            data.copy(out, dstOff, srcOff, srcOff + bpp);
        }
    }
    return { data: out, width: outW, height: outH };
}

/** Extract a single animation frame as raw RGBA pixels (pure memory). */
async function extractFrame(
    atlasPath: string,
    entry: TPFrame,
): Promise<{ data: Buffer; width: number; height: number }> {
    const atlas = await getDecodedAtlas(atlasPath);
    const { x, y, w, h } = entry.frame;

    if (entry.rotated) {
        // In the atlas the frame is stored rotated CW: region is (h × w)
        const region = extractRegionRaw(atlas, x, y, h, w);
        return rotateCCW90(region, h, w);
    }

    return { data: extractRegionRaw(atlas, x, y, w, h), width: w, height: h };
}

// ── Strip composition ───────────────────────────────────────────────────────

const LABEL_HEIGHT = 24;
const PADDING = 4;

function makeLabelSvg(text: string, width: number): Buffer {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_HEIGHT}">
        <text x="${width / 2}" y="${LABEL_HEIGHT - 4}" text-anchor="middle"
              font-family="sans-serif" font-size="14" fill="white">${text}</text>
    </svg>`;
    return Buffer.from(svg);
}

async function buildStrip(
    frames: { frameNum: number; sheetPath: string; entry: TPFrame }[],
): Promise<Buffer> {
    const extracted: { frameNum: number; data: Buffer; w: number; h: number }[] = [];
    for (let i = 0; i < frames.length; i++) {
        const f = frames[i]!;
        const frame = await extractFrame(f.sheetPath, f.entry);
        extracted.push({ frameNum: f.frameNum, data: frame.data, w: frame.width, h: frame.height });
        process.stdout.write(`\r  Extracting frames… ${i + 1}/${frames.length}`);
    }
    process.stdout.write('\n');

    const maxH = Math.max(...extracted.map(e => e.h));
    const totalW = extracted.reduce((s, e) => s + e.w + PADDING, 0) - PADDING;
    const totalH = maxH + LABEL_HEIGHT + PADDING;

    const composites: sharp.OverlayOptions[] = [];
    let curX = 0;
    for (const e of extracted) {
        const yOff = Math.round((maxH - e.h) / 2);
        composites.push({
            input: e.data,
            raw: { width: e.w, height: e.h, channels: 4 },
            left: curX,
            top: LABEL_HEIGHT + PADDING + yOff,
        });
        composites.push({ input: makeLabelSvg(String(e.frameNum), e.w), left: curX, top: 0 });
        curX += e.w + PADDING;
    }

    return sharp({
        create: { width: totalW, height: totalH, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 255 } },
    })
        .composite(composites)
        .png()
        .toBuffer();
}

// ── AI vision call ──────────────────────────────────────────────────────────

async function askVisionModel(
    spriteKey: string,
    totalFrames: number,
    imageBase64: string,
): Promise<string> {
    const prompt = [
        `You are analysing the attack animation of a game character called "${spriteKey}".`,
        `The image shows ${totalFrames} sequential animation frames (left to right), each labelled with its 0-based frame number.`,
        `The character is facing to the right (direction 0°).`,
        '',
        'Examine the frames and determine the EXACT frame number where the attack projectile/weapon strike should be released.',
        'Consider:',
        '- For a bow: the frame where the arrow would leave the string',
        '- For a melee swing: the frame at the peak of the forward swing',
        '- For a spell cast: the frame where the magic effect would launch',
        '',
        'Respond with ONLY a JSON object in this format (no markdown, no extra text):',
        '{"fireFrame": <number>, "reason": "<brief reason>"}',
    ].join('\n');

    const body = {
        model: AI_MODEL || undefined,
        messages: [
            {
                role: 'user' as const,
                content: [
                    { type: 'text' as const, text: prompt },
                    { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${imageBase64}` } },
                ],
            },
        ],
        temperature: 0.2,
        max_tokens: 256,
    };

    const resp = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AI request failed (${resp.status}): ${text}`);
    }

    const json = (await resp.json()) as { choices: { message: { content: string } }[] };
    return json.choices[0]?.message.content ?? '';
}

function parseFireFrame(raw: string, maxFrame: number): { fireFrame: number; reason: string } | null {
    const jsonMatch = raw.match(/\{[\s\S]*?"fireFrame"\s*:\s*(\d+)[\s\S]*?\}/);
    if (!jsonMatch) return null;

    try {
        const parsed = JSON.parse(jsonMatch[0]) as { fireFrame: number; reason?: string };
        if (parsed.fireFrame < 0 || parsed.fireFrame > maxFrame) return null;
        return { fireFrame: parsed.fireFrame, reason: parsed.reason ?? '' };
    } catch {
        return null;
    }
}

// ── Frame-tags file I/O ─────────────────────────────────────────────────────

async function readFrameTags(spriteKey: string): Promise<FrameTagsFile> {
    const filePath = join(frameTagsDir, `${spriteKey}.json`);
    try {
        const raw = await readFile(filePath, 'utf-8');
        return JSON.parse(raw) as FrameTagsFile;
    } catch {
        return {};
    }
}

async function writeFrameTags(spriteKey: string, tags: FrameTagsFile): Promise<void> {
    await mkdir(frameTagsDir, { recursive: true });
    const filePath = join(frameTagsDir, `${spriteKey}.json`);
    await writeFile(filePath, JSON.stringify(tags, null, 4) + '\n', 'utf-8');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function discoverSpriteKeysWithAnim(animName: string): Promise<string[]> {
    const manifestPath = join(spritesheetsDir, 'manifest.json');
    const raw = await readFile(manifestPath, 'utf-8');
    const manifest: Record<string, string[]> = JSON.parse(raw);

    const keys: string[] = [];
    for (const key of Object.keys(manifest)) {
        if (key.endsWith('_shadow')) continue;
        try {
            const frames = await collectAnimFrames(key, animName);
            if (frames.length > 0) keys.push(key);
        } catch {
            // skip
        }
    }
    return keys;
}

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);

    // Parse --anim flag
    let animName = 'attack';
    const filteredArgs: string[] = [];
    for (let i = 0; i < rawArgs.length; i++) {
        if (rawArgs[i] === '--anim' && i + 1 < rawArgs.length) {
            animName = rawArgs[++i]!;
        } else {
            filteredArgs.push(rawArgs[i]!);
        }
    }

    let spriteKeys: string[];
    if (filteredArgs.length > 0) {
        spriteKeys = filteredArgs;
    } else {
        console.log(`No sprite keys specified — scanning for all sprites with "${animName}" animations…`);
        spriteKeys = await discoverSpriteKeysWithAnim(animName);
        if (spriteKeys.length === 0) {
            console.log(`No ${animName} animations found.`);
            return;
        }
        console.log(`Found: ${spriteKeys.join(', ')}\n`);
    }

    await ensureOllamaRunning();

    const results: Record<string, { fireFrame: number; reason: string }> = {};

    for (const key of spriteKeys) {
        console.log(`── ${key} ──`);

        try {
            // 1. Collect animation frames (direction 0 = facing right)
            const frames = await collectAnimFrames(key, animName, '0');
            if (frames.length === 0) {
                console.log(`  No ${animName}_0 frames found, skipping.\n`);
                continue;
            }
            console.log(`  ${frames.length} ${animName} frames (${frames[0]!.frameNum}–${frames[frames.length - 1]!.frameNum})`);

            // 2. Build a numbered strip (in memory only)
            console.log('  Building strip…');
            const stripBuf = await buildStrip(frames);

            // 3. Ask the AI
            const base64 = stripBuf.toString('base64');
            const maxFrame = frames[frames.length - 1]!.frameNum;
            const raw = await askVisionModel(key, frames.length, base64);
            console.log(`  AI response: ${raw.trim()}`);

            const parsed = parseFireFrame(raw, maxFrame);
            if (parsed) {
                results[key] = parsed;

                // 4. Merge into frame-tags JSON
                const tags = await readFrameTags(key);
                if (!tags[animName]) tags[animName] = {};
                tags[animName]!.fireFrame = parsed.fireFrame;
                await writeFrameTags(key, tags);

                console.log(`  ✓ fireFrame = ${parsed.fireFrame} — ${parsed.reason}`);
                console.log(`  Written → src/data/frameTags/${key}.json\n`);
            } else {
                console.log('  ✗ Could not parse a valid fireFrame from AI response.\n');
            }
        } catch (err) {
            console.error(`  ✗ Error: ${(err as Error).message}\n`);
        }
    }

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('Summary:');
    for (const [key, { fireFrame, reason }] of Object.entries(results)) {
        console.log(`  ${key}: fireFrame = ${fireFrame}  (${reason})`);
    }
    if (Object.keys(results).length === 0) {
        console.log('  (no results)');
    }
    console.log('═══════════════════════════════════════');

    stopOllama();
}

main().catch(err => {
    stopOllama();
    console.error('Fatal:', err);
    process.exit(1);
});
