import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const GA_MEASUREMENT_ID = 'G-C5SY437DMY'
const IS_PRODUCTION = typeof window !== 'undefined' && window.location.hostname === 'daggerquest.com'

function Analytics() {
  const location = useLocation()

  useEffect(() => {
    if (!IS_PRODUCTION) return

    // Load Google Analytics if not already loaded
    if (!document.getElementById('google-gtag')) {
      const gaScript = document.createElement('script')
      gaScript.async = true
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
      gaScript.id = 'google-gtag'

      gaScript.onload = () => {
        // Add the inline config script only after the library has loaded
        const inlineScript = document.createElement('script')
        inlineScript.innerHTML = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`
        document.head.appendChild(inlineScript)
      }

      document.head.appendChild(gaScript)
    }
  }, [])

  // Track page views
  useEffect(() => {
    if (!IS_PRODUCTION || !window.gtag) return
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: location.pathname,
    })
  }, [location])

  return null
}

export default Analytics
