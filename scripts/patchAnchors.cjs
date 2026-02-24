/**
 * patchAnchors.js
 *
 * Patches the "anchor" field in spritesheet JSON files with the correct
 * per-frame origin data from DaggerQuest objectType JSON files.
 *
 * Recursively scans the entire DaggerQuest objectTypes directory for JSON
 * files that contain animation data with originX/originY per frame.  Each
 * objectType JSON has a "name" field (e.g. "man", "goblinArcher",
 * "man_simpleSword_gear") which is matched case-insensitively to a
 * spritesheet folder in the spritesheets directory.
 *
 * Spritesheet frame names follow the pattern:
 *   <objectName>-<animType>_<direction>-<frameIndex>
 *   e.g. man-walk_135-008
 *
 * Usage:
 *   node scripts/patchAnchors.js [daggerQuestObjectTypesDir] [spritesheetsDir]
 *
 * Defaults:
 *   daggerQuestObjectTypesDir = ../DaggerQuest/objectTypes
 *   spritesheetsDir           = ./images/spritesheets
 */

const { readdir, readFile, writeFile, stat } = require('fs/promises');
const { join, basename, relative } = require('path');

const scriptDir = __dirname;
const rootDir = join(scriptDir, '..');

const objectTypesDir = process.argv[2]
    || join(rootDir, '..', 'DaggerQuest', 'objectTypes');
const spritesheetsDir = process.argv[3]
    || join(rootDir, 'images', 'spritesheets');

async function main() {
    // 1. Recursively discover all objectType JSON files
    const objectTypeFiles = await findJsonFiles(objectTypesDir);
    console.log(`Found ${objectTypeFiles.length} objectType JSON file(s) in ${objectTypesDir}`);

    // Build an index of spritesheet folder names (lowercase → actual name)
    const sheetFolderIndex = {};
    for (const entry of await readdir(spritesheetsDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            sheetFolderIndex[entry.name.toLowerCase()] = entry.name;
        }
    }

    let grandTotal = 0;
    let objectsPatched = 0;
    let objectsSkippedNoAnims = 0;
    let objectsSkippedNoSheet = 0;

    for (const otPath of objectTypeFiles) {
        const relPath = relative(objectTypesDir, otPath);
        let otData;
        try {
            otData = JSON.parse(await readFile(otPath, 'utf8'));
        } catch (err) {
            console.log(`  [!] ${relPath}: failed to parse JSON, skipping. (${err.message})`);
            continue;
        }

        // Use the "name" field from the JSON as the object identifier.
        // Fall back to the filename (without extension) if "name" is missing.
        const objectName = otData.name || basename(otPath, '.json');

        // Build a lookup:  "walk_135" → [ { originX, originY }, … ]
        const originsByAnim = buildOriginLookup(otData);

        if (Object.keys(originsByAnim).length === 0) {
            objectsSkippedNoAnims++;
            continue;
        }

        // 2. Find matching spritesheet folder case-insensitively
        const sheetDirName = sheetFolderIndex[objectName.toLowerCase()];
        if (!sheetDirName) {
            objectsSkippedNoSheet++;
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
            continue;
        }

        let totalPatched = 0;

        for (const sheetFile of sheetFiles) {
            const sheetPath = join(sheetDir, sheetFile);
            const sheetJson = await readFile(sheetPath, 'utf8');
            const sheetData = JSON.parse(sheetJson);

            let patchedInFile = 0;

            // Build regex using the actual spritesheet prefix (lowercase)
            // Pattern 1: directional frames — man-walk_135-008
            const directionalRegex = new RegExp(
                `^${escapeRegex(sheetDirName)}-([\\w]+_[\\-\\d.]+)-(\\d+)$`, 'i'
            );
            // Pattern 2: non-directional (static) frames — farmhouse-animation 1-000, cart-default-000
            const staticRegex = new RegExp(
                `^${escapeRegex(sheetDirName)}-(.+?)-(\\d+)$`, 'i'
            );

            for (const frameName in sheetData.frames) {
                let animKey = null;
                let frameIndex = null;

                // Try directional pattern first (more specific)
                const dirMatch = frameName.match(directionalRegex);
                if (dirMatch) {
                    animKey = dirMatch[1];
                    frameIndex = parseInt(dirMatch[2]);
                } else {
                    // Try static/non-directional pattern
                    const statMatch = frameName.match(staticRegex);
                    if (statMatch) {
                        animKey = statMatch[1];
                        frameIndex = parseInt(statMatch[2]);
                    }
                }

                if (animKey === null) continue;

                // Try exact match first, then case-insensitive match
                let origins = originsByAnim[animKey];
                if (!origins) {
                    // Case-insensitive lookup (objectType may have "Default" while frame has "default")
                    const lowerKey = animKey.toLowerCase();
                    for (const key in originsByAnim) {
                        if (key.toLowerCase() === lowerKey) {
                            origins = originsByAnim[key];
                            break;
                        }
                    }
                }

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

        if (totalPatched > 0) {
            console.log(`  ${objectName}: patched ${totalPatched} anchor(s) across ${sheetFiles.length} file(s).`);
            grandTotal += totalPatched;
            objectsPatched++;
        }
    }

    console.log(`\nSummary: ${grandTotal} total anchor(s) patched across ${objectsPatched} object(s).`);
    console.log(`  ${objectsSkippedNoAnims} object(s) had no animation data.`);
    console.log(`  ${objectsSkippedNoSheet} object(s) had no matching spritesheet folder.`);
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
 * Recursively find all .json files under a directory.
 */
async function findJsonFiles(dir) {
    const results = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...await findJsonFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            results.push(fullPath);
        }
    }
    return results;
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
