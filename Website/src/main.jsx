import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import { applyTheme, getInitialTheme } from './services/theme'

// Apply the persisted / system theme before the first paint.
applyTheme(getInitialTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
