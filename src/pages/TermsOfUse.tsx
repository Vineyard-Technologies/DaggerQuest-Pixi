import React from 'react'
import SEO from '../components/SEO'
import { useScrollAnimation } from '../hooks/useScrollAnimation'

function TermsOfUse() {
  const contentRef = useScrollAnimation()

  return (
    <>
      <SEO 
        title="Terms of Use | DaggerQuest | Browser ARPG"
        description="DaggerQuest Terms of Use: Read the terms and conditions for playing and using our browser ARPG service."
        url="https://DaggerQuest.com/terms-of-use"
      />
      <main ref={contentRef} className="container legal-page fade-in-element">
        <h1>terms of use</h1>
        <h2>Acceptance of Terms</h2>
        <p>By accessing or using the <a href="https://DaggerQuest.com/" className="legal-link">DaggerQuest</a> website and services, you agree to be bound by these Terms of Use. If you disagree with any part of these terms, please do not access the website or use the services.</p>
        
        <h2>User Account</h2>
        <p>You may be required to create a user account to access certain features of the game. You are responsible for maintaining the confidentiality of your account information. You agree not to share your account information with others.</p>
        
        <h2>Game Play</h2>
        <p>You agree to play the game fairly and ethically. You agree not to use any cheats, hacks, bots, or other unauthorized software or methods to gain an unfair advantage. You agree not to engage in any disruptive or abusive behavior towards other players.</p>
        
        <h2>Intellectual Property</h2>
        <p>All game content, including but not limited to characters, items, storylines, and code, is the intellectual property of <a href="https://VineyardTechnologies.org/" className="legal-link">Vineyard Technologies</a> or its licensors. You may not use, copy, modify, or distribute any game content without our prior written consent.</p>
        
        <h2>Limitation of Liability</h2>
        <p>We are not liable for any damages or losses arising from the use or inability to use the game. We are not responsible for any third-party content or services accessed through the game.</p>
        
        <h2>Termination</h2>
        <p>We may terminate your account or access to the game at any time, with or without notice, for any reason.</p>
      </main>
    </>
  )
}

export default TermsOfUse
