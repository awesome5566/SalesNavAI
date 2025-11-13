import React from 'react'
import ReactDOM from 'react-dom/client'

function App() {
  // Show whether Vite envs are present (not values)
  const hasUrl = !!import.meta.env.VITE_SUPABASE_URL
  const hasKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>SalesNavAI</h1>
      <p>Smoke test OK — React rendered.</p>
      <p>Env present: SUPABASE_URL = {String(hasUrl)}, SUPABASE_ANON_KEY = {String(hasKey)}</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
