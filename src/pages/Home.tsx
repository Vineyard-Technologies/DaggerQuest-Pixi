import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useScrollAnimation } from '../hooks/useScrollAnimation'

function Home() {
  const heroRef = useScrollAnimation()
  const featuresRef = useScrollAnimation()
  const ctaRef = useScrollAnimation()

  return (
    <>
      <SEO 
        title="DaggerQuest | Browser ARPG"
        description="DaggerQuest is a free browser-based action RPG. Battle monsters, explore dungeons, collect legendary loot, and level up your character in this immersive fantasy adventure."
        image="https://DaggerQuest.com/images/logo.webp"
        url="https://DaggerQuest.com/"
        schemaType="VideoGame"
        schemaData={{
          name: "DaggerQuest",
          url: "https://DaggerQuest.com/",
          image: "https://DaggerQuest.com/images/logo.webp",
          description: "DaggerQuest is a free browser-based action RPG. Battle monsters, explore dungeons, collect legendary loot, and level up your character in this immersive fantasy adventure.",
          author: {
            "@type": "Organization",
            name: "Vineyard Technologies"
          },
          applicationCategory: "Game",
          operatingSystem: "All",
          genre: ["Action", "RPG", "Browser Game"],
          inLanguage: "en",
          offers: {
            "@type": "Offer",
            price: "0.00",
            priceCurrency: "USD"
          }
        }}
      />
      
      <main className="homepage">
        {/* Hero Section */}
        <section ref={heroRef} className="hero-section fade-in-element">
          <div className="hero-container">
            <div className="hero-content">
              <img src="/images/heroSectionLogo.webp" alt="DaggerQuest" className="hero-logo" />
              <p className="hero-subtitle">A Browser-Based Action RPG Adventure</p>
              <p className="hero-description">
                Embark on an epic journey through dangerous dungeons, battle fearsome monsters, 
                and collect legendary loot. Play for free directly in your browser!
              </p>
              <div className="hero-buttons">
                <Link to="/play" className="btn btn-primary">Play Now!</Link>
                <Link to="/news" className="btn btn-secondary">Latest News</Link>
              </div>
            </div>
            <div className="hero-image-container">
              <img src="/images/daggerquestHeroImage.webp" alt="DaggerQuest Gameplay" className="hero-image" />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section ref={featuresRef} className="features-section fade-in-element">
          <h2 className="section-title">Game Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <img src="/images/richRPGExperience.webp" alt="Rich RPG Experience" className="feature-image" />
              <h3 className="feature-title">Rich RPG Experience</h3>
              <p className="feature-description">
                Deep character customization, immersive gameplay, and engaging storylines.
              </p>
            </div>
            
            <div className="feature-card">
              <img src="/images/browserBased.webp" alt="Browser-Based" className="feature-image" />
              <h3 className="feature-title">Browser-Based</h3>
              <p className="feature-description">
                Play directly from any modern web browser without downloads or installations.
              </p>
            </div>
            
            <div className="feature-card">
              <img src="/images/3dpassive.webp" alt="3D Passive Skill Cube" className="feature-image" />
              <h3 className="feature-title">3D Passive Skill Cube</h3>
              <p className="feature-description">
                Experience character development through a unique 3D skill cube system.
              </p>
            </div>
            
            <div className="feature-card">
              <img src="/images/specializedLoot.webp" alt="Specialized Loot" className="feature-image" />
              <h3 className="feature-title">Specialized Loot</h3>
              <p className="feature-description">
                Customize item drops with the <strong>Pillar of Fate</strong> - shape your adventure experience.
              </p>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section ref={ctaRef} className="cta-section fade-in-element">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Start Your Adventure?</h2>
            <p className="cta-description">
              The world of <strong>DaggerQuest</strong> awaits. Begin your epic journey today!
            </p>
            <div className="cta-buttons">
              <Link to="/play" className="btn btn-primary btn-large">play now!</Link>
              <Link to="/news" className="btn btn-secondary btn-large">latest news</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

export default Home
