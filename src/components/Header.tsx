import React, { useState } from 'react'
import { Link } from 'react-router-dom'

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <header id="header">
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-top-bar">
          {/* Logo on the left */}
          <Link to="/" className="navbar-logo-link" aria-label="DaggerQuest Home">
            <img id="header-logo" src="/images/logo.webp" alt="DaggerQuest Logo" />
          </Link>
          
          {/* Navigation on the right */}
          <div className="navbar-content">
            <ul className="navbar-links desktop-only" role="list">
              <li><Link to="/">home</Link></li>
              <li><Link to="/play">play now</Link></li>
              <li><Link to="/news">news</Link></li>
              <li><Link to="/guide">guide</Link></li>
              <li><Link to="/support">support</Link></li>
            </ul>
            <button 
              className="navbar-hamburger mobile-only" 
              aria-label="Open menu" 
              aria-expanded={mobileMenuOpen}
              onClick={toggleMobileMenu}
            >
              <span className="navbar-hamburger-bar"></span>
              <span className="navbar-hamburger-bar"></span>
              <span className="navbar-hamburger-bar"></span>
            </button>
          </div>
        </div>
        <ul className={`navbar-menu mobile-only ${mobileMenuOpen ? 'open' : ''}`} role="list">
          <li><Link to="/" onClick={() => setMobileMenuOpen(false)}>home</Link></li>
          <li><Link to="/play" onClick={() => setMobileMenuOpen(false)}>play now</Link></li>
          <li><Link to="/news" onClick={() => setMobileMenuOpen(false)}>news</Link></li>
          <li><Link to="/guide" onClick={() => setMobileMenuOpen(false)}>guide</Link></li>
          <li><Link to="/support" onClick={() => setMobileMenuOpen(false)}>support</Link></li>
        </ul>
      </nav>
    </header>
  )
}

export default Header
