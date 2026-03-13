// Centralized page metadata configuration
// This file serves as the single source of truth for page titles, descriptions, and URLs

const SITE_SUFFIX = " | DaggerQuest | Browser ARPG"

export interface PageMetadata {
  title: string;
  description: string;
  url: string;
  path: string;
}

interface GetPageMetadataOptions {
  fullTitle?: boolean;
}

export const pageMetadata: Record<string, PageMetadata> = {
  home: {
    title: "DaggerQuest",
    description: "DaggerQuest is a free browser-based action RPG. Battle monsters, explore dungeons, collect legendary loot, and level up your character in this immersive fantasy adventure.",
    url: "https://DaggerQuest.com",
    path: "/"
  },
  play: {
    title: "Play Now!",
    description: "Play DaggerQuest, a browser-based action RPG adventure. Dive into epic quests, battle monsters, and collect powerful loot in this free game.",
    url: "https://DaggerQuest.com/play",
    path: "/play"
  },
  news: {
    title: "News",
    description: "Stay updated with the latest DaggerQuest announcements, patch notes, and community events. Never miss important game updates and features.",
    url: "https://DaggerQuest.com/news",
    path: "/news"
  },
  guide: {
    title: "Guide",
    description: "Master DaggerQuest with comprehensive gameplay guides, strategic tips, and mechanics tutorials. Learn everything you need for success.",
    url: "https://DaggerQuest.com/guide",
    path: "/guide"
  },
  media: {
    title: "Media",
    description: "Explore DaggerQuest through stunning screenshots, gameplay videos, and official artwork. See the game's world and characters in action.",
    url: "https://DaggerQuest.com/media",
    path: "/media"
  },
  support: {
    title: "Support",
    description: "Get expert help with DaggerQuest issues, report bugs, and find answers to frequently asked questions from our support team.",
    url: "https://DaggerQuest.com/support",
    path: "/support"
  },
  privacyPolicy: {
    title: "Privacy Policy",
    description: "Learn how DaggerQuest collects, uses, and protects your personal data. Understand our commitment to player privacy and security.",
    url: "https://DaggerQuest.com/privacy-policy",
    path: "/privacy-policy"
  },
  termsOfUse: {
    title: "Terms of Use",
    description: "Read the official DaggerQuest terms and conditions for playing our game. Understand your rights and responsibilities as a player.",
    url: "https://DaggerQuest.com/terms-of-use",
    path: "/terms-of-use"
  },
  sitemap: {
    title: "Sitemap",
    description: "Navigate the complete DaggerQuest website structure. Find all pages, sections, and resources for easy access to game information.",
    url: "https://DaggerQuest.com/sitemap",
    path: "/sitemap"
  }
}

// Helper function to get page metadata by key
export const getPageMetadata = (pageKey: string, options: GetPageMetadataOptions = {}): PageMetadata => {
  const metadata = pageMetadata[pageKey] || {} as PageMetadata
  
  // If we need the full title for <title> tags, append the suffix
  if (options.fullTitle && metadata.title) {
    return {
      ...metadata,
      title: metadata.title + SITE_SUFFIX
    }
  }
  
  return metadata
}

// Get page metadata with full title (for SEO components)
export const getPageSEO = (pageKey: string): PageMetadata => {
  return getPageMetadata(pageKey, { fullTitle: true })
}

// Get all pages for sitemap generation (uses clean titles)
export const getAllPages = (): (PageMetadata & { key: string })[] => {
  return Object.entries(pageMetadata).map(([key, data]) => ({
    key,
    ...data
  }))
}
