import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import { FaLock, FaEnvelope, FaBolt, FaArrowRight, FaStore, FaClockRotateLeft, FaShieldHalved } from 'react-icons/fa6';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { loginAs } = useSeller();
  const [email, setEmail] = useState('claire.delatour@atelier-aisley.com');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Auto-detect based on input email or default to approved
      if (email.includes('enzo') || email.includes('manilasilks')) {
        loginAs('pending');
      } else {
        loginAs('approved');
      }
    }, 600);
  };

  const handleQuickLogin = (type: 'approved' | 'pending') => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      loginAs(type);
    }, 400);
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl">
      {/* Left Column: Atelier Presentation Showcase */}
      <div className="lg:col-span-6 space-y-6 text-slate-200 hidden lg:block pr-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-semibold text-[#E723A2]">
          <FaStore /> Aisley Multi-Vendor Atelier Platform
        </div>

        <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-tight">
          Where Haute Artisans <br />
          <span className="text-[#E723A2]">Curate & Scale</span>
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed">
          Manage your boutique inventory, automate Philippine nationwide courier handovers, access real-time net profit analytics, and engage discerning clientele in one high-velocity dashboard.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xl font-black text-white font-mono-num">3.5%</p>
            <p className="text-xs font-semibold text-slate-400 mt-1">Platform Commission</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Lowest tier for curated ateliers</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xl font-black text-[#10B981] font-mono-num">Same-Day</p>
            <p className="text-xs font-semibold text-slate-400 mt-1">Direct Courier Pickup</p>
            <p className="text-[11px] text-slate-500 mt-0.5">J&T, Flash, Aisley Express</p>
          </div>
        </div>

        {/* Lookbook preview card with soft blur */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Claire Dela Tour"
              className="size-12 rounded-xl object-cover border border-slate-700"
            />
            <div>
              <p className="text-xs font-bold text-white">Maison Dela Tour Atelier</p>
              <p className="text-[11px] text-slate-400">Makati City • Apparel & Haute Couture</p>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-400 font-medium">
                <FaShieldHalved /> Verified Merchant • 99.4% On-Time Fulfillment
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: High Contrast White Form Card */}
      <div className="lg:col-span-6 w-full max-w-md mx-auto">
        <div className="rounded-3xl bg-white p-8 text-slate-900 shadow-2xl border border-slate-100 relative">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Seller Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your credentials to access your merchant console.
            </p>
          </div>

          {/* 1-Click Test Accounts Fast Selector */}
          <div className="mb-6 rounded-2xl bg-[#F8FAFC] border border-slate-200 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <FaBolt className="text-amber-500" /> Prototype 1-Click Access
              </span>
              <span className="text-[10px] text-slate-400 font-mono-num">Instant Auth</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('approved')}
                className="p-2.5 rounded-xl text-left bg-white border border-slate-200 hover:border-[#E723A2] hover:bg-[#FDF2F9] transition group"
              >
                <p className="text-xs font-bold text-slate-900 group-hover:text-[#E723A2] flex items-center justify-between">
                  Approved Atelier <FaArrowRight className="size-2.5 opacity-0 group-hover:opacity-100 transition" />
                </p>
                <p className="text-[10px] text-slate-500">MDT Couture (Full Access)</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('pending')}
                className="p-2.5 rounded-xl text-left bg-white border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition group"
              >
                <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700 flex items-center justify-between">
                  Pending Review <FaClockRotateLeft className="size-2.5 opacity-0 group-hover:opacity-100 transition" />
                </p>
                <p className="text-[10px] text-slate-500">Enzo Valdez (KYC In Review)</p>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Registered Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FaEnvelope className="size-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E723A2] focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </label>
                <a href="#" className="text-xs font-semibold text-[#E723A2] hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FaLock className="size-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E723A2] focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold text-sm uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Sign In to Atelier Console <FaArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Looking to join the Aisley vendor community?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="font-bold text-[#E723A2] hover:underline cursor-pointer"
              >
                Apply for an Atelier Account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
