import React, { useState, useEffect } from 'react'
import './App.css'
import { useAuth } from './contexts/AuthContext'
import { AuthModal } from './components/AuthModal'
import { AccountManagement } from './components/AccountManagement'

interface SearchResult {
  url: string
  facets: string
  dsl?: string
  warnings?: string[]
}

interface SampleQuery {
  text: string
  icon: string
  description: string
  category: string
}

const sampleQueries = [
  { 
    text: "CFOs at fintech startups in Boston", 
    icon: "🎯",
    description: "Find financial decision makers in the fintech space and banking sector.",
    category: "Executive Search"
  },
  { 
    text: "Healthcare founders in San Francisco", 
    icon: "🏥",
    description: "Connect with startup founders and healthcare executives in the Bay Area.",
    category: "Founder Outreach"
  },
  { 
    text: "Marketing directors at SaaS companies", 
    icon: "📊",
    description: "Discover marketing leaders at software companies for partnership opportunities.",
    category: "B2B Marketing"
  },
  {
    text: "VPs of Sales in enterprise tech firms",
    icon: "💼",
    description: "Target senior sales leadership at established technology companies.",
    category: "Sales Leaders"
  },
  {
    text: "CTOs at AI and machine learning startups",
    icon: "🤖",
    description: "Find technical executives building AI-powered products and platforms.",
    category: "Technical Leaders"
  },
  {
    text: "Product managers in fintech with MBA",
    icon: "💡",
    description: "Locate product professionals with business education in financial technology.",
    category: "Product & Strategy"
  }
]

function App() {
  const { user, loading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)

  const placeholderExamples = [
    "CFOs at fintech startups in Boston",
    "Healthcare founders in San Francisco",
    "Marketing directors at SaaS companies",
    "VPs of Sales in enterprise tech firms",
    "CTOs at AI startups",
    "Product managers in fintech with MBA"
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderExamples.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e?: React.FormEvent, searchQuery?: string) => {
    if (e) e.preventDefault()
    
    // Check if user is logged in
    if (!user) {
      setShowAuthModal(true)
      return
    }

    const queryToSubmit = searchQuery || query
    if (!queryToSubmit.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: queryToSubmit.trim() }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      
      // Auto-open the URL in a new tab
      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSampleClick = (sampleText: string) => {
    setQuery(sampleText)
    handleSubmit(undefined, sampleText)
  }

  const handleAuthButtonClick = () => {
    if (user) {
      setShowAccountModal(true)
    } else {
      setShowAuthModal(true)
    }
  }

  if (authLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <AccountManagement isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
      
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-text">SalesNav AI</span>
          </div>
          <button className="auth-button" onClick={handleAuthButtonClick}>
            {user ? (
              <>
                <span className="user-avatar">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Profile" />
                  ) : (
                    user.email?.[0].toUpperCase()
                  )}
                </span>
                <span className="button-text">Account</span>
              </>
            ) : (
              <>
                <span className="login-icon">👤</span>
                <span className="button-text">Sign In</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="chat-container">
          <div className="greeting">Hello. How can we help you today?</div>
          <h1 className="title">What would you like to find?</h1>
          
          <form onSubmit={handleSubmit} className="search-form">
            <div className="search-input-container">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholderExamples[placeholderIndex]}
                className="search-input"
                disabled={loading}
              />
              <button 
                type="submit" 
                className="submit-button"
                disabled={loading || !query.trim()}
              >
                ↑
              </button>
            </div>
          </form>

          <div className="sample-cards">
            {sampleQueries.map((sample, index) => (
              <button
                key={index}
                onClick={() => handleSampleClick(sample.text)}
                className="sample-card"
              >
                <div className="card-icon">{sample.icon}</div>
                <div className="card-content">
                  <div className="card-title">{sample.text}</div>
                  <div className="card-description">{sample.description}</div>
                </div>
                <div className="card-metadata">
                  <div className="card-avatars">
                    <div className="card-avatar"></div>
                    <div className="card-avatar"></div>
                  </div>
                  <span>Quick search • {sample.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
