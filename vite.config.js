import { defineConfig } from 'vite';
import { cpSync, rmSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const deployTargets = {
    'deploy-prod': {
        label: 'production',
        path: 'C:\\Users\\Andrew\\Documents\\GitHub\\DaggerQuest.com\\public\\game',
    },
    'deploy-test': {
        label: 'test',
        path: 'C:\\Users\\Andrew\\Documents\\GitHub\\DaggerQuest-Test-Realm\\public\\game',
    },
};

export default defineConfig(({ mode }) => {
    const deploy = deployTargets[mode];

    return {
        root: '.',
        base: deploy ? '/game/' : '/',
        build: {
            outDir: 'dist',
        },
        plugins: [{
            name: 'copy-and-deploy',
            closeBundle() {
                cpSync('images/spritesheets', 'dist/images/spritesheets', { recursive: true });

                if (deploy) {
                    const { label, path: targetDir } = deploy;
                    const parentDir = dirname(targetDir);

                    if (!existsSync(parentDir)) {
                        console.error(`Target parent directory does not exist: ${parentDir}`);
                        process.exit(1);
                    }

                    console.log(`\nDeploying to ${label}: ${targetDir}`);

                    rmSync(targetDir, { recursive: true, force: true });
                    mkdirSync(targetDir, { recursive: true });
                    cpSync('dist', targetDir, { recursive: true });

                    console.log(`Game deployed to ${label}.`);
                }
            },
        }],
    };
});
