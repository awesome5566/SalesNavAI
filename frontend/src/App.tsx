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

interface FilterPill {
  id: string
  type: 'role' | 'seniority' | 'geo' | 'industry' | 'headcount' | 'include' | 'exclude' | 'other'
  label: string
  value: string
}

const featuredQueries = [
  {
    text: "VPs of Sales in Boston at 50-500 employee SaaS, exclude interns",
    description: "Senior sales leadership at established SaaS companies with specific headcount range."
  },
  {
    text: "Fintech CROs in NYC or SF, Series B-D",
    description: "Chief Revenue Officers in fintech companies at specific funding stages."
  },
  {
    text: "AI founders in London, headcount < 100, not consultants",
    description: "Startup founders building AI products with specific company size and type."
  }
]

function App() {
  const { user, session, loading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [filterPills, setFilterPills] = useState<FilterPill[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [showExamples, setShowExamples] = useState(true)

  // Debounced parsing as user types
  useEffect(() => {
    if (!query.trim()) {
      setFilterPills([])
      return
    }

    setIsParsing(true)
    const timeoutId = setTimeout(() => {
      // Simple filter extraction (this would call your NLP API in production)
      const pills: FilterPill[] = []
      
      // Role detection
      const roleMatches = query.match(/\b(VP|CTO|CFO|CEO|CRO|Director|Manager|Head|Founder|President)s?\s+of\s+\w+|\b(VP|CTO|CFO|CEO|CRO|Director|Manager|Head|Founder|President)s?\b/gi)
      if (roleMatches) {
        roleMatches.forEach((match, i) => {
          pills.push({ id: `role-${i}`, type: 'role', label: 'Role', value: match })
        })
      }

      // Geo detection
      const geoMatches = query.match(/\bin\s+([\w\s,]+?)(?:\s+at|\s+with|\s+exclude|,|$)/gi)
      if (geoMatches) {
        geoMatches.forEach((match, i) => {
          const geo = match.replace(/^in\s+/i, '').replace(/\s+(at|with|exclude)$/i, '').trim()
          if (geo.length > 0) {
            pills.push({ id: `geo-${i}`, type: 'geo', label: 'Location', value: geo })
          }
        })
      }

      // Industry detection
      const industryTerms = ['fintech', 'saas', 'software', 'healthcare', 'tech', 'AI', 'machine learning', 'consulting', 'enterprise']
      industryTerms.forEach((term, i) => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi')
        if (regex.test(query)) {
          pills.push({ id: `industry-${i}`, type: 'industry', label: 'Industry', value: term })
        }
      })

      // Headcount detection
      const headcountMatch = query.match(/(\d+)[–-](\d+)\s+employee|headcount\s*[<>]\s*(\d+)|<\s*(\d+)/i)
      if (headcountMatch) {
        pills.push({ id: 'headcount-0', type: 'headcount', label: 'Headcount', value: headcountMatch[0] })
      }

      // Exclude detection
      const excludeMatch = query.match(/exclude\s+([\w\s,]+)/gi)
      if (excludeMatch) {
        excludeMatch.forEach((match, i) => {
          const excluded = match.replace(/^exclude\s+/i, '').trim()
          pills.push({ id: `exclude-${i}`, type: 'exclude', label: 'Exclude', value: excluded })
        })
      }

      setFilterPills(pills)
      setIsParsing(false)
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [query])

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
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
    setShowExamples(false)
  }

  const handleCopyURL = () => {
    if (result?.url) {
      navigator.clipboard.writeText(result.url)
    }
  }

  const handleCopyJSON = () => {
    if (result?.facets) {
      navigator.clipboard.writeText(result.facets)
    }
  }

  const removePill = (id: string) => {
    setFilterPills(pills => pills.filter(p => p.id !== id))
  }

  const handleAuthButtonClick = () => {
    if (user) {
      setShowAccountModal(true)
    } else {
      setShowAuthModal(true)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to focus input
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        const input = document.querySelector('.search-input') as HTMLInputElement
        if (input) input.focus()
      }
      
      // Cmd/Ctrl+Enter to copy URL
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && result?.url) {
        e.preventDefault()
        handleCopyURL()
      }
      
      // Cmd/Ctrl+Shift+C to copy JSON
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c' && result?.facets) {
        e.preventDefault()
        handleCopyJSON()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [result])

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
            <img src="/salesnav.io.jpg" alt="SalesNav AI" className="logo-image" />
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
        <section className="hero">
          {/* Hero Title */}
          <h1 className="hero-title">
            Describe your lead. We return a perfect Sales Navigator search.
          </h1>
          <p className="hero-subtitle">
            Roles, seniority, geo IDs, industries - auto-parsed and applied. No guesswork.
          </p>

          {/* Command Bar */}
          <form onSubmit={handleSubmit} className="command-bar-form" role="search">
            <div className={`command-bar ${loading ? 'loading' : ''}`}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="How can I help you today?"
                className="search-input"
                disabled={loading}
                autoFocus
              />
              <div className="command-bar-actions">
                <button 
                  type="submit" 
                  className={`command-bar-submit ${loading ? 'loading' : ''}`}
                  disabled={loading || !query.trim()}
                  aria-label="Submit"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3L10 17M10 3L5 8M10 3L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </form>

          {/* Filter Pills */}
          {(filterPills.length > 0 || isParsing) && (
            <div className="filter-pills-container">
              {isParsing ? (
                <>
                  <div className="filter-pill skeleton"></div>
                  <div className="filter-pill skeleton"></div>
                  <div className="filter-pill skeleton"></div>
                </>
              ) : (
                filterPills.map((pill) => (
                  <span key={pill.id} className={`filter-pill ${pill.type}`}>
                    <span className="pill-label">{pill.label}:</span> {pill.value}
                    <button 
                      className="pill-remove"
                      onClick={() => removePill(pill.id)}
                      aria-label={`Remove ${pill.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          )}

          {/* Live URL Preview Panel */}
          {result && (
            <div className="url-preview-panel">
              <div className="url-preview-header">
                <code className="url-preview-code" title="Exact filters we'll open in Sales Navigator">
                  {result.url}
                </code>
                <span className="confidence-badge">Confidence 0.92</span>
              </div>
              <div className="url-preview-actions">
                <a 
                  href={result.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-primary"
                  aria-label="Open in Sales Navigator"
                >
                  Open in Sales Navigator
                </a>
                <button 
                  onClick={handleCopyURL}
                  className="btn-secondary"
                  aria-label="Copy URL"
                >
                  Copy URL
                </button>
                <button 
                  onClick={handleCopyJSON}
                  className="btn-secondary"
                  aria-label="Copy JSON filters"
                >
                  Copy JSON
                </button>
              </div>
            </div>
          )}

          {/* Marketing Cards - Below the Fold */}
          {showExamples && !result && (
            <div className="marketing-cards-section">
              <h3 className="marketing-cards-title">Popular Searches</h3>
              <div className="marketing-cards-grid">
                {featuredQueries.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleClick(sample.text)}
                    className="marketing-card"
                  >
                    <div className="marketing-card-content">
                      <div className="marketing-card-title">{sample.text}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
