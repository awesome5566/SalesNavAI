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

interface RecentSearch {
  text: string
  timestamp: number
}

const RECENT_SEARCHES_KEY = 'recentSearches'
const MAX_RECENT_SEARCHES = 3

function App() {
  const { user, session, loading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signIn')
  const [filterPills, setFilterPills] = useState<FilterPill[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const showExamples = true
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        const parsed: RecentSearch[] = JSON.parse(stored)
        setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES))
      }
    } catch (error) {
      console.error('Failed to load recent searches', error)
    }
  }, [])

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
      openAuthModal('signIn')
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
      addRecentSearch(queryToSubmit)

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

  const addRecentSearch = (searchText: string) => {
    const trimmed = searchText.trim()
    if (!trimmed) return

    setRecentSearches(prev => {
      if (prev[0]?.text === trimmed) {
        return prev
      }

      const filtered = prev.filter(item => item.text !== trimmed)
      const updated = [{ text: trimmed, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES)

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
        } catch (error) {
          console.error('Failed to save recent searches', error)
        }
      }

      return updated
    })
  }

  const openAuthModal = (mode: 'signIn' | 'signUp') => {
    setAuthModalMode(mode)
    setShowAuthModal(true)
  }

  const handleAccountButtonClick = () => {
    setShowAccountModal(true)
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
      {/* Background: radial wash + art-directed grid lines (non-intersecting) */}
      <div className="bg-wash"></div>
      <svg
        className="bg-grid"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="grid-pattern" width="400" height="300" patternUnits="userSpaceOnUse">
            <g className="grid-lines" transform="scale(0.529)">
              {/* Horizontal segments */}
              <line x1="80" y1="90" x2="500" y2="90" />
              <line x1="35" y1="219" x2="549" y2="219" />
              <line x1="35" y1="193" x2="549" y2="193" />
              <line x1="15" y1="322" x2="605" y2="322" />
              <line x1="33" y1="39" x2="546" y2="39" />
              <line x1="33" y1="296" x2="546" y2="296" />
              <line x1="33" y1="270" x2="546" y2="270" />
              <line x1="33" y1="245" x2="546" y2="245" />
              <line x1="0" y1="0" x2="580" y2="0" />

              {/* Narrow vertical column */}
              <line x1="561" y1="70" x2="561" y2="225" />
              <line x1="561" y1="86" x2="561" y2="241" />

              {/* Diagonal mini slashes */}
              <line x1="536" y1="108" x2="623" y2="83" />
              <line x1="536" y1="201" x2="623" y2="176" />
              <line x1="536" y1="154" x2="623" y2="129" />
              <line x1="536" y1="247" x2="623" y2="222" />
              <line x1="536" y1="35" x2="623" y2="10" />

              {/* Rotated block on the left */}
              <g transform="translate(48,341) rotate(-90)">
                <line x1="-34" y1="0" x2="341" y2="0" />
                <line x1="36" y1="94" x2="242" y2="94" />
                <line x1="0" y1="467" x2="307" y2="467" />
                <line x1="0" y1="47" x2="307" y2="47" />
                <line x1="88" y1="141" x2="191" y2="141" />
                <line x1="-34" y1="514" x2="341" y2="514" />
              </g>

              {/* Duplicate composition at intervals to fill pattern */}
              <g transform="translate(1512,0)">
                <line x1="80" y1="90" x2="500" y2="90" />
                <line x1="35" y1="219" x2="549" y2="219" />
                <line x1="33" y1="39" x2="546" y2="39" />
                <line x1="536" y1="154" x2="623" y2="129" />
                <g transform="translate(48,341) rotate(-90)">
                  <line x1="-34" y1="0" x2="341" y2="0" />
                  <line x1="0" y1="467" x2="307" y2="467" />
                </g>
              </g>
              
              {/* Middle duplicates to fill the pattern space */}
              <g transform="translate(756,0)">
                <line x1="80" y1="90" x2="500" y2="90" />
                <line x1="35" y1="219" x2="549" y2="219" />
                <line x1="35" y1="193" x2="549" y2="193" />
                <line x1="33" y1="39" x2="546" y2="39" />
                <line x1="33" y1="296" x2="546" y2="296" />
                <line x1="33" y1="270" x2="546" y2="270" />
                <line x1="561" y1="70" x2="561" y2="225" />
              </g>
              
              {/* Bottom row duplicates */}
              <g transform="translate(0,650)">
                <line x1="80" y1="90" x2="500" y2="90" />
                <line x1="35" y1="219" x2="549" y2="219" />
                <line x1="33" y1="39" x2="546" y2="39" />
                <line x1="536" y1="108" x2="623" y2="83" />
              </g>
              
              <g transform="translate(756,650)">
                <line x1="80" y1="90" x2="500" y2="90" />
                <line x1="35" y1="193" x2="549" y2="193" />
                <line x1="33" y1="270" x2="546" y2="270" />
              </g>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      </svg>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />
      <AccountManagement isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
      
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-text">SalesNav.io</span>
          </div>
          <div className="header-actions">
            {user ? (
              <button className="auth-button auth-button--gray" onClick={handleAccountButtonClick}>
                <span className="user-avatar">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Profile" />
                  ) : (
                    user.email?.[0].toUpperCase()
                  )}
                </span>
                <span className="button-text">Account</span>
              </button>
            ) : (
              <>
                <button className="auth-button" onClick={() => openAuthModal('signUp')}>
                  <span className="login-icon">✨</span>
                  <span className="button-text">Sign Up</span>
                </button>
                <button
                  className="auth-button auth-button--gray"
                  onClick={() => openAuthModal('signIn')}
                >
                  <span className="login-icon">👤</span>
                  <span className="button-text">Sign In</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          {/* Hero Title */}
          <h1 className="hero-title">
            <span>Describe your lead. We return a</span>
            <span>perfect Sales Navigator search.</span>
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
                aria-label={loading ? "Loading..." : "Submit"}
              >
                {!loading && (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3L10 17M10 3L5 8M10 3L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
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
          {showExamples && !result && recentSearches.length > 0 && (
            <div className="marketing-cards-section">
              <h3 className="marketing-cards-title">Recent Searches</h3>
              <div className="marketing-cards-grid">
                {recentSearches.map(search => (
                  <button
                    key={search.timestamp}
                    onClick={() => handleSampleClick(search.text)}
                    className="marketing-card"
                  >
                    <div className="marketing-card-content">
                      <div className="marketing-card-title">{search.text}</div>
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
