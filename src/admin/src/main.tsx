import { PortalThemeProvider, applyPortalTheme, readPortalTheme } from '@aisley/ui/portal'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.tsx'
import './index.css'
import App from './App.tsx'

applyPortalTheme(readPortalTheme('aisley-admin-theme'))

// Data routing preserves the existing screens and enables unsaved voucher guards.
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <PortalThemeProvider storageKey="aisley-admin-theme">
        <AuthProvider>
          <App />
        </AuthProvider>
      </PortalThemeProvider>
    ),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
