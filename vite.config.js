import { defineConfig } from 'vite';
import { cpSync } from 'fs';

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
    },
    plugins: [{
        name: 'copy-game-assets',
        closeBundle() {
            cpSync('images/spritesheets', 'dist/images/spritesheets', { recursive: true });
        },
    }],
});
