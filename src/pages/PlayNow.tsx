import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { useScrollAnimation } from '../hooks/useScrollAnimation'

function PlayNow() {
  const centerContentRef = useScrollAnimation()
  const leftAdRef = useScrollAnimation()
  const rightAdRef = useScrollAnimation()

  useEffect(() => {
    // Scroll iframe into view on page load
    const iframe = document.querySelector('.game-frame')
    if (iframe) {
      setTimeout(() => {
        iframe.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [])

  useEffect(() => {
    // Load AdSense script only on approved domains
    if (window.location.hostname === "daggerquest.com") {
      const loadAdSenseScript = () => {
        // Check if script is already loaded
        if (document.getElementById('google-adsense-script')) {
          // If script exists, just initialize ads
          initializeAds()
          return
        }
        
        const script = document.createElement('script')
        script.id = 'google-adsense-script'
        script.async = true
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2087729758302145'
        script.crossOrigin = 'anonymous'
        document.head.appendChild(script)
        
        script.onload = () => {
          setTimeout(initializeAds, 100)
        }
        
        script.onerror = () => {
          console.warn('Failed to load AdSense script')
        }
      }
      
      const initializeAds = () => {
        try {
          // Initialize each ad individually
          const ads = document.querySelectorAll('.adsbygoogle')
          ads.forEach((ad, index) => {
            // Only initialize ads that haven't been initialized
            if (!ad.classList.contains('adsbygoogle-noablate')) {
              setTimeout(() => {
                try {
                  (window.adsbygoogle = window.adsbygoogle || []).push({})
                } catch (e) {
                  console.warn(`AdSense initialization error for ad ${index}:`, e)
                }
              }, index * 100) // Stagger initialization
            }
          })
        } catch (e) {
          console.warn('AdSense initialization error:', e)
        }
      }
      
      // Delay execution to ensure DOM is ready
      setTimeout(loadAdSenseScript, 500)
    }
  }, [])

  return (
    <>
      <SEO 
        title="Play Now! | DaggerQuest | Browser ARPG"
        description="Play DaggerQuest, a browser-based action RPG. Dive into adventure, battle monsters, and collect loot in this free online game."
        image="https://DaggerQuest.com/images/logo.webp"
        url="https://DaggerQuest.com/play"
        schemaType="VideoGame"
        schemaData={{
          name: "DaggerQuest",
          url: "https://DaggerQuest.com/",
          image: "https://DaggerQuest.com/images/logo.webp",
          description: "Play DaggerQuest, a browser-based action RPG. Dive into adventure, battle monsters, and collect loot in this free online game.",
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
      <main className="container flex-ads">
        <aside ref={leftAdRef} className="ad-slot left-ad desktop-only fade-in-element">
          {/* DaggerQuest Left Ad */}
          {window.location.hostname === "daggerquest.com" && (
            <ins
              className="adsbygoogle"
              style={{ display: 'inline-block', width: '160px', height: '600px' }}
              data-ad-client="ca-pub-2087729758302145"
              data-ad-slot="2524300910"
              key="left-ad"
            />
          )}
        </aside>
        <section ref={centerContentRef} className="center-content fade-in-element">
          <iframe 
            className="game-frame desktop-only" 
            src="/game/" 
            allowFullScreen 
            title="DaggerQuest Game"
          />
          <div id="mobile-message" className="mobile-only">
            <p><span className="name">DaggerQuest</span> is not yet available for mobile devices. Check back soon!</p>
            <Link to="/news" className="mobile-news-button">latest news</Link>
          </div>
        </section>
        <aside ref={rightAdRef} className="ad-slot right-ad desktop-only fade-in-element">
          {/* DaggerQuest Right Ad */}
          {window.location.hostname === "daggerquest.com" && (
            <>
              <ins
                className="adsbygoogle"
                style={{ display: 'inline-block', width: '160px', height: '600px' }}
                data-ad-client="ca-pub-2087729758302145"
                data-ad-slot="2524300910"
                key="right-ad-1"
              />
              <ins
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client="ca-pub-2087729758302145"
                data-ad-slot="2524300910"
                data-ad-format="auto"
                data-full-width-responsive="true"
                key="right-ad-2"
              />
            </>
          )}
        </aside>
      </main>
    </>
  )
}

export default PlayNow
