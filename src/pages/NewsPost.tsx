import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { marked } from 'marked'
import SEO from '../components/SEO'

interface FrontmatterData {
  [key: string]: string;
}

interface NewsData {
  title: string;
  body: string;
  description: string;
  pageTitle: string;
  version?: string;
}

// Disabled posts that show "Coming Soon" instead of "Not Found"
const DISABLED_POSTS: string[] = []

// Simple frontmatter parser for browser use
function parseFrontmatter(content: string): { data: FrontmatterData; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)
  
  if (!match) {
    return { data: {}, content }
  }
  
  const [, frontmatterText, markdownContent] = match
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
  
  return { data, content: markdownContent ?? content }
}

function NewsPost() {
  const { slug } = useParams<{ slug: string }>()
  const [newsData, setNewsData] = useState<NewsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadNewsContent = async () => {
      try {
        
        // Try to load Markdown file using dynamic import (bundled with app)
        let content: string
        let isMarkdown = true
        
        try {
          const markdownModule = await import(`../assets/news/${slug}.md?raw`)
          content = markdownModule.default as string
        } catch {
          // Fallback to HTML file fetch if markdown import fails
          try {
            const response = await fetch(`/news/${slug}.html`)
            if (!response.ok) {
              throw new Error(`News post not found: ${slug}`)
            }
            content = await response.text()
            isMarkdown = false
          } catch {
            throw new Error(`News post not found: ${slug}`)
          }
        }
        
        if (isMarkdown) {
          // Parse Markdown with frontmatter
          const { data: frontmatter, content: markdownContent } = parseFrontmatter(content)
          
          // Auto-generate fields for patch notes and auto-append suffix to titles
          const isPatchNotes = frontmatter.type === 'patch-notes'
          const baseTitle = isPatchNotes && frontmatter.version 
            ? `${frontmatter.version} Patch Notes`
            : frontmatter.title
          const autoTitle = baseTitle && !baseTitle.includes(' | DaggerQuest | Browser ARPG')
            ? `${baseTitle} | DaggerQuest | Browser ARPG`
            : baseTitle
          
          // Auto-generate header for patch notes and news posts
          let processedContent = markdownContent
          if (isPatchNotes && frontmatter.version) {
            // Remove existing H1 header if it exists
            processedContent = markdownContent.replace(/^#\s+[^\n]+\n\n?/m, '')
            // Add auto-generated header
            processedContent = `# ${frontmatter.version} patch notes\n\n${processedContent}`
          } else if (frontmatter.type === 'news' && frontmatter.title) {
            // For news posts, remove existing H1 header and use frontmatter title
            processedContent = markdownContent.replace(/^#\s+[^\n]+\n\n?/m, '')
            // Add auto-generated header from frontmatter title
            processedContent = `# ${frontmatter.title}\n\n${processedContent}`
          }
          
          // Convert Markdown to HTML
          const htmlContent = marked(processedContent) as string
          
          setNewsData({
            title: frontmatter.version ? `${frontmatter.version} patch notes` : (autoTitle || `News: ${slug}`),
            body: htmlContent,
            description: frontmatter.description || `Read the latest DaggerQuest news post: ${slug}`,
            pageTitle: autoTitle || `News: ${slug} | DaggerQuest | Browser ARPG`,
            version: frontmatter.version
          })
        } else {
          // Legacy HTML parsing (keep existing logic for backward compatibility)
          const parser = new DOMParser()
          const doc = parser.parseFromString(content, 'text/html')
          
          const titleElement = doc.querySelector('.news-title')
          const bodyElement = doc.querySelector('.news-body')
          
          const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content')
          const pageTitle = doc.querySelector('title')?.textContent

          setNewsData({
            title: titleElement?.textContent || slug || '',
            body: bodyElement?.innerHTML || '',
            description: metaDescription || `Read the latest DaggerQuest news post: ${slug}`,
            pageTitle: pageTitle || `News: ${slug} | DaggerQuest | Browser ARPG`
          })
        }
      } catch (err) {
        console.error('Error loading news content:', err)
        setError((err as Error).message)
      }
    }

    if (slug) {
      loadNewsContent()
    }
  }, [slug])

  if (error) {
    const isDisabled = DISABLED_POSTS.includes(slug || '')
    const title = isDisabled ? `Coming Soon | DaggerQuest | Browser ARPG` : `News Post Not Found | DaggerQuest | Browser ARPG`
    const heading = isDisabled ? 'Coming Soon' : 'News Post Not Found'
    
    return (
      <>
        <SEO 
          title={title}
          description={isDisabled ? 'This news post is not available yet. Please check back later!' : 'The requested news post could not be found'}
          url={`https://DaggerQuest.com/news/${slug}`}
        />
        <main className="container news-container">
          <article className="news-post-detail">
            <h1 className="news-title">{heading}</h1>
            <section className="news-body">
              {isDisabled ? (
                <>
                  <p>This news post is not available yet. Please check back later!</p>
                  <p><a href="/news">← Back to News</a></p>
                </>
              ) : (
                <>
                  <p>Sorry, we couldn't find the news post you're looking for.</p>
                  <p>Error: {error}</p>
                  <p><a href="/news">← Back to News</a></p>
                </>
              )}
            </section>
          </article>
        </main>
      </>
    )
  }

  // Don't render anything until newsData is loaded
  if (!newsData) {
    return (
      <>
        <SEO 
          title={`News: ${slug} | DaggerQuest | Browser ARPG`}
          description={`Read the latest DaggerQuest news post: ${slug}`}
          url={`https://DaggerQuest.com/news/${slug}`}
        />
        <main className="container news-container">
          <article className="news-post-detail">
            {/* Content will appear once loaded */}
          </article>
        </main>
      </>
    )
  }

  return (
    <>
      <SEO 
        title={newsData.pageTitle}
        description={newsData.description}
        url={`https://DaggerQuest.com/news/${slug}`}
      />
      <main className="container news-container">
        <article className="news-post-detail">
          <div 
            className="news-body markdown-content"
            style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}
            dangerouslySetInnerHTML={{ __html: newsData.body }}
          />
        </article>
      </main>
    </>
  )
}

export default NewsPost
