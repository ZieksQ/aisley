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
    <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 sm:p-5 shadow-sm transition-all hover:border-slate-400 dark:hover:border-slate-700 flex flex-col justify-between min-w-0 overflow-hidden">
      <div className="min-w-0">
        {/* Top Header Row: Header Label & Icon as direct horizontal siblings */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p
            className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1"
            title={title}
          >
            {title}
          </p>

          <div
            className={`size-7.5 sm:size-8.5 rounded-xl flex items-center justify-center text-xs sm:text-sm ${iconBgColor} ${iconTextColor} shrink-0`}
          >
            {icon}
          </div>
        </div>

        {/* Value Section with fluid responsive typography */}
        <div className="mt-2.5 sm:mt-3 flex flex-col gap-1 min-w-0">
          <span
            className="text-lg sm:text-2xl lg:text-xl xl:text-2xl 2xl:text-3xl font-black text-slate-900 dark:text-white font-mono-num tracking-tight truncate leading-tight"
            title={value}
          >
            {value}
          </span>

          {badgeText && (
            <div className="mt-0.5">
              <span className="inline-block rounded-full bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 shrink-0">
                {badgeText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Meta Row */}
      <div className="mt-3.5 sm:mt-4 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800/90 pt-2.5 sm:pt-3 text-[11px] sm:text-xs min-w-0">
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
              <span className="text-slate-400 dark:text-slate-500 truncate text-[10px] sm:text-xs">
                vs 7d
              </span>
            </div>
          ) : subtitle ? (
            <span
              className="text-slate-500 dark:text-slate-400 font-medium truncate block text-[10px] sm:text-xs"
              title={subtitle}
            >
              {subtitle}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate block text-[10px] sm:text-xs">
              Live operational sync
            </span>
          )}
        </div>

        {action && (
          <button
            onClick={action.onClick}
            className="font-bold text-[#E723A2] dark:text-pink-400 hover:text-[#D61590] dark:hover:text-pink-300 hover:underline cursor-pointer whitespace-nowrap shrink-0 text-[10px] sm:text-xs flex items-center gap-1"
          >
            <span>{action.label}</span>
            <span>&rarr;</span>
          </button>
        )}
      </div>
    </div>
  );
};
