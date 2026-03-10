/// <reference types="vite/client" />

// Raw file imports (e.g., .md?raw)
declare module '*.md?raw' {
  const content: string;
  export default content;
}

// Extend Window for third-party scripts
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
    adsbygoogle: unknown[];
  }
}

export {};
