/// <reference types="vite/client" />

declare global {
    interface Window {
        debug: () => Promise<void>;
        exitdebug: () => Promise<void>;
    }
}

export {};
