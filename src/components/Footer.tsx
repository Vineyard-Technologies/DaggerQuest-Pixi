import React from 'react'
import { Link } from 'react-router-dom'

function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer 
      className="footer-container"
      style={{
        background: '#181818ee',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.4)',
        width: '100%',
        padding: '24px',
        color: 'white',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}
      role="contentinfo"
    >
      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="footer-content" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '100%',
          gap: '24px'
        }}>
          {/* DaggerQuest Logo - Top on mobile, left on desktop */}
          <div className="footer-logo" style={{ display: 'flex', alignItems: 'center' }}>
            <Link to="/" aria-label="DaggerQuest Home">
              <img 
                src="/images/logo.webp" 
                alt="DaggerQuest Logo" 
                style={{ height: '96px', width: 'auto' }}
              />
            </Link>
          </div>
          
          {/* All content - Below logo on mobile, right on desktop */}
          <div className="footer-info" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '12px',
            textAlign: 'center'
          }}>
            {/* Vineyard Technologies logo and copyright */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: '16px' 
            }}>
              <div style={{ fontSize: '1.1em', color: '#a29273' }}>
                &copy; {currentYear} <a 
                  href="https://VineyardTechnologies.org" 
                  style={{ color: 'white', textDecoration: 'underline' }}
                >Vineyard Technologies</a>
              </div>
              <a href="https://VineyardTechnologies.org" aria-label="Vineyard Technologies Website">
                <img 
                  src="/images/VineyardTechnologiesLogo.webp" 
                  alt="Vineyard Technologies Logo" 
                  style={{ height: '32px', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => (e.target as HTMLImageElement).style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => (e.target as HTMLImageElement).style.transform = 'scale(1)'}
                />
              </a>
            </div>
            
            {/* License */}
            <div style={{ fontSize: '1.1em', color: '#a29273' }}>
              Licensed and distributed under <a 
                href="https://www.gnu.org/licenses/agpl-3.0.html.en" 
                rel="license" 
                style={{ color: 'white', textDecoration: 'underline' }}
              >AGPL-3.0</a>
            </div>
            
            {/* Legal Links */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '16px', 
              fontSize: '1.1em' 
            }}>
              <Link 
                to="/privacy-policy" 
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms-of-use" 
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                Terms of Service
              </Link>
              <Link 
                to="/sitemap" 
                style={{ color: 'white', textDecoration: 'underline' }}
              >
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
