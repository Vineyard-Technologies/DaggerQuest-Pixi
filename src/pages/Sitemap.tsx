import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { getAllPages, getPageSEO } from '../config/pageMetadata'

function Sitemap() {
  const titleRef = useScrollAnimation()
  const gridRef = useScrollAnimation()
  const sitemapMeta = getPageSEO('sitemap')
  const pages = getAllPages()

  return (
    <>
      <SEO 
        title={sitemapMeta.title}
        description={sitemapMeta.description}
        url={sitemapMeta.url}
      />
      <main className="container sitemap-container">
        <h1 ref={titleRef} className="title fade-in-element">sitemap</h1>
        <div ref={gridRef} className="sitemap-grid fade-in-element">
          {pages.map((page, index) => (
            <div key={index} className="sitemap-card">
              <h2 className="sitemap-card-title">{page.title}</h2>
              <p className="sitemap-card-description">{page.description}</p>
              <Link to={page.path} className="sitemap-card-button">
                Go to page
              </Link>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}

export default Sitemap
