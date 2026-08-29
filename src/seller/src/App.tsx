import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SellerLayout } from './layouts/SellerLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

function App() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/dashboard" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />
      <Route element={<ForgotPasswordPage />} path="/forgot-password" />
      <Route element={<ResetPasswordPage />} path="/reset-password" />
      <Route element={<ProtectedRoute />}>
        <Route element={<SellerLayout />}>
          <Route element={<DashboardPage />} path="/dashboard" />
        </Route>
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  )
}

export default App
