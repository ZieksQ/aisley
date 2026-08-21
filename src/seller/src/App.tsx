import React, { useState } from 'react';
import { SellerProvider, useSeller } from './context/SellerContext';
import { AuthSplitLayout } from './components/auth/AuthSplitLayout';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterWizard } from './components/auth/RegisterWizard';
import { ApprovalStatusView } from './components/auth/ApprovalStatusView';
import { SellerLayout } from './components/layout/SellerLayout';
import { DashboardView } from './components/dashboard/DashboardView';
import { InventoryView } from './components/inventory/InventoryView';
import { VouchersTab } from './components/inventory/VouchersTab';
import { OrdersView } from './components/orders/OrdersView';
import { CustomerReviewsTab } from './components/orders/CustomerReviewsTab';
import { ReportsView } from './components/reports/ReportsView';
import { ChatView } from './components/chat/ChatView';
import { SettingsView } from './components/settings/SettingsView';

const AppContent: React.FC = () => {
  const { seller, currentView } = useSeller();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Case 1: Unauthenticated -> Show Auth Layout (Login / Register)
  if (!seller) {
    return (
      <AuthSplitLayout
        activeTab={authMode}
        onTabChange={(tab) => setAuthMode(tab)}
      >
        {authMode === 'login' ? (
          <LoginForm onSwitchToRegister={() => setAuthMode('register')} />
        ) : (
          <RegisterWizard onSwitchToLogin={() => setAuthMode('login')} />
        )}
      </AuthSplitLayout>
    );
  }

  // Case 2: Authenticated but Pending/Rejected Admin Approval -> Show Approval Milestone Status Tracker
  if (seller.status !== 'approved') {
    return (
      <AuthSplitLayout activeTab="status">
        <ApprovalStatusView />
      </AuthSplitLayout>
    );
  }

  // Case 3: Approved Active Merchant -> Show Full Seller Console Portal
  return (
    <SellerLayout>
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'inventory' && <InventoryView />}
      {currentView === 'vouchers' && <VouchersTab />}
      {currentView === 'orders' && <OrdersView />}
      {currentView === 'reports' && <ReportsView />}
      {currentView === 'chat' && <ChatView />}
      {currentView === 'reviews' && <CustomerReviewsTab />}
      {currentView === 'settings' && <SettingsView />}
    </SellerLayout>
  );
};

export default function App() {
  return (
    <SellerProvider>
      <AppContent />
    </SellerProvider>
  );
}
