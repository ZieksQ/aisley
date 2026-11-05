import { AppearancePage } from './pages/AppearancePage'
import { BillingPage } from './pages/BillingPage'
import { LegacySettingsRedirect } from './components/LegacySettingsRedirect'
import { LegacyMessageRedirect } from './components/LegacyMessageRedirect'
import { VouchersPage } from './pages/VouchersPage'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, SessionRoute } from './components/ProtectedRoute'
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
import { PickupParcelPage } from './pages/PickupParcelPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { NotificationDetailPage } from './pages/NotificationDetailPage'
import { ProductQuestionDetailPage } from './pages/ProductQuestionDetailPage'
import { ProductQuestionsPage } from './pages/ProductQuestionsPage'
import { ProductReviewDetailPage } from './pages/ProductReviewDetailPage'
import { ProductReviewsPage } from './pages/ProductReviewsPage'
import { PolicyConsentPage } from './pages/PolicyConsentPage'
import { FinancePaymentsPage } from './pages/FinancePaymentsPage'
import { FinancePage } from './pages/FinancePage'
import { MessagesPage } from './pages/MessagesPage'
import { SupportTicketsPage } from './pages/SupportTicketsPage'
import { ShippingProvidersPage } from './pages/ShippingProvidersPage'

function App() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/dashboard" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register/*" />
      <Route element={<ForgotPasswordPage />} path="/forgot-password" />
      <Route element={<ResetPasswordPage />} path="/reset-password" />
      <Route element={<SessionRoute />}>
        <Route element={<SellerLayout />}>
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardPage />} path="/dashboard" />
            <Route element={<VouchersPage />} path="/vouchers" />
            <Route element={<VouchersPage />} path="/vouchers/new" />
            <Route element={<VouchersPage />} path="/vouchers/:voucherId" />
            <Route element={<FinancePage />} path="/finance" />
            <Route element={<FinancePaymentsPage />} path="/finance/payouts" />
            <Route element={<FinancePaymentsPage />} path="/finance/payment-settings" />
            <Route element={<MessagesPage />} path="/messages" />
            <Route element={<LegacyMessageRedirect kind="customer_shop" />} path="/messages/:conversationId" />
            <Route element={<LegacyMessageRedirect kind="seller_logistics" />} path="/logistics-messages" />
            <Route element={<LegacyMessageRedirect kind="courier_seller" />} path="/courier-messages" />
            <Route element={<SupportTicketsPage />} path="/support-tickets" />
            <Route element={<Navigate replace to="/orders/monitoring" />} path="/orders" />
            <Route element={<OrdersPage />} path="/orders/monitoring" />
            <Route element={<OrderApprovalPage />} path="/orders/approval" />
            <Route element={<OrderPickupPage />} path="/orders/pickup" />
            <Route element={<PickupParcelPage />} path="/orders/pickup/:pickupId" />
            <Route element={<OrderDetailPage />} path="/orders/:orderId" />
            <Route element={<OrderDetailPage preparation />} path="/orders/:orderId/prepare" />
            <Route element={<NotificationsPage />} path="/notifications" />
            <Route element={<NotificationDetailPage />} path="/notifications/:notificationId" />
            <Route element={<ProductQuestionsPage />} path="/product-questions" />
            <Route element={<ProductQuestionDetailPage />} path="/products/:productId/questions/:questionId" />
            <Route element={<ProductReviewsPage />} path="/reviews" />
            <Route element={<ProductReviewDetailPage />} path="/reviews/:reviewId" />
            <Route element={<ProductsPage />} path="/products" />
            <Route element={<ProductFormPage />} path="/products/new" />
            <Route element={<ProductFormPage />} path="/products/:productId/edit" />
            <Route element={<ShippingProvidersPage />} path="/shipping-providers" />
            <Route element={<InventoryPage />} path="/inventory" />
            <Route element={<InventoryDetailPage />} path="/inventory/:skuId" />
            <Route element={<LowStockAlertsPage />} path="/low-stock-alerts" />
            <Route element={<LowStockAlertDetailPage />} path="/low-stock-alerts/:alertId" />
            <Route element={<LegacySettingsRedirect to="/settings/account" />} path="/account" />
            <Route element={<LegacySettingsRedirect to="/settings/account" />} path="/settings" />
            <Route element={<AccountPage />} path="/settings/account" />
            <Route element={<PolicyConsentPage />} path="/settings/terms" />
            <Route element={<BillingPage />} path="/settings/billing" />
            <Route element={<AppearancePage />} path="/settings/appearance" />
            <Route element={<LegacySettingsRedirect to="/settings/terms" />} path="/policy-consent" />
          </Route>
        </Route>
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  )
}

export default App
