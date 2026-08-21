import React from 'react';

export const FloatingLookbookCards: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* 1. Top-Left: Red Dress Lookbook Card */}
      <div
        className="absolute -top-6 -left-12 sm:top-12 sm:left-4 lg:left-12 w-64 sm:w-72 rounded-2xl bg-[#0F172A]/90 border border-slate-700/80 p-3.5 shadow-2xl text-white transform -rotate-6 transition-all"
        style={{ filter: 'blur(1.2px)', opacity: 0.55 }}
      >
        <div className="relative rounded-xl overflow-hidden mb-2.5 h-36 bg-slate-800">
          <img
            src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80"
            alt="Red Silk Slip Dress"
            className="w-full h-full object-cover object-top"
          />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-bold text-white uppercase tracking-wider">
            Aisley
          </span>
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-[#E723A2] text-xs font-black text-white font-mono-num">
            ₱2,990
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-white text-xs truncate">Mulberry Silk Slip Dress</p>
            <p className="text-[10px] text-slate-400">8 Reviews • In Stock</p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono-num">
            142 Sold
          </span>
        </div>
      </div>

      {/* 2. Bottom-Right: Payout Settlement Metric Card */}
      <div
        className="absolute bottom-12 -right-8 sm:bottom-20 sm:right-8 lg:right-16 w-60 sm:w-68 rounded-2xl bg-[#0F172A]/90 border border-slate-700/80 p-4 shadow-2xl text-white transform rotate-3 transition-all"
        style={{ filter: 'blur(1.2px)', opacity: 0.55 }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Payout Settlement
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono-num">
            GCash / Paid
          </span>
        </div>
        <p className="text-2xl font-black text-white font-mono-num">₱16,842.00</p>
        <p className="text-[10px] text-slate-400 mt-1">Credited to Seller Camille Valdez</p>
      </div>
    </div>
  );
};
