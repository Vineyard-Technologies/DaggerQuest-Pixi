import React from 'react'
import { useForm, ValidationError } from '@formspree/react'
import SEO from '../components/SEO'
import { useScrollAnimation } from '../hooks/useScrollAnimation'

function ContactForm() {
  const [state, handleSubmit] = useForm("xpwydban")
  
  if (state.succeeded) {
    return (
      <div style={{textAlign: 'center', color: 'white'}}>
        <h2>thank you for contacting us!</h2>
        <p>We've received your message and will get back to you soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="support-form">
      <div className="form-group">
        <label htmlFor="email" className="form-label" style={{color: 'white'}}>email address</label>
        <input
          id="email"
          type="email" 
          name="email"
          required
          style={{border: 'none', outline: 'none'}}
        />
        <ValidationError 
          prefix="Email" 
          field="email"
          errors={state.errors}
        />
      </div>

      <div className="form-group">
        <label htmlFor="message" className="form-label" style={{color: 'white'}}>message</label>
        <textarea
          id="message"
          name="message"
          rows={6}
          placeholder="Please describe your issue or question in detail..."
          required
          style={{border: 'none', outline: 'none'}}
        />
        <ValidationError 
          prefix="Message" 
          field="message"
          errors={state.errors}
        />
      </div>

      <button type="submit" disabled={state.submitting} className="show-more-btn">
        {state.submitting ? 'sending...' : 'send message'}
      </button>
    </form>
  )
}

function Support() {
  const contentRef = useScrollAnimation()

  return (
    <>
      <SEO 
        title="Support | DaggerQuest | Browser ARPG"
        description="DaggerQuest Support: Get help, report bugs, and find answers to common questions about the browser ARPG."
        url="https://DaggerQuest.com/support"
      />
      <main className="container">
        <div ref={contentRef} className="support-content fade-in-element">
          <h1>contact support</h1>
          <p>Having trouble with DaggerQuest? Need help or want to report a bug? Send us a message and we'll get back to you as soon as possible.</p>
          <ContactForm />
        </div>
      </main>
    </>
  )
}

export default Support
