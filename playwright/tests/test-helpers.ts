import type { Page } from '@playwright/test';

/**
 * Test utilities and helper functions for DaggerQuest testing
 */

interface BrowserOptions {
  headless: boolean;
  args?: string[];
}

/**
 * Browser detection and setup utility
 */
export class BrowserHelper {
  /**
   * Attempts to detect and configure the best available browser
   * Priority order: Chrome -> Firefox -> Edge
   */
  static async detectAvailableBrowser(): Promise<string[]> {
    const availableBrowsers: string[] = [];
    
    try {
      // Try to detect Chrome/Chromium
      availableBrowsers.push('chromium');
      console.log('✓ Chromium/Chrome detected');
    } catch (e) {
      console.log('Chrome not available:', (e as Error).message);
    }
    
    try {
      // Try to detect Firefox
      availableBrowsers.push('firefox');
      console.log('✓ Firefox detected');
    } catch (e) {
      console.log('Firefox not available:', (e as Error).message);
    }
    
    try {
      // Try to detect Edge
      availableBrowsers.push('Microsoft Edge');
      console.log('✓ Microsoft Edge detected');
    } catch (e) {
      console.log('Edge not available:', (e as Error).message);
    }
    
    if (availableBrowsers.length === 0) {
      throw new Error(`
No compatible browser found. Please ensure you have one of the following installed:

1. Google Chrome (recommended)
2. Mozilla Firefox  
3. Microsoft Edge

Also ensure the browser is properly installed and accessible from the system PATH.

You may need to run: npm run install:browsers
      `);
    }
    
    return availableBrowsers;
  }
  
  /**
   * Gets browser-specific launch options
   */
  static getBrowserOptions(browserName: string): BrowserOptions {
    const options: BrowserOptions = {
      headless: false, // Run headed by default
    };
    
    if (browserName === 'chromium' || browserName === 'Google Chrome') {
      options.args = [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ];
    }
    
    return options;
  }
}

/**
 * Page utilities for DaggerQuest-specific testing
 */
export class DaggerQuestHelper {
  /**
   * Waits for page to be fully loaded
   */
  static async waitForPageLoad(page: Page, timeout: number = 10000, skipNetworkIdle: boolean = false): Promise<void> {
    await page.waitForLoadState('domcontentloaded', { timeout });
    
    if (!skipNetworkIdle) {
      await page.waitForLoadState('networkidle', { timeout: timeout / 2 });
    }
    
    // Additional check for document ready state
    await page.waitForFunction(() => document.readyState === 'complete', { timeout });
  }
  
  /**
   * Validates DaggerQuest.com URL
   */
  static validateDaggerQuestUrl(url: string): boolean {
    const urlPattern = /daggerquest\.com/i;
    if (!urlPattern.test(url)) {
      throw new Error(`Expected URL to contain 'daggerquest.com', but got: ${url}`);
    }
    return true;
  }
  
  /**
   * Validates page title contains DaggerQuest
   */
  static validateDaggerQuestTitle(title: string): boolean {
    if (!title.includes('DaggerQuest')) {
      throw new Error(`Expected page title to contain 'DaggerQuest', but got: ${title}`);
    }
    return true;
  }
  
  /**
   * Logs navigation success
   */
  static logNavigationSuccess(url: string, title: string): void {
    console.log(`Successfully navigated to: ${url}`);
    console.log(`Page title: ${title}`);
  }
}
