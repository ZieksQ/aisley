import React from 'react';
import { FaArrowTrendUp, FaArrowTrendDown } from 'react-icons/fa6';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  badgeText?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  change,
  isPositive = true,
  icon,
  iconBgColor = 'bg-[#FDF2F9] dark:bg-pink-950/70 border border-pink-200 dark:border-pink-800/80',
  iconTextColor = 'text-[#E723A2] dark:text-pink-300',
  badgeText,
  action,
}) => {
  return (
    <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 shadow-sm transition-all hover:border-slate-400 dark:hover:border-slate-700 flex flex-col justify-between">
      <div>
        {/* Top Header Row: Header Label & Icon as direct horizontal siblings */}
        <div className="flex items-center justify-between gap-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>

          <div
            className={`size-8.5 rounded-xl flex items-center justify-center text-sm ${iconBgColor} ${iconTextColor} shrink-0`}
          >
            {icon}
          </div>
        </div>

        {/* Value Section taking full width below header */}
        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono-num tracking-tight">
            {value}
          </span>
          {badgeText && (
            <span className="rounded-full bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 shrink-0">
              {badgeText}
            </span>
          )}
        </div>
      </div>

      {/* Footer Meta Row */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800/90 pt-3 text-xs">
        <div className="min-w-0 flex-1">
          {change ? (
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`inline-flex items-center gap-0.5 font-bold shrink-0 ${
                  isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isPositive ? <FaArrowTrendUp /> : <FaArrowTrendDown />}
                {change}
              </span>
              <span className="text-slate-400 dark:text-slate-500 truncate">vs last 7 days</span>
            </div>
          ) : subtitle ? (
            <span className="text-slate-500 dark:text-slate-400 font-medium truncate block">
              {subtitle}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate block">Live operational sync</span>
          )}
        </div>

        {action && (
          <button
            onClick={action.onClick}
            className="font-bold text-[#E723A2] dark:text-pink-400 hover:text-[#D61590] dark:hover:text-pink-300 hover:underline cursor-pointer whitespace-nowrap shrink-0 text-[11px] sm:text-xs flex items-center gap-1"
          >
            <span>{action.label}</span>
            <span>&rarr;</span>
          </button>
        )}
      </div>
    </div>
  );
};
