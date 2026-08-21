import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import {
  FaRightFromBracket,
  FaGear,
  FaBars,
  FaUmbrellaBeach,
  FaBolt,
  FaMoon,
  FaSun,
} from 'react-icons/fa6';

interface TopNavigationProps {
  onToggleSidebar?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ onToggleSidebar }) => {
  const {
    seller,
    storeSettings,
    logout,
    setCurrentView,
    simulateAdminApproval,
    theme,
    toggleTheme,
  } = useSeller();

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-300 dark:border-slate-800 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xs px-4 sm:px-6 transition-colors">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="grid size-9 place-items-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
          >
            <FaBars className="size-4" />
          </button>
        )}

        {/* Store Title & Operational Status */}
        <div className="flex items-center gap-3">
          <img
            src={storeSettings.logoUrl}
            alt={storeSettings.storeName}
            className="size-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700 hidden sm:block"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {storeSettings.storeName}
              </h2>
              {storeSettings.vacationMode && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[10px] font-bold">
                  <FaUmbrellaBeach className="size-2.5" /> Vacation Mode
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-num truncate hidden sm:block">
              {seller?.businessCategory} • Makati Store
            </p>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Prototype Switcher Button */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-300 dark:border-slate-700 text-xs">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
            <FaBolt className="text-amber-500" /> Mode:
          </span>
          <button
            onClick={() => simulateAdminApproval(true)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              seller?.status === 'approved'
                ? 'bg-[#E723A2] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => simulateAdminApproval(false)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              seller?.status === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pending KYC
          </button>
        </div>

        {/* Dark Mode Toggle Button (Beside Profile) */}
        <button
          onClick={toggleTheme}
          className="grid size-9 place-items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <FaSun className="size-4" /> : <FaMoon className="size-4" />}
        </button>

        {/* User Profile Avatar Popover */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <img
              src={
                seller?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
              }
              alt={seller?.firstName}
              className="size-8 rounded-xl object-cover border border-slate-300 dark:border-slate-700"
            />
            <div className="text-left hidden lg:block pr-1">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {seller?.firstName} {seller?.lastName}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-mono-num">
                Verified Seller
              </p>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl p-2 space-y-1">
              <div className="p-2 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {seller?.firstName} {seller?.lastName}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{seller?.email}</p>
              </div>

              <button
                onClick={() => {
                  setCurrentView('settings');
                  setIsProfileOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                <FaGear className="size-3 text-slate-400" /> Store & Payout Settings
              </button>

              <button
                onClick={() => {
                  toggleTheme();
                  setIsProfileOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                {theme === 'dark' ? (
                  <>
                    <FaSun className="size-3 text-amber-400" /> Switch to Light Mode
                  </>
                ) : (
                  <>
                    <FaMoon className="size-3 text-slate-500" /> Switch to Dark Mode
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  logout();
                  setIsProfileOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
              >
                <FaRightFromBracket className="size-3" /> Sign Out of Aisley
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
