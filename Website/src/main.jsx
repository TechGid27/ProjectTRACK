import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import { applyTheme, getInitialTheme } from './services/theme'
import { installEasterEgg } from './services/easterEgg'

// Apply the persisted / system theme before the first paint.
applyTheme(getInitialTheme())

// Easter egg: 5 clicks anywhere → random funny music.
installEasterEgg()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
