import React, { useState } from 'react'
import './App.css'

interface SearchResult {
  url: string
  facets: string
  dsl?: string
  warnings?: string[]
}

const sampleQueries = [
  { text: "CFOs at fintech startups in Boston", type: "leads", tag: "leads" },
  { text: "Healthcare founders in San Francisco", type: "leads", tag: "leads" },
  { text: "Cybersecurity companies in Austin", type: "accounts", tag: "accounts" },
  { text: "Marketing directors at SaaS companies", type: "leads", tag: "leads" }
]

const chatHistory = [
  {
    query: "VPs of Sales at Series B SaaS companies",
    result: "✓ Found 2,847 leads",
    time: "2 hours ago"
  },
  {
    query: "Engineering managers in NYC with AI experience",
    result: "✓ Found 1,234 leads",
    time: "5 hours ago"
  },
  {
    query: "CTOs at healthcare tech startups",
    result: "✓ Found 892 leads",
    time: "Yesterday"
  },
  {
    query: "Marketing directors in fintech, Boston area",
    result: "✓ Found 456 leads",
    time: "2 days ago"
  },
  {
    query: "Product managers at e-commerce companies",
    result: "✓ Found 3,102 leads",
    time: "3 days ago"
  }
]

function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'leads' | 'companies'>('leads')
  const [showFilters, setShowFilters] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
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
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSampleClick = (sampleText: string) => {
    setQuery(sampleText)
    // Auto-run the sample query
    setTimeout(() => {
      setQuery(sampleText)
      handleSubmit()
    }, 100)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-main">SalesNav</span>
          <span className="logo-ai">.AI</span>
        </div>
        <div className="beta-badge">
          <span className="beta-text">Beta</span>
          <div className="beta-icon">⚡</div>
        </div>
      </header>

      <main className="main">
        <div className="hero">
          <h1 className="hero-title">Skip the filters. Just ask.</h1>
          <p className="hero-subtitle">
            Your AI Sales Research Assistant for LinkedIn Sales Navigator. 
            Type in plain English — get precise results.
          </p>
        </div>

        <div className="search-container">
          <div className="search-card">
            <div className="search-header">
              <h2 className="search-title">AI Search</h2>
              <p className="search-description">
                Ask like you would to a researcher. We translate it to Sales Navigator filters.
              </p>
            </div>

            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'leads' ? 'active' : ''}`}
                onClick={() => setActiveTab('leads')}
              >
                Leads
              </button>
              <button 
                className={`tab ${activeTab === 'companies' ? 'active' : ''}`}
                onClick={() => setActiveTab('companies')}
              >
                Companies
              </button>
            </div>

            <form onSubmit={handleSubmit} className="search-form">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Find CFOs at fintech startups in Boston"
                className="search-input"
                rows={3}
                disabled={loading}
              />
              
              <div className="search-actions">
                <div className="search-controls">
                  <button 
                    type="button"
                    onClick={() => setQuery('')}
                    className="clear-button"
                    disabled={loading}
                  >
                    Clear
                  </button>
                  <button 
                    type="submit" 
                    className="search-button"
                    disabled={loading || !query.trim()}
                  >
                    🔍 Run Search
                  </button>
                </div>
                
                <div className="search-options">
                  <label className="toggle-label">
                    <input 
                      type="checkbox" 
                      checked={showFilters}
                      onChange={(e) => setShowFilters(e.target.checked)}
                    />
                    <span className="toggle-text">Show extracted filters for transparency</span>
                  </label>
                  <span className="shortcut-hint">Cmd/Ctrl+Enter to run</span>
                </div>
              </div>
            </form>

            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
              </div>
            )}

            {result && (
              <div className="result-section">
                <div className="result-header">
                  <h3>Generated Sales Navigator URL:</h3>
                  <button 
                    onClick={() => copyToClipboard(result.url)}
                    className="copy-button"
                  >
                    Copy Link
                  </button>
                </div>
                <div className="url-display">
                  <code className="url-text">{result.url}</code>
                </div>
                
                {showFilters && result.facets && (
                  <div className="filters-display">
                    <h4>Applied Filters:</h4>
                    <pre className="filters-content">{result.facets}</pre>
                  </div>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <div className="warnings">
                    <h4>Warnings:</h4>
                    <ul>
                      {result.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sidebar">
            <div className="sample-card">
              <h3 className="sample-title">Try a sample</h3>
              <p className="sample-description">Click to auto-fill and run.</p>
              <div className="sample-buttons">
                {sampleQueries.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleClick(sample.text)}
                    className="sample-button"
                  >
                    <span className="sample-text">
                      {sample.type === 'leads' ? 'Leads' : 'Accounts'} • {sample.text}
                    </span>
                    <span className="sample-tag">{sample.tag}</span>
                  </button>
                ))}
              </div>
              <div className="pro-tip">
                <strong>Pro tip:</strong> Try natural language like "Series B SaaS", "hiring", "ICP", or a city/state.
              </div>
            </div>

            <div className="history-card">
              <h3 className="history-title">Recent Searches</h3>
              <p className="history-description">Your search history</p>
              <div className="history-list">
                {chatHistory.map((item, index) => (
                  <div key={index} className="history-item">
                    <div className="history-content">
                      <div className="history-query">{item.query}</div>
                      <div className="history-result">{item.result}</div>
                    </div>
                    <div className="history-time">{item.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="features">
          <div className="feature-card">
            <h3 className="feature-title">Built for speed</h3>
            <p className="feature-description">Stop fighting filters. Ask once; get a link that opens straight in Sales Navigator.</p>
          </div>
          <div className="feature-card">
            <h3 className="feature-title">LLM + rules</h3>
            <p className="feature-description">Natural language maps to deterministic filter objects for reliability.</p>
          </div>
          <div className="feature-card">
            <h3 className="feature-title">Transparent by default</h3>
            <p className="feature-description">See the filters we applied before you open the search. Edit and re-run instantly.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
