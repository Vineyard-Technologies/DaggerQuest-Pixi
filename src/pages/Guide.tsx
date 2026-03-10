import React, { useState } from 'react'
import SEO from '../components/SEO'
import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { getPageSEO } from '../config/pageMetadata'

function Guide() {
  const guideMeta = getPageSEO('guide')
  const [searchTerm, setSearchTerm] = useState('')
  const titleRef = useScrollAnimation()
  const columnsRef = useScrollAnimation()
  const introBoxRef = useScrollAnimation()
  const featuredBoxRef = useScrollAnimation()

  return (
    <>
      <SEO 
        title={guideMeta.title}
        description={guideMeta.description}
        url={guideMeta.url}
      />
      <main className="container guide-container">
        <h1 ref={titleRef} className="title fade-in-element">guide</h1>
        <div ref={columnsRef} className="guide-columns fade-in-element">
          <aside className="guide-col guide-col-left">
            <label htmlFor="guide-search" className="sr-only">Search the guide</label>
            <input 
              id="guide-search" 
              className="guide-search-box" 
              type="search" 
              placeholder="Search the guide..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </aside>
          <section className="guide-col">
            <article ref={introBoxRef} className="guide-box fade-in-element">
              <div className="guide-box-content">
                This guide will help you get started and master the world of <span className="name">DaggerQuest</span>. Use the search box to quickly find topics, or start with our Beginner's Guide.
              </div>
            </article>
            <article ref={featuredBoxRef} className="guide-box fade-in-element">
              <h2 className="guide-box-title">featured article</h2>
              <div className="guide-box-content">
                Coming soon!
              </div>
            </article>
          </section>
        </div>
      </main>
    </>
  )
}

export default Guide
