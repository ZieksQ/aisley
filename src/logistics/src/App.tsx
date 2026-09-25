import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LogisticsLayout } from './layouts/LogisticsLayout'
import { AccountPage } from './pages/AccountPage'
import { CourierApplicationDetailPage } from './pages/CourierApplicationDetailPage'
import { CourierApplicationsPage } from './pages/CourierApplicationsPage'
import { CourierVehiclePage } from './pages/CourierVehiclePage'
import { CourierVehiclesPage } from './pages/CourierVehiclesPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeliveryConfirmationsPage } from './pages/DeliveryConfirmationsPage'
import { DispatchPage } from './pages/DispatchPage'
import { FinancePage } from './pages/FinancePage'
import { FleetPage } from './pages/FleetPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { FulfillmentOperationsPage } from './pages/FulfillmentOperationsPage'
import { InboundLinehaulPage } from './pages/InboundLinehaulPage'
import { LinehaulDispatchPage } from './pages/LinehaulDispatchPage'
import { LinehaulPage } from './pages/LinehaulPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { OperationalChatPage } from './pages/OperationalChatPage'
import { PickupDetailPage } from './pages/PickupDetailPage'
import { PickupsPage } from './pages/PickupsPage'
import { PolicyConsentPage } from './pages/PolicyConsentPage'
import { ReceiveAtHubPage } from './pages/ReceiveAtHubPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SortingPage } from './pages/SortingPage'
import { SortPlanPage } from './pages/SortPlanPage'
import { SupportTicketsPage } from './pages/SupportTicketsPage'

export default function App() {
  return <Routes>
    <Route element={<Navigate replace to="/dashboard" />} path="/" />
    <Route element={<LoginPage />} path="/login" />
    <Route element={<RegisterPage />} path="/register" />
    <Route element={<ForgotPasswordPage />} path="/forgot-password" />
    <Route element={<ResetPasswordPage />} path="/reset-password" />
    <Route element={<ProtectedRoute />}>
      <Route element={<LogisticsLayout />}>
        <Route element={<DashboardPage />} path="/dashboard" />
        <Route element={<FinancePage />} path="/finance" />
        <Route element={<FulfillmentOperationsPage />} path="/operations" />
        <Route element={<DeliveryConfirmationsPage />} path="/delivery-confirmations" />
        <Route element={<ReceiveAtHubPage />} path="/receive-at-hub" />
        <Route element={<LinehaulPage />} path="/linehaul" />
        <Route element={<LinehaulDispatchPage />} path="/linehaul-dispatch" />
        <Route element={<InboundLinehaulPage />} path="/inbound-linehaul" />
        <Route element={<SortingPage />} path="/sorting" />
        <Route element={<SortPlanPage />} path="/sort-plan" />
        <Route element={<DispatchPage />} path="/dispatch" />
        <Route element={<PickupsPage />} path="/pickups" />
        <Route element={<PickupDetailPage />} path="/pickups/:pickupId" />
        <Route element={<CourierApplicationsPage />} path="/courier-applications" />
        <Route element={<CourierApplicationDetailPage />} path="/courier-applications/:affiliationId" />
        <Route element={<FleetPage />} path="/fleet" />
        <Route element={<CourierVehiclesPage />} path="/vehicles" />
        <Route element={<CourierVehiclePage />} path="/couriers/:courierId/vehicle" />
        <Route element={<NotificationsPage />} path="/notifications" />
        <Route element={<NotificationsPage />} path="/notifications/:notificationId" />
        <Route element={<OperationalChatPage />} path="/messages" />
        <Route element={<SupportTicketsPage />} path="/support-tickets" />
        <Route element={<AccountPage />} path="/account" />
        <Route element={<PolicyConsentPage />} path="/policy-consent" />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Route>
    <Route element={<Navigate replace to="/dashboard" />} path="*" />
  </Routes>
}
