import React from 'react'
import { Helmet } from '@dr.pogodin/react-helmet'

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  schemaType?: string;
  schemaData?: Record<string, unknown>;
  canonical?: string;
}

function SEO({ 
  title, 
  description, 
  image, 
  url, 
  schemaType = 'WebPage', 
  schemaData = {},
  canonical 
}: SEOProps) {
  const defaultImage = 'https://DaggerQuest.com/images/logo.webp'
  const defaultUrl = 'https://DaggerQuest.com/'
  
  const finalImage = image || defaultImage
  const finalUrl = url || defaultUrl
  const finalCanonical = canonical || finalUrl

  const defaultSchemaData = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
    url: finalUrl,
    description: description,
    inLanguage: 'en',
    publisher: {
      '@type': 'Organization',
      name: 'Vineyard Technologies'
    }
  }

  const finalSchemaData = { ...defaultSchemaData, ...schemaData }

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={finalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={finalImage} />
      <meta property="og:image:alt" content="DaggerQuest Logo" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={finalUrl} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={finalImage} />
      
      {/* Favicon */}
      <link rel="icon" type="image/webp" href="/images/favicon.webp" />
      <link rel="shortcut icon" type="image/webp" href="/images/favicon.webp" />
      <link rel="apple-touch-icon" href="/images/favicon.webp" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={finalCanonical} />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(finalSchemaData)}
      </script>
    </Helmet>
  )
}

export default SEO
