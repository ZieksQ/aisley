import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SellerLayout } from './layouts/SellerLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { InventoryDetailPage } from './pages/InventoryDetailPage'
import { InventoryPage } from './pages/InventoryPage'
import { ProductFormPage } from './pages/ProductFormPage'
import { ProductsPage } from './pages/ProductsPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { AccountPage } from './pages/AccountPage'
import { LowStockAlertDetailPage } from './pages/LowStockAlertDetailPage'
import { LowStockAlertsPage } from './pages/LowStockAlertsPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrderApprovalPage } from './pages/OrderApprovalPage'
import { OrderPickupPage } from './pages/OrderPickupPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { NotificationDetailPage } from './pages/NotificationDetailPage'
import { ProductQuestionDetailPage } from './pages/ProductQuestionDetailPage'
import { ProductQuestionsPage } from './pages/ProductQuestionsPage'
import { PolicyConsentPage } from './pages/PolicyConsentPage'

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
          <Route element={<Navigate replace to="/orders/monitoring" />} path="/orders" />
          <Route element={<OrdersPage />} path="/orders/monitoring" />
          <Route element={<OrderApprovalPage />} path="/orders/approval" />
          <Route element={<OrderPickupPage />} path="/orders/pickup" />
          <Route element={<OrderDetailPage />} path="/orders/:orderId" />
          <Route element={<OrderDetailPage preparation />} path="/orders/:orderId/prepare" />
          <Route element={<NotificationsPage />} path="/notifications" />
          <Route element={<NotificationDetailPage />} path="/notifications/:notificationId" />
          <Route element={<ProductQuestionsPage />} path="/product-questions" />
          <Route element={<ProductQuestionDetailPage />} path="/products/:productId/questions/:questionId" />
          <Route element={<ProductsPage />} path="/products" />
          <Route element={<ProductFormPage />} path="/products/new" />
          <Route element={<ProductFormPage />} path="/products/:productId/edit" />
          <Route element={<InventoryPage />} path="/inventory" />
          <Route element={<InventoryDetailPage />} path="/inventory/:skuId" />
          <Route element={<LowStockAlertsPage />} path="/low-stock-alerts" />
          <Route element={<LowStockAlertDetailPage />} path="/low-stock-alerts/:alertId" />
          <Route element={<AccountPage />} path="/account" />
          <Route element={<PolicyConsentPage />} path="/policy-consent" />
        </Route>
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  )
}

export default App
