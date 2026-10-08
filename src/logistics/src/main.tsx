import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'
import { ThemeProvider } from './features/appearance/ThemeProvider'
import { applyTheme, readTheme } from './features/appearance/theme'

applyTheme(readTheme())
const router = createBrowserRouter([{ path: '*', element: <App /> }])
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/receiving-sw.js').catch(() => undefined)
}
