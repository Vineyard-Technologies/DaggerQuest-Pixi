// Shared news posts data
// This file serves as the single source of truth for news post ordering
// All other data (title, description, etc.) is loaded from markdown frontmatter

export interface NewsPost {
  href: string;
  headline: string;
  description?: string;
}

interface FrontmatterData {
  [key: string]: string;
}

// Ordered list of news post slugs (determines display order on /news page)
const newsPostSlugs: string[] = [
  "project-updates",
  "patch-notes-046",
  "patch-notes-045",
  "patch-notes-044",
  "patch-notes-043",
  "patch-notes-042",
  "patch-notes-041",
  "patch-notes-040",
  "patch-notes-039",
  "patch-notes-038",
  "patch-notes-037",
  "patch-notes-036",
  "patch-notes-035",
  "patch-notes-034"
];

// Build basic news posts array (sync - for News listing page)
export const newsPosts: NewsPost[] = newsPostSlugs.map(slug => ({
  href: `/news/${slug}`,
  headline: '' // Will be populated by async load
}));

// Simple frontmatter parser for browser use
function parseFrontmatter(content: string): { data: FrontmatterData; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)
  
  if (!match) {
    return { data: {}, content }
  }
  
  const [, frontmatterText] = match
  if (!frontmatterText) return { data: {}, content }
  const data: FrontmatterData = {}
  
  // Parse YAML-like frontmatter
  const lines = frontmatterText.split('\n')
  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      let value = line.slice(colonIndex + 1).trim()
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      data[key] = value
    }
  }
  
  return { data, content: match[2] ?? content }
}

// Cache for loaded descriptions
let cachedPostsWithMetadata: NewsPost[] | null = null
let metadataCacheTime: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Load complete metadata from markdown frontmatter
async function loadPostMetadata(): Promise<NewsPost[]> {
  const postsWithMetadata = await Promise.all(
    newsPostSlugs.map(async (slug) => {
      try {
        // Try to load the markdown file
        const markdownModule = await import(`../assets/news/${slug}.md?raw`)
        const content = markdownModule.default as string
        const { data: frontmatter } = parseFrontmatter(content)
        
        // Derive title: for patch notes use version, otherwise use title field
        const title = frontmatter.type === 'patch-notes' && frontmatter.version
          ? `Patch Notes ${frontmatter.version}`
          : frontmatter.title || slug
        
        return {
          href: `/news/${slug}`,
          headline: title,
          description: frontmatter.description || `Read the latest DaggerQuest news: ${title}`
        }
      } catch (error) {
        // If markdown doesn't exist, use fallbacks
        console.warn(`Failed to load news post: ${slug}`, error)
        return {
          href: `/news/${slug}`,
          headline: slug,
          description: `Read the latest DaggerQuest news`
        }
      }
    })
  )
  
  return postsWithMetadata
}

export const getNewsPosts = async (): Promise<NewsPost[]> => {
  // Return posts with full metadata loaded from markdown
  return await getNewsPostsWithDescriptions()
}

// Get posts with descriptions loaded from markdown frontmatter (async)
export const getNewsPostsWithDescriptions = async (): Promise<NewsPost[]> => {
  const now = Date.now()
  if (cachedPostsWithMetadata && (now - metadataCacheTime) < CACHE_DURATION) {
    return cachedPostsWithMetadata
  }
  
  cachedPostsWithMetadata = await loadPostMetadata()
  metadataCacheTime = now
  return cachedPostsWithMetadata
}
