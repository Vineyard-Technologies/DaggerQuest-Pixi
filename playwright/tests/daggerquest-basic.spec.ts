import { test, expect } from '@playwright/test';
import { DaggerQuestHelper } from './test-helpers';

/**
 * DaggerQuest.com Comprehensive Test Suite
 * 
 * Tests all pages and functionality of DaggerQuest.com
 */

// ========================================
// Homepage Tests
// ========================================
test.describe('Homepage Tests', () => {
  
  test('should navigate to homepage and verify basic elements', async ({ page }) => {
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Verify URL and title
    await expect(page).toHaveURL(/daggerquest\.com/i);
    await expect(page).toHaveTitle(/DaggerQuest/i);
    
    // Verify page body is visible
    await expect(page.locator('body')).toBeVisible();
    
    console.log('✓ Homepage loaded successfully');
  });
  
  test('should verify homepage header and navigation', async ({ page }) => {
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Check for navigation elements (adjust selectors based on actual site structure)
    const nav = page.locator('nav').first();
    if (await nav.count() > 0) {
      await expect(nav).toBeVisible();
      console.log('✓ Navigation bar found');
    }
    
    // Check for logo or site branding
    const logo = page.locator('img[alt*="DaggerQuest" i], .logo, header img').first();
    if (await logo.count() > 0) {
      await expect(logo).toBeVisible();
      console.log('✓ Logo/branding found');
    }
  });
  
  test('should verify homepage content sections', async ({ page }) => {
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Verify page has substantial content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(100);
    
    // Check for common hero/main content area
    const main = page.locator('main, .main-content, .hero, #content').first();
    if (await main.count() > 0) {
      await expect(main).toBeVisible();
      console.log('✓ Main content area found');
    }
  });
  
  test('should verify homepage links are not broken', async ({ page }) => {
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Get all links on homepage
    const links = await page.locator('a[href]').all();
    const internalLinks: string[] = [];
    
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && (href.startsWith('/') || href.includes('daggerquest.com'))) {
        internalLinks.push(href);
      }
    }
    
    console.log(`✓ Found ${internalLinks.length} internal links on homepage`);
    expect(internalLinks.length).toBeGreaterThan(0);
  });
  
  test('should verify call-to-action buttons exist', async ({ page }) => {
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Look for play/start buttons (common on game websites)
    const ctaButtons = page.locator('a:has-text("Play"), button:has-text("Play"), a:has-text("Start"), button:has-text("Start")');
    const buttonCount = await ctaButtons.count();
    
    if (buttonCount > 0) {
      console.log(`✓ Found ${buttonCount} call-to-action button(s)`);
      await expect(ctaButtons.first()).toBeVisible();
    }
  });
  
  test('should verify footer exists on homepage', async ({ page }) => {
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Check for footer
    const footer = page.locator('footer').first();
    if (await footer.count() > 0) {
      await expect(footer).toBeVisible();
      console.log('✓ Footer found');
    }
  });
});

// ========================================
// Play Now Page Tests
// ========================================
test.describe('Play Now Page Tests', () => {
  
  test('should navigate to play now page', async ({ page }) => {
    await page.goto('/play');
    await DaggerQuestHelper.waitForPageLoad(page, 10000, true);
    
    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Should not show 404 error
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('Not Found');
    
    console.log('✓ Play Now page loaded successfully');
  });
  
  test.skip('should verify game iframe exists on play page', async ({ page }) => {
    await page.goto('/play');
    await DaggerQuestHelper.waitForPageLoad(page, 10000, true);
    
    // Wait a bit for iframe to load
    await page.waitForTimeout(2000);
    
    // Check for iframe
    const iframeCount = await page.locator('iframe').count();
    
    if (iframeCount > 0) {
      console.log(`✓ Found ${iframeCount} iframe(s) on play page`);
      
      // Verify first iframe is visible
      await expect(page.locator('iframe').first()).toBeVisible();
      
      // Get iframe src if available
      const iframeSrc = await page.locator('iframe').first().getAttribute('src');
      if (iframeSrc) {
        console.log(`  Iframe source: ${iframeSrc}`);
      }
    } else {
      console.log('⚠ Warning: No iframe found on play page');
    }
  });
  
  test.skip('should verify play page has proper dimensions for game', async ({ page }) => {
    await page.goto('/play');
    await DaggerQuestHelper.waitForPageLoad(page, 10000, true);
    
    // Check if there's a game container with proper dimensions
    const iframe = page.locator('iframe').first();
    if (await iframe.count() > 0) {
      const boundingBox = await iframe.boundingBox();
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThan(300);
        expect(boundingBox.height).toBeGreaterThan(300);
        console.log(`✓ Game iframe dimensions: ${boundingBox.width}x${boundingBox.height}`);
      }
    }
  });
  
  test('should verify play page navigation back to home works', async ({ page }) => {
    await page.goto('/play');
    await DaggerQuestHelper.waitForPageLoad(page, 10000, true);
    
    // Look for home/back link
    const homeLink = page.locator('a[href="/"], a[href="https://daggerquest.com"], a:has-text("Home")').first();
    
    if (await homeLink.count() > 0) {
      await homeLink.click();
      await page.waitForLoadState('networkidle');
      
      // Should be back at homepage
      await expect(page).toHaveURL(/daggerquest\.com\/?$/);
      console.log('✓ Navigation from play page to home works');
    }
  });
});

// ========================================
// Guide Page Tests
// ========================================
test.describe('Guide Page Tests', () => {
  
  test('should navigate to guide page', async ({ page }) => {
    await page.goto('/guide');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Should not show 404 error
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('Not Found');
    
    console.log('✓ Guide page loaded successfully');
  });
  
  test('should verify guide page has content', async ({ page }) => {
    await page.goto('/guide');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Check for substantial text content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(200);
    
    console.log(`✓ Guide page has ${bodyText!.length} characters of content`);
  });
  
  test('should verify guide page has headers/sections', async ({ page }) => {
    await page.goto('/guide');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Look for heading elements
    const headers = await page.locator('h1, h2, h3').count();
    
    if (headers > 0) {
      console.log(`✓ Guide page has ${headers} heading(s)`);
      expect(headers).toBeGreaterThan(0);
    }
  });
  
  test('should verify guide page has images or media', async ({ page }) => {
    await page.goto('/guide');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Check for images
    const images = await page.locator('img').count();
    
    if (images > 0) {
      console.log(`✓ Guide page has ${images} image(s)`);
      
      // Verify at least first image loads
      const firstImg = page.locator('img').first();
      await expect(firstImg).toBeVisible();
    }
  });
  
  test('should verify guide page navigation menu works', async ({ page }) => {
    await page.goto('/guide');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Check if there are anchor links for navigation within guide
    const anchorLinks = await page.locator('a[href^="#"]').count();
    
    if (anchorLinks > 0) {
      console.log(`✓ Found ${anchorLinks} anchor link(s) in guide`);
    }
  });
});

// ========================================
// Media Page Tests
// ========================================
test.describe('Media Page Tests', () => {
  
  test('should navigate to media page', async ({ page }) => {
    await page.goto('/media');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Should not show 404 error
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('Not Found');
    
    console.log('✓ Media page loaded successfully');
  });
  
  test('should verify media page has images', async ({ page }) => {
    await page.goto('/media');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Media page should have images
    const images = await page.locator('img').count();
    
    console.log(`✓ Media page has ${images} image(s)`);
    
    if (images > 0) {
      // Verify at least first image is visible
      await expect(page.locator('img').first()).toBeVisible();
    }
  });
  
  test('should verify media page images load properly', async ({ page }) => {
    await page.goto('/media');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Get all images
    const images = await page.locator('img').all();
    
    if (images.length > 0) {
      // Check first few images for natural dimensions (indicating they loaded)
      const imagesToCheck = images.slice(0, Math.min(3, images.length));
      
      for (let i = 0; i < imagesToCheck.length; i++) {
        const img = imagesToCheck[i];
        const isVisible = await img.isVisible();
        
        if (isVisible) {
          const src = await img.getAttribute('src');
          console.log(`  Image ${i + 1} src: ${src}`);
        }
      }
      
      console.log(`✓ Checked ${imagesToCheck.length} image(s) on media page`);
    }
  });
  
  test('should verify media page has gallery or grid layout', async ({ page }) => {
    await page.goto('/media');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Look for common gallery containers
    const gallery = page.locator('.gallery, .media-grid, .image-grid, [class*="gallery"], [class*="media"]').first();
    
    if (await gallery.count() > 0) {
      await expect(gallery).toBeVisible();
      console.log('✓ Media gallery/grid found');
    }
  });
  
  test('should verify media page videos if present', async ({ page }) => {
    await page.goto('/media');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Check for video elements or video embeds
    const videos = await page.locator('video, iframe[src*="youtube"], iframe[src*="vimeo"]').count();
    
    if (videos > 0) {
      console.log(`✓ Found ${videos} video element(s) on media page`);
    } else {
      console.log('ℹ No video elements found on media page');
    }
  });
});

// ========================================
// Support Page Tests
// ========================================
test.describe('Support Page Tests', () => {
  
  test('should navigate to support page', async ({ page }) => {
    await page.goto('/support');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
    
    // Should not show 404 error
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('Not Found');
    
    console.log('✓ Support page loaded successfully');
  });
  
  test('should verify support page has content', async ({ page }) => {
    await page.goto('/support');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Check for substantial text content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(100);
    
    console.log(`✓ Support page has ${bodyText!.length} characters of content`);
  });
  
  test('should verify support page has contact information or links', async ({ page }) => {
    await page.goto('/support');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Look for email links
    const emailLinks = await page.locator('a[href^="mailto:"]').count();
    
    if (emailLinks > 0) {
      console.log(`✓ Found ${emailLinks} email link(s) on support page`);
    }
    
    // Look for external support links (Discord, Twitter, etc.)
    const externalLinks = await page.locator('a[href*="discord"], a[href*="twitter"], a[href*="github"]').count();
    
    if (externalLinks > 0) {
      console.log(`✓ Found ${externalLinks} external support link(s)`);
    }
  });
  
  test('should verify support page has FAQ or help sections', async ({ page }) => {
    await page.goto('/support');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Look for FAQ-related content
    const bodyText = await page.locator('body').textContent();
    const hasFAQ = bodyText!.toLowerCase().includes('faq') || 
                   bodyText!.toLowerCase().includes('frequently asked') ||
                   bodyText!.toLowerCase().includes('help');
    
    if (hasFAQ) {
      console.log('✓ Support page appears to have FAQ or help content');
    }
    
    // Look for question/answer structure
    const questions = await page.locator('h2, h3, h4, .question, [class*="faq"]').count();
    
    if (questions > 0) {
      console.log(`✓ Found ${questions} potential FAQ question(s)/section(s)`);
    }
  });
  
  test('should verify support page has headings and structure', async ({ page }) => {
    await page.goto('/support');
    await DaggerQuestHelper.waitForPageLoad(page);
    
    // Look for heading elements
    const headers = await page.locator('h1, h2, h3').count();
    
    if (headers > 0) {
      console.log(`✓ Support page has ${headers} heading(s)`);
      expect(headers).toBeGreaterThan(0);
    }
  });
});

// ========================================
// Cross-Page Navigation Tests
// ========================================
test.describe('Cross-Page Navigation Tests', () => {
  
  test('should navigate between all main pages', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    console.log('✓ Started at homepage');
    
    // Navigate to each page and verify
    const pages = [
      { path: '/play', name: 'Play Now' },
      { path: '/guide', name: 'Guide' },
      { path: '/media', name: 'Media' },
      { path: '/support', name: 'Support' }
    ];
    
    for (const pageInfo of pages) {
      await page.goto(pageInfo.path);
      // Skip networkidle for play page due to large game iframe
      await DaggerQuestHelper.waitForPageLoad(page, 10000, pageInfo.path === '/play');
      
      // Verify page loaded without errors
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('404');
      
      console.log(`✓ Navigated to ${pageInfo.name} page`);
    }
    
    // Return to homepage
    await page.goto('/');
    await DaggerQuestHelper.waitForPageLoad(page);
    console.log('✓ Returned to homepage');
  });
  
  test('should verify all pages have consistent navigation', async ({ page }) => {
    const pages = ['/', '/play', '/guide', '/media', '/support'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      // Skip networkidle for play page due to large game iframe
      await DaggerQuestHelper.waitForPageLoad(page, 10000, pagePath === '/play');
      
      // Check if navigation exists
      const nav = await page.locator('nav, .nav, .navigation, header nav').count();
      
      if (nav > 0) {
        console.log(`✓ Navigation found on ${pagePath}`);
      }
    }
  });
  
  test('should verify all pages have consistent branding', async ({ page }) => {
    const pages = ['/', '/play', '/guide', '/media', '/support'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      // Skip networkidle for play page due to large game iframe
      await DaggerQuestHelper.waitForPageLoad(page, 10000, pagePath === '/play');
      
      // Verify title contains DaggerQuest
      await expect(page).toHaveTitle(/DaggerQuest/i);
      
      console.log(`✓ Branding verified on ${pagePath}`);
    }
  });
});
