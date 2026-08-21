import React from 'react';
import { FaCircleCheck, FaBolt, FaClock, FaLocationDot, FaTruckFast } from 'react-icons/fa6';

export const OperationalTicker: React.FC = () => {
  const tickerItems = [
    { icon: <FaCircleCheck className="text-[#10B981]" />, text: 'Fulfillment Status: All Systems Operational' },
    { icon: <FaLocationDot className="text-[#0284C7]" />, text: 'Metro Manila Priority Hub: Online (Same-Day Handover)' },
    { icon: <FaTruckFast className="text-[#E723A2]" />, text: 'Carrier On-Time Rate: 99.8% (J&T, Flash, Aisley Express)' },
    { icon: <FaClock className="text-[#F59E0B]" />, text: 'Daily Platform Cut-off: 18:00 PHT' },
    { icon: <FaBolt className="text-[#10B981]" />, text: 'Instant Merchant Payouts: Enabled' },
  ];

  return (
    <div className="relative w-full overflow-hidden bg-[#0F172A] border-b border-[#1E293B] py-2 text-xs font-medium text-slate-300 select-none z-20">
      <div className="flex w-max animate-ticker whitespace-nowrap">
        {/* Double array for seamless loop */}
        {[...tickerItems, ...tickerItems].map((item, idx) => (
          <div key={idx} className="inline-flex items-center gap-2 mx-6 tracking-wide">
            {item.icon}
            <span>{item.text}</span>
            <span className="text-slate-600 ml-4">•</span>
          </div>
        ))}
      </div>
    </div>
  );
};
