import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import {
  FaComments,
  FaRightFromBracket,
  FaGear,
  FaBars,
  FaUmbrellaBeach,
  FaBolt,
} from 'react-icons/fa6';

interface TopNavigationProps {
  onToggleSidebar?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ onToggleSidebar }) => {
  const {
    seller,
    storeSettings,
    logout,
    chatThreads,
    setCurrentView,
    simulateAdminApproval,
  } = useSeller();

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const unreadChatCount = chatThreads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-xs px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="grid size-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <FaBars className="size-4" />
          </button>
        )}

        {/* Store Title & Operational Status */}
        <div className="flex items-center gap-3">
          <img
            src={storeSettings.logoUrl}
            alt={storeSettings.storeName}
            className="size-8 rounded-lg object-cover border border-slate-200 hidden sm:block"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 truncate">
                {storeSettings.storeName}
              </h2>
              {storeSettings.vacationMode && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  <FaUmbrellaBeach className="size-2.5" /> Vacation Mode
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono-num truncate hidden sm:block">
              {seller?.businessCategory} • Makati Atelier
            </p>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Prototype Switcher Button */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <span className="text-[10px] font-bold text-slate-500 px-2 flex items-center gap-1">
            <FaBolt className="text-amber-500" /> Mode:
          </span>
          <button
            onClick={() => simulateAdminApproval(true)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              seller?.status === 'approved'
                ? 'bg-[#E723A2] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => simulateAdminApproval(false)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              seller?.status === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending KYC
          </button>
        </div>

        {/* Chat Quick Access */}
        <button
          onClick={() => setCurrentView('chat')}
          className="relative grid size-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
          title="Client Concierge Chat"
        >
          <FaComments className="size-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-[#E723A2] text-white text-[9px] font-black grid place-items-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar Popover */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 transition cursor-pointer"
          >
            <img
              src={
                seller?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
              }
              alt={seller?.firstName}
              className="size-8 rounded-xl object-cover border border-slate-200"
            />
            <div className="text-left hidden lg:block pr-1">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {seller?.firstName} {seller?.lastName}
              </p>
              <p className="text-[10px] text-emerald-600 font-bold font-mono-num">
                Verified Seller
              </p>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl bg-white border border-slate-200 shadow-2xl p-2 space-y-1">
              <div className="p-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">
                  {seller?.firstName} {seller?.lastName}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{seller?.email}</p>
              </div>

              <button
                onClick={() => {
                  setCurrentView('settings');
                  setIsProfileOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <FaGear className="size-3 text-slate-400" /> Store & Payout Settings
              </button>

              <button
                onClick={() => {
                  logout();
                  setIsProfileOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              >
                <FaRightFromBracket className="size-3" /> Sign Out of Atelier
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
