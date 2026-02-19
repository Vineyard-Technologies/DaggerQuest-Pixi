/**
 * patchAnchors.js
 *
 * Patches the "anchor" field in spritesheet JSON files with the correct
 * per-frame origin data from DaggerQuest objectType JSON files.
 *
 * Spritesheet frame names follow the pattern:
 *   <objectName>-<animType>_<direction>-<frameIndex>
 *   e.g. man-walk_135-008
 *
 * The DaggerQuest objectType JSON stores per-frame originX / originY
 * under animations.subfolders[].items[].frames[].
 *
 * Usage:
 *   node scripts/patchAnchors.js [daggerQuestObjectTypesDir] [spritesheetsDir]
 *
 * Defaults:
 *   daggerQuestObjectTypesDir = ../DaggerQuest/objectTypes/characters
 *   spritesheetsDir           = ./spritesheets
 */

const { readdir, readFile, writeFile } = require('fs/promises');
const { join, basename } = require('path');

const scriptDir = __dirname;
const rootDir = join(scriptDir, '..');

const objectTypesDir = process.argv[2]
    || join(rootDir, '..', 'DaggerQuest', 'objectTypes', 'characters');
const spritesheetsDir = process.argv[3]
    || join(rootDir, 'spritesheets');

async function main() {
    // 1. Discover objectType JSON files
    const objectTypeFiles = (await readdir(objectTypesDir))
        .filter(f => f.endsWith('.json'));

    console.log(`Found ${objectTypeFiles.length} objectType file(s) in ${objectTypesDir}`);

    for (const otFile of objectTypeFiles) {
        const objectName = basename(otFile, '.json'); // e.g. "man"
        const otPath = join(objectTypesDir, otFile);
        const otData = JSON.parse(await readFile(otPath, 'utf8'));

        // Build a lookup:  "walk_135" → [ { frameIndex, originX, originY }, … ]
        const originsByAnim = buildOriginLookup(otData);

        if (Object.keys(originsByAnim).length === 0) {
            console.log(`  ${objectName}: no animation origin data found, skipping.`);
            continue;
        }

        // 2. Find matching spritesheet folders  (e.g. spritesheets/man/)
        //    ObjectType names are camelCase (goblinArcher) but spritesheet
        //    folders are lowercase (goblinarcher), so match case-insensitively.
        const sheetDirName = await findCaseInsensitive(spritesheetsDir, objectName);
        if (!sheetDirName) {
            console.log(`  ${objectName}: no spritesheet folder found, skipping.`);
            continue;
        }
        const sheetDir = join(spritesheetsDir, sheetDirName);
        let sheetFiles;
        try {
            sheetFiles = (await readdir(sheetDir)).filter(f => f.endsWith('.json'));
        } catch {
            console.log(`  ${objectName}: could not read spritesheet folder ${sheetDir}, skipping.`);
            continue;
        }

        if (sheetFiles.length === 0) {
            console.log(`  ${objectName}: no spritesheet JSON files found, skipping.`);
            continue;
        }

        let totalPatched = 0;

        for (const sheetFile of sheetFiles) {
            const sheetPath = join(sheetDir, sheetFile);
            const sheetJson = await readFile(sheetPath, 'utf8');
            const sheetData = JSON.parse(sheetJson);

            let patchedInFile = 0;

            // Build regex using the actual spritesheet prefix (lowercase)
            const frameRegex = new RegExp(
                `^${escapeRegex(sheetDirName)}-([\\w]+_[\\-\\d.]+)-(\\d+)$`, 'i'
            );

            for (const frameName in sheetData.frames) {
                // Parse:  man-walk_135-008  →  animKey="walk_135", frameIndex=8
                const match = frameName.match(frameRegex);
                if (!match) continue;

                const animKey = match[1];             // e.g. "walk_135"
                const frameIndex = parseInt(match[2]); // e.g. 8

                const origins = originsByAnim[animKey];
                if (!origins || frameIndex >= origins.length) continue;

                const { originX, originY } = origins[frameIndex];

                // Patch the anchor
                sheetData.frames[frameName].anchor = { x: originX, y: originY };
                patchedInFile++;
            }

            if (patchedInFile > 0) {
                // Write back with same formatting style (tab-indented like TexturePacker)
                await writeFile(sheetPath, JSON.stringify(sheetData, null, '\t'), 'utf8');
                totalPatched += patchedInFile;
            }
        }

        console.log(`  ${objectName}: patched ${totalPatched} frame anchor(s) across ${sheetFiles.length} spritesheet file(s).`);
    }

    console.log('Done.');
}

/**
 * Builds a map of animKey → frame origins from a DaggerQuest objectType JSON.
 * animKey is e.g. "walk_135", "idle_-22.5"
 */
function buildOriginLookup(otData) {
    const result = {};

    if (!otData.animations || !otData.animations.subfolders) return result;

    for (const subfolder of otData.animations.subfolders) {
        // subfolder.name is the anim group, e.g. "walk"
        // subfolder.items[] are individual directional animations
        for (const item of subfolder.items || []) {
            // item.name is e.g. "walk_135"
            const animKey = item.name;
            result[animKey] = (item.frames || []).map(frame => ({
                originX: frame.originX,
                originY: frame.originY
            }));
        }

        // Also handle items at the top level (non-subfolder)
    }

    // Handle top-level items if any
    for (const item of otData.animations.items || []) {
        const animKey = item.name;
        result[animKey] = (item.frames || []).map(frame => ({
            originX: frame.originX,
            originY: frame.originY
        }));
    }

    return result;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find a directory entry matching `name` case-insensitively.
 * Returns the actual on-disk name, or null if not found.
 */
async function findCaseInsensitive(parentDir, name) {
    try {
        const entries = await readdir(parentDir);
        const lower = name.toLowerCase();
        return entries.find(e => e.toLowerCase() === lower) || null;
    } catch {
        return null;
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
