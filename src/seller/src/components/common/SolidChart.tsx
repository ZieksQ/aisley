import React, { useState } from 'react';
import { formatPHP } from '../../utils/formatters';

interface BarChartData {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface SolidBarChartProps {
  title: string;
  subtitle?: string;
  data: BarChartData[];
  height?: number;
  valuePrefix?: string;
}

export const SolidBarChart: React.FC<SolidBarChartProps> = ({
  title,
  subtitle,
  data,
  height = 200,
  valuePrefix = '₱',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <span className="text-[11px] font-bold text-slate-400 font-mono-num">Solid Metrics</span>
      </div>

      <div className="relative pt-6" style={{ height: `${height}px` }}>
        {/* Horizontal grid guide lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="border-b border-dashed border-slate-200 w-full" />
          <div className="border-b border-dashed border-slate-200 w-full" />
          <div className="border-b border-dashed border-slate-200 w-full" />
          <div className="border-b border-slate-200 w-full" />
        </div>

        {/* Bars Container */}
        <div className="relative h-full flex items-end justify-between gap-2 sm:gap-4 px-2">
          {data.map((item, index) => {
            const heightPercent = (item.value / maxValue) * 100;
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={item.label}
                className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-10 z-20 px-2.5 py-1 rounded-lg bg-[#0F172A] text-white text-[11px] font-bold font-mono-num shadow-lg whitespace-nowrap border border-slate-700">
                    {valuePrefix === '₱' ? formatPHP(item.value) : `${item.value} units`}
                  </div>
                )}

                {/* Solid Bar (Strictly Zero Gradient) */}
                <div
                  className={`w-full max-w-[42px] rounded-t-lg transition-all ${
                    isHovered ? 'bg-[#D61590]' : 'bg-[#E723A2]'
                  }`}
                  style={{ height: `${Math.max(heightPercent, 4)}%` }}
                />

                {/* X-axis Label */}
                <span className="text-[10px] font-bold text-slate-500 mt-2 font-mono-num truncate w-full text-center">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface CategoryShareProps {
  title: string;
  items: { label: string; percentage: number; color: string; amount: number }[];
}

export const CategoryShareBar: React.FC<CategoryShareProps> = ({ title, items }) => {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400 font-medium">Sales Share</span>
      </div>

      {/* Multi-segment Solid Bar */}
      <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100 border border-slate-200">
        {items.map((cat, idx) => (
          <div
            key={idx}
            className="h-full transition-all"
            style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
            title={`${cat.label}: ${cat.percentage}%`}
          />
        ))}
      </div>

      {/* Legend list */}
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        {items.map((cat, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-slate-600 font-medium truncate">{cat.label}</span>
            </div>
            <span className="font-bold text-slate-900 font-mono-num ml-2">{cat.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
