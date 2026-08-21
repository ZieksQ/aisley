import React from 'react';
import { AisleyLogo } from '../common/AisleyLogo';
import { FloatingLookbookCards } from './FloatingLookbookCards';
import { FaShieldHalved, FaTruckFast, FaCertificate } from 'react-icons/fa6';

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  activeTab?: 'login' | 'register' | 'status';
  onTabChange?: (tab: 'login' | 'register') => void;
}

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  children,
  activeTab = 'login',
  onTabChange,
}) => {
  return (
    <main className="min-h-screen bg-[#070B13] text-white relative flex flex-col justify-between overflow-x-hidden selection:bg-[#E723A2] selection:text-white">
      {/* Architectural blueprint grid overlay */}
      <div className="absolute inset-0 blueprint-grid-dark opacity-35 pointer-events-none" />

      {/* Floating Lookbook Atmospheric Cards (Softly Blurred in Background) */}
      <FloatingLookbookCards />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <AisleyLogo size="md" theme="dark" />

        {onTabChange && (
          <div className="flex items-center gap-3">
            {activeTab === 'login' ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="hidden sm:inline">New boutique brand?</span>
                <button
                  onClick={() => onTabChange('register')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  Apply as Seller
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="hidden sm:inline">Already registered?</span>
                <button
                  onClick={() => onTabChange('login')}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex-1 flex items-center justify-center">
        {children}
      </div>

      {/* Footer Compliance Bar */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-[#0B0F19]/90 py-4 px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-300">
              <FaShieldHalved className="text-[#10B981]" /> Verified Boutique Marketplace
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <FaTruckFast className="text-[#0284C7]" /> Integrated Logistics Network (PH-Wide)
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <FaCertificate className="text-[#E723A2]" /> Escrowed Payout Protection
            </span>
          </div>

          <p className="text-slate-500">
            &copy; 2026 Aisley Niche E-Commerce ERP. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
};
