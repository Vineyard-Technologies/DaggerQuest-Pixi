import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const GA_MEASUREMENT_ID_PRODUCTION = 'G-C5SY437DMY'
const GA_MEASUREMENT_ID_TEST = 'G-LLCCVZ47Z3'

function Analytics() {
  const location = useLocation()

  // Determine which GA measurement ID to use based on hostname
  const getMeasurementId = (): string => {
    if (window.location.hostname === "test.daggerquest.com") {
      return GA_MEASUREMENT_ID_TEST
    }
    return GA_MEASUREMENT_ID_PRODUCTION
  }

  useEffect(() => {
    // Only load analytics on approved domains
    if (window.location.hostname === "daggerquest.com" || window.location.hostname === "test.daggerquest.com") {
      const measurementId = getMeasurementId()
      
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
      console.warn('Not running on approved domain (daggerquest.com or test.daggerquest.com), skipping analytics')
    }
  }, [])

  // Track page views
  useEffect(() => {
    if (window.gtag && (window.location.hostname === "daggerquest.com" || window.location.hostname === "test.daggerquest.com")) {
      const measurementId = getMeasurementId()
      window.gtag('config', measurementId, {
        page_path: location.pathname,
      })
    }
  }, [location])

  return null // This component doesn't render anything
}

export default Analytics
