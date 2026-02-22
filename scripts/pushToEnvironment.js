const { cpSync, existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const rootDir = join(__dirname, '..');

// Environment targets
const environments = {
    production: 'C:\\Users\\Andrew\\Documents\\GitHub\\DaggerQuest.com\\public\\game',
    test: 'C:\\Users\\Andrew\\Documents\\GitHub\\DaggerQuest-Test-Realm\\public\\game'
};

// Parse command line argument
const arg = process.argv[2];

if (!arg || !environments[arg]) {
    console.error('Usage: node scripts/pushToEnvironment.js <production|test>');
    console.error('  production  -> DaggerQuest.com');
    console.error('  test        -> DaggerQuest-Test-Realm');
    process.exit(1);
}

const targetDir = environments[arg];

// Verify source directories exist
const sourceDirs = [
    { src: join(rootDir, 'index.html'), label: 'index.html' },
    { src: join(rootDir, 'src'),         label: 'src/' },
    { src: join(rootDir, 'spritesheets'), label: 'spritesheets/' }
];

for (const { src, label } of sourceDirs) {
    if (!existsSync(src)) {
        console.error(`Source not found: ${label} (${src})`);
        process.exit(1);
    }
}

// Verify target directory exists
if (!existsSync(targetDir)) {
    console.error(`Target directory does not exist: ${targetDir}`);
    process.exit(1);
}

console.log(`Pushing to ${arg} environment: ${targetDir}\n`);

// Clear and recreate the target game folder
console.log('Clearing existing game folder...');
rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

// Copy index.html and uncomment the <base> tag for deployed environments
console.log('Copying index.html...');
cpSync(join(rootDir, 'index.html'), join(targetDir, 'index.html'));
const indexPath = join(targetDir, 'index.html');
let indexHtml = readFileSync(indexPath, 'utf-8');
indexHtml = indexHtml.replace('<!-- <base href="/game/"> -->', '<base href="/game/">');
writeFileSync(indexPath, indexHtml, 'utf-8');

// Copy src/
console.log('Copying src/...');
cpSync(join(rootDir, 'src'), join(targetDir, 'src'), { recursive: true });

// Copy spritesheets/
console.log('Copying spritesheets/...');
cpSync(join(rootDir, 'spritesheets'), join(targetDir, 'spritesheets'), { recursive: true });

console.log(`\nDone! Game pushed to ${arg}.`);
