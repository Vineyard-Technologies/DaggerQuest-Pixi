import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
    },
    server: {
        headers: {
            // Only allow DaggerQuest.com to embed this site in an iframe.
            'Content-Security-Policy': "frame-ancestors 'self' https://daggerquest.com https://www.daggerquest.com",
            'X-Frame-Options': 'DENY',
        },
    },
});
