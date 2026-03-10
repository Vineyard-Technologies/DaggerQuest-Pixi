import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const GA_MEASUREMENT_ID = 'G-C5SY437DMY'

function Analytics() {
  const location = useLocation()

  useEffect(() => {
    // Only load analytics on the production domain
    if (window.location.hostname === "daggerquest.com") {
      const measurementId = GA_MEASUREMENT_ID
      
      // Load Google Analytics if not already loaded
      if (!document.getElementById('google-gtag')) {
        // Add the gtag.js script
        const gaScript = document.createElement('script')
        gaScript.async = true
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
        gaScript.id = 'google-gtag'
        document.head.appendChild(gaScript)

        // Add the inline config script
        const inlineScript = document.createElement('script')
        inlineScript.innerHTML = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`
        document.head.appendChild(inlineScript)
      }
    } else {
      console.warn('Not running on daggerquest.com, skipping analytics')
    }
  }, [])

  // Track page views
  useEffect(() => {
    if (window.gtag && window.location.hostname === "daggerquest.com") {
      const measurementId = GA_MEASUREMENT_ID
      window.gtag('config', measurementId, {
        page_path: location.pathname,
      })
    }
  }, [location])

  return null // This component doesn't render anything
}

export default Analytics
