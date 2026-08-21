import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import { AisleyLogo } from '../common/AisleyLogo';
import { OperationalTicker } from '../common/OperationalTicker';
import { TopNavigation } from './TopNavigation';
import {
  FaChartPie,
  FaBoxOpen,
  FaTruckFast,
  FaTicket,
  FaFileInvoiceDollar,
  FaComments,
  FaStar,
  FaGear,
  FaRightFromBracket,
  FaXmark,
} from 'react-icons/fa6';

export const SellerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentView, setCurrentView, logout, chatThreads, orders } = useSeller();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const unreadChatCount = chatThreads.reduce((sum, t) => sum + t.unreadCount, 0);
  const pendingOrdersCount = orders.filter((o) => o.status === 'new' || o.status === 'to_pack').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: <FaChartPie className="size-4" /> },
    { id: 'inventory', label: 'Inventory & Products', icon: <FaBoxOpen className="size-4" /> },
    {
      id: 'orders',
      label: 'Orders & ERP Pipeline',
      icon: <FaTruckFast className="size-4" />,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    { id: 'vouchers', label: 'Vouchers & Promos', icon: <FaTicket className="size-4" /> },
    { id: 'reports', label: 'Financial Analytics', icon: <FaFileInvoiceDollar className="size-4" /> },
    {
      id: 'chat',
      label: 'Client Concierge Chat',
      icon: <FaComments className="size-4" />,
      badge: unreadChatCount > 0 ? unreadChatCount : undefined,
      badgeColor: 'bg-[#E723A2]',
    },
    { id: 'reviews', label: 'Buyer Feedback', icon: <FaStar className="size-4" /> },
    { id: 'settings', label: 'Store & Payout Settings', icon: <FaGear className="size-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-[#E723A2] selection:text-white">
      {/* Live Operational Ticker Ribbon */}
      <OperationalTicker />

      <div className="flex flex-1 relative">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-slate-200 bg-white sticky top-0 h-[calc(100vh-33px)] p-4 select-none shrink-0 z-20">
          <div className="space-y-6">
            {/* Logo */}
            <div className="px-2 pt-2">
              <AisleyLogo size="md" theme="light" />
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#E723A2] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono-num font-extrabold ${
                          isActive
                            ? 'bg-white text-[#E723A2]'
                            : item.badgeColor || 'bg-amber-500 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sign Out */}
          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
            >
              <FaRightFromBracket className="size-3.5" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/70"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative w-64 bg-white p-4 flex flex-col justify-between z-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <AisleyLogo size="sm" theme="light" />
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                  >
                    <FaXmark className="size-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentView(item.id as any);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                          isActive
                            ? 'bg-[#E723A2] text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50"
              >
                <FaRightFromBracket /> Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopNavigation onToggleSidebar={() => setMobileSidebarOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 blueprint-grid">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
};
