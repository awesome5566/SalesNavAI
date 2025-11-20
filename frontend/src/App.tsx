import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { useAuth } from './contexts/AuthContext'
import { AuthModal } from './components/AuthModal'
import { AccountManagement } from './components/AccountManagement'

interface SearchResult {
  url: string
  facets: string
  dsl?: string
  warnings?: string[]
  summary?: string
}

interface RecentSearch {
  text: string
  timestamp: number
  url?: string
}

type CopyNotification = {
  message: string
  type: 'success' | 'error'
}

const RECENT_SEARCHES_KEY = 'recentSearches'

function App() {
  const { user, session, loading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signIn')
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [isSidebarVisible, setIsSidebarVisible] = useState(false)
  const [copyNotification, setCopyNotification] = useState<CopyNotification | null>(null)
  const copyNotificationTimeout = useRef<number | null>(null)

  const clearRecentSearches = () => {
    setRecentSearches([])
    setIsSidebarVisible(false)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(RECENT_SEARCHES_KEY)
      } catch (error) {
        console.error('Failed to clear recent searches', error)
      }
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        const parsed: RecentSearch[] = JSON.parse(stored)
        setRecentSearches(parsed)
      }
    } catch (error) {
      console.error('Failed to load recent searches', error)
    }
  }, [])

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
      addRecentSearch(queryToSubmit, data.url)

      if (data.url) {
        void copyUrlToClipboard(data.url)
        // Auto-open the URL in a new tab
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

  const triggerCopyNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setCopyNotification({ message, type })
    if (typeof window !== 'undefined') {
      if (copyNotificationTimeout.current) {
        window.clearTimeout(copyNotificationTimeout.current)
      }
      copyNotificationTimeout.current = window.setTimeout(() => {
        setCopyNotification(null)
        copyNotificationTimeout.current = null
      }, 2500)
    }
  }

  const copyUrlToClipboard = async (url: string) => {
    if (!url || typeof window === 'undefined') return

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url)
        triggerCopyNotification('Copied to clipboard')
        return
      } catch (error) {
        console.error('Failed to copy URL via clipboard API', error)
      }
    }

    try {
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      textArea.setAttribute('readonly', '')
      document.body.appendChild(textArea)
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (successful) {
        triggerCopyNotification('Copied to clipboard')
      } else {
        triggerCopyNotification('Unable to copy URL', 'error')
      }
    } catch (error) {
      console.error('Failed to copy URL via fallback', error)
      triggerCopyNotification('Unable to copy URL', 'error')
    }
  }

  const handleCopyURL = () => {
    if (result?.url) {
      void copyUrlToClipboard(result.url)
    }
  }

  const handleCopyJSON = () => {
    if (result?.facets) {
      navigator.clipboard.writeText(result.facets)
    }
  }

  const addRecentSearch = (searchText: string, url?: string) => {
    const trimmed = searchText.trim()
    if (!trimmed) return

    setRecentSearches(prev => {
      const existingIndex = prev.findIndex(item => item.text === trimmed)
      const now = Date.now()
      let updated: RecentSearch[]

      if (existingIndex >= 0) {
        const existing = prev[existingIndex]
        const revised: RecentSearch = {
          ...existing,
          text: trimmed,
          timestamp: now,
          url: url ?? existing.url,
        }
        const withoutExisting = prev.filter((_, index) => index !== existingIndex)
        updated = [revised, ...withoutExisting]
      } else {
        updated = [{ text: trimmed, timestamp: now, url }, ...prev]
      }

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

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && copyNotificationTimeout.current) {
        window.clearTimeout(copyNotificationTimeout.current)
      }
    }
  }, [])

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
      {copyNotification && (
        <div
          className={`copy-notification copy-notification--${copyNotification.type}`}
          role="status"
          aria-live="polite"
        >
          {copyNotification.message}
        </div>
      )}
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
                  <span className="button-text">Sign Up</span>
                </button>
                <button
                  className="auth-button auth-button--gray"
                  onClick={() => openAuthModal('signIn')}
                >
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
            <span>SalesNav.io</span>
           
          </h1>
          <p className="hero-subtitle">
          Describe your lead. We open a perfect Sales Navigator search.
          </p>

          {/* Command Bar */}
          <form onSubmit={handleSubmit} className="command-bar-form" role="search">
            <div className={`command-bar ${loading ? 'loading' : ''}`}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="B2B Saas SDRs at startups in San Francisco"
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

          {/* Summary Display */}
          {result?.summary && (
            <div className="result-summary">
              <div className="summary-content">
                {result.summary.split('\n').map((line, index) => (
                  <div key={index} className="summary-line">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings Display */}
          {result?.warnings && result.warnings.length > 0 && (
            <div className="result-warnings">
              {result.warnings.map((warning, index) => (
                <div key={index} className="warning-line">
                  ⚠️ {warning}
                </div>
              ))}
            </div>
          )}

        </section>
      </main>

      {recentSearches.length > 0 && (
        <>
          <div
            className="sidebar-interaction-layer"
            onMouseLeave={() => setIsSidebarVisible(false)}
          >
            <div
              className="sidebar-hover-zone"
              onMouseEnter={() => setIsSidebarVisible(true)}
            ></div>
            <aside
              className={`recent-searches-sidebar ${isSidebarVisible ? 'visible' : ''}`}
              onMouseEnter={() => setIsSidebarVisible(true)}
            >
              <div className="sidebar-header">
                <span>Recent</span>
                <button
                  className="clear-recent-button"
                  onClick={clearRecentSearches}
                  type="button"
                >
                  Clear
                </button>
              </div>
              <div className="recent-searches-list">
                {recentSearches.map(search => (
                  <div key={search.timestamp} className="recent-search-item">
                    <button
                      className="recent-search-select"
                      onClick={() => {
                        handleSampleClick(search.text)
                        setIsSidebarVisible(false)
                      }}
                      type="button"
                    >
                      <span className="recent-search-text">{search.text}</span>
                    </button>
                    {search.url && (
                      <button
                        className="recent-search-copy"
                        type="button"
                        aria-label="Copy URL"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (search.url) {
                            void copyUrlToClipboard(search.url)
                          }
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M6.5 4A2.5 2.5 0 0 1 9 1.5h6A2.5 2.5 0 0 1 17.5 4v6A2.5 2.5 0 0 1 15 12.5h-6A2.5 2.5 0 0 1 6.5 10V4ZM3 7A2 2 0 0 1 5 5h1v5a4 4 0 0 0 4 4h5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          </div>
          {!isSidebarVisible && (
            <div className="sidebar-icon-container">
              <img src="/sidebar-icon.svg" alt="Recent searches" className="sidebar-icon" />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
