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
  iconBgColor = 'bg-[#FDF2F9]',
  iconTextColor = 'text-[#E723A2]',
  badgeText,
  action,
}) => {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-slate-900 font-mono-num">{value}</span>
            {badgeText && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                {badgeText}
              </span>
            )}
          </div>
        </div>

        <div className={`grid size-11 place-items-center rounded-xl ${iconBgColor} ${iconTextColor} shrink-0`}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        {change ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-0.5 font-bold ${
                isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isPositive ? <FaArrowTrendUp /> : <FaArrowTrendDown />}
              {change}
            </span>
            <span className="text-slate-400">vs last 7 days</span>
          </div>
        ) : subtitle ? (
          <span className="text-slate-500 font-medium">{subtitle}</span>
        ) : (
          <span className="text-slate-400">Live operational sync</span>
        )}

        {action && (
          <button
            onClick={action.onClick}
            className="font-bold text-[#E723A2] hover:text-[#D61590] hover:underline"
          >
            {action.label} &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
