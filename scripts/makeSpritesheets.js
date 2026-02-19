const { exec } = require('child_process');
const { promisify } = require('util');
const { readdir, mkdir, writeFile } = require('fs/promises');
const { join, dirname, relative } = require('path');

const execAsync = promisify(exec);

// __dirname is available directly in CommonJS
const scriptDir = __dirname;
const rootDir = join(scriptDir, '..');

// Parameters
const sourceDirectory = process.argv[2] || join(rootDir, 'images');
const outputDirectory = process.argv[3] || join(rootDir, 'spritesheets');
const manifestFileName = process.argv[4] || 'manifest.json';

// Check if directory exists and has files
async function directoryHasJsonFiles(dirPath) {
    try {
        const files = await readdir(dirPath);
        return files.some(file => file.endsWith('.json'));
    } catch (error) {
        return false;
    }
}

// Main execution
async function main() {

    // Ensure the spritesheets directory exists
    try {
        await mkdir(outputDirectory, { recursive: true });
        console.log('Spritesheets directory ready');
    } catch (error) {
        // Directory already exists
    }

    // Check TexturePacker version
    try {
        const { stdout } = await execAsync('TexturePacker --version');
        console.log(stdout.trim());
    } catch (error) {
        console.error('TexturePacker not found. Please ensure it is installed and in your PATH.');
        process.exit(1);
    }

    console.log('Source Directory:', sourceDirectory);
    console.log('Output Directory:', outputDirectory);

    // Get all subdirectories
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    const subDirs = entries.filter(entry => entry.isDirectory());

    for (const dir of subDirs) {
        const folderName = dir.name;
        const fullName = join(sourceDirectory, folderName);
        const outputFolderPath = join(outputDirectory, folderName);

        // Check if this folder has already been processed
        if (await directoryHasJsonFiles(outputFolderPath)) {
            console.log(`Skipping folder: ${folderName} (already processed)`);
            continue;
        }

        console.log(`Processing folder: ${folderName}`);

        try {
            const command = `TexturePacker "${join(scriptDir, 'TexturePackerSettings.tps')}" --sheet "${outputDirectory}\\${folderName}\\${folderName}-{n}.webp" --data "${outputDirectory}\\${folderName}\\${folderName}-{n}.json" "${fullName}"`;
            const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
        } catch (error) {
            console.error(`Error processing ${folderName}:`, error.message);
        }
    }

    // Create the manifest
    console.log('Creating manifest...');
    const folderData = {};

    async function scanDirectory(dirPath) {
        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dirPath, entry.name);

            if (entry.isDirectory()) {
                await scanDirectory(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== manifestFileName) {
                const folderName = dirname(relative(outputDirectory, fullPath)).split('\\')[0];
                
                if (!folderData[folderName]) {
                    folderData[folderName] = [];
                }

                // Make the path relative to the spritesheets directory
                const relativePath = './' + relative(outputDirectory, fullPath).replace(/\\/g, '/');
                folderData[folderName].push(relativePath);
            }
        }
    }

    await scanDirectory(outputDirectory);

    const outputJson = JSON.stringify(folderData, null, 2);
    const outputJsonPath = join(outputDirectory, manifestFileName);

    await writeFile(outputJsonPath, outputJson, 'utf8');

    console.log(`JSON file created at ${outputJsonPath}`);
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
