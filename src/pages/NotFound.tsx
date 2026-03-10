import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

function NotFound() {
  return (
    <>
      <SEO 
        title="Page Not Found | DaggerQuest"
        description="The page you're looking for doesn't exist."
        url="https://DaggerQuest.com/404"
      />
      <main className="container">
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <Link to="/">Go back to home</Link>
      </main>
    </>
  )
}

export default NotFound
