import { readdir, writeFile } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..');

const spritesheetsDir = process.argv[2] || join(rootDir, 'images', 'spritesheets');
const manifestFileName = 'manifest.json';

async function scanDirectory(
    dirPath: string,
    folderData: Record<string, string[]>,
): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
            await scanDirectory(fullPath, folderData);
        } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== manifestFileName) {
            const folderName = relative(spritesheetsDir, fullPath).split(/[\\/]/)[0]!;

            if (!folderData[folderName]) {
                folderData[folderName] = [];
            }

            const relativePath = './' + relative(spritesheetsDir, fullPath).replace(/\\/g, '/');
            folderData[folderName]!.push(relativePath);
        }
    }
}

async function main(): Promise<void> {
    console.log('Scanning:', spritesheetsDir);

    const folderData: Record<string, string[]> = {};
    await scanDirectory(spritesheetsDir, folderData);

    const outputPath = join(spritesheetsDir, manifestFileName);
    await writeFile(outputPath, JSON.stringify(folderData, null, 2), 'utf8');

    console.log(`Manifest written to ${outputPath} (${Object.keys(folderData).length} keys)`);
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
