import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import { MetricCard } from '../common/MetricCard';
import { Badge } from '../common/Badge';
import { FinancialStatementModal } from './FinancialStatementModal';
import { formatPHP, formatDate } from '../../utils/formatters';
import { exportFinancialRecordsToCSV } from '../../utils/exportCsv';
import {
  FaCalendarDays,
  FaFileCsv,
  FaPrint,
  FaPesoSign,
  FaPercent,
  FaBoxesStacked,
  FaCircleCheck,
} from 'react-icons/fa6';

export const ReportsView: React.FC = () => {
  const { financialSummary, financialRecords } = useSeller();

  // Date Range Filter
  const [datePreset, setDatePreset] = useState<'7d' | '30d' | 'month' | 'ytd' | 'custom'>('7d');
  const [fromDate, setFromDate] = useState('2026-08-15');
  const [toDate, setToDate] = useState('2026-08-21');
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  const handlePresetChange = (preset: '7d' | '30d' | 'month' | 'ytd') => {
    setDatePreset(preset);
    const end = new Date();
    const start = new Date();

    if (preset === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (preset === '30d') {
      start.setDate(end.getDate() - 30);
    } else if (preset === 'month') {
      start.setDate(1);
    } else if (preset === 'ytd') {
      start.setMonth(0, 1);
    }

    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
  };

  const netMarginPercent = (
    (financialSummary.netProfit / (financialSummary.grossSales || 1)) *
    100
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Financial Intelligence & Profit Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time merchant settlement calculations, COGS itemization, and platform fee deductions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportFinancialRecordsToCSV(financialRecords)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FaFileCsv /> Export CSV Ledger
          </button>
          <button
            onClick={() => setIsStatementOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FaPrint /> Printable Statement
          </button>
        </div>
      </div>

      {/* Date Range Picker Bar */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mr-1">
            <FaCalendarDays className="text-[#E723A2]" /> Date Filter:
          </span>

          {[
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'ytd', label: 'Year to Date' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                datePreset === p.id
                  ? 'bg-slate-900 dark:bg-[#E723A2] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setDatePreset('custom');
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
          />
          <span className="text-slate-400 dark:text-slate-500">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setDatePreset('custom');
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Revenue"
          value={formatPHP(financialSummary.grossSales)}
          subtitle={`${financialSummary.orderCount} active customer purchases`}
          icon={<FaPesoSign className="size-4" />}
          iconBgColor="bg-[#FDF2F9] dark:bg-pink-950/70 border border-pink-200 dark:border-pink-800/80"
          iconTextColor="text-[#E723A2] dark:text-pink-300"
        />

        <MetricCard
          title="Cost of Goods (COGS)"
          value={formatPHP(financialSummary.costOfGoods)}
          subtitle="Direct product material & labor cost"
          icon={<FaBoxesStacked className="size-4" />}
          iconBgColor="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          iconTextColor="text-slate-700 dark:text-slate-300"
        />

        <MetricCard
          title="Platform Fees & Subsidy"
          value={formatPHP(financialSummary.platformFees + financialSummary.shippingSubsidies)}
          subtitle="3.5% Aisley fee + shipping subsidies"
          icon={<FaPercent className="size-4" />}
          iconBgColor="bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80"
          iconTextColor="text-rose-600 dark:text-rose-300"
        />

        <MetricCard
          title="Net Disbursed Profit"
          value={formatPHP(financialSummary.netProfit)}
          badgeText={`${netMarginPercent}% Net Margin`}
          icon={<FaCircleCheck className="size-4" />}
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80"
          iconTextColor="text-[#10B981] dark:text-emerald-300"
        />
      </div>

      {/* Profit Waterfall Calculation Card */}
      <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-[#0F172A] p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Aisley Net Profit Waterfall Calculation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clear itemization showing exactly how your payout is derived from gross receipts.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 text-xs font-bold font-mono-num">
            Escrow Protected Payout
          </span>
        </div>

        {/* Step-by-Step Waterfall Formula Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch text-xs">
          {/* Gross Sales */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">1. Gross Revenue</span>
            <p className="text-lg font-black font-mono-num text-slate-900 dark:text-white my-1">
              {formatPHP(financialSummary.grossSales)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Total retail customer receipts</p>
          </div>

          {/* Minus COGS */}
          <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/70 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">2. Less: COGS</span>
            <p className="text-lg font-black font-mono-num text-rose-700 dark:text-rose-300 my-1">
              -{formatPHP(financialSummary.costOfGoods)}
            </p>
            <p className="text-[10px] text-rose-600 dark:text-rose-400">Raw materials & artisan labor</p>
          </div>

          {/* Minus Platform Fee */}
          <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/70 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">3. Less: Platform Fee (3.5%)</span>
            <p className="text-lg font-black font-mono-num text-rose-700 dark:text-rose-300 my-1">
              -{formatPHP(financialSummary.platformFees)}
            </p>
            <p className="text-[10px] text-rose-600 dark:text-rose-400">Sanctum & payment gateway</p>
          </div>

          {/* Minus Shipping Subsidy */}
          <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/70 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">4. Less: Shipping Subsidy</span>
            <p className="text-lg font-black font-mono-num text-rose-700 dark:text-rose-300 my-1">
              -{formatPHP(financialSummary.shippingSubsidies)}
            </p>
            <p className="text-[10px] text-rose-600 dark:text-rose-400">Seller promo shipping absorbs</p>
          </div>

          {/* Final Net Profit */}
          <div className="p-4 rounded-2xl bg-[#0F172A] dark:bg-[#070A10] text-white border border-slate-700 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] flex items-center gap-1">
              <FaCircleCheck /> 5. Net Seller Profit
            </span>
            <p className="text-xl font-black font-mono-num text-white my-1">
              {formatPHP(financialSummary.netProfit)}
            </p>
            <p className="text-[10px] text-slate-400">{netMarginPercent}% net margin retained</p>
          </div>
        </div>
      </div>

      {/* Financial Ledger Records Table */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Order Payout Settlement Ledger</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Live reconciliation of orders disbursed to merchant bank account.</p>
          </div>
          <span className="text-xs font-mono-num text-slate-400 dark:text-slate-500">
            {financialRecords.length} Transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead className="bg-[#F8FAFC] dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Transaction ID & Date</th>
                <th className="py-3.5 px-4">Order Ref</th>
                <th className="py-3.5 px-4">Gross Revenue</th>
                <th className="py-3.5 px-4">COGS & Fees</th>
                <th className="py-3.5 px-4">Net Payout</th>
                <th className="py-3.5 px-4">Settlement Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
              {financialRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 dark:text-white font-mono-num">{rec.id}</span>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">{formatDate(rec.date)}</p>
                  </td>
                  <td className="py-3.5 px-4 font-mono-num font-bold text-slate-800 dark:text-slate-200">
                    {rec.orderId}
                  </td>
                  <td className="py-3.5 px-4 font-mono-num font-bold text-slate-900 dark:text-white">
                    {formatPHP(rec.grossSales)}
                  </td>
                  <td className="py-3.5 px-4 font-mono-num text-rose-700 dark:text-rose-400">
                    -{formatPHP(rec.cogs + rec.platformFee + rec.shippingSubsidy)}
                  </td>
                  <td className="py-3.5 px-4 font-mono-num font-black text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatPHP(rec.netPayout)}
                  </td>
                  <td className="py-3.5 px-4">
                    {rec.status === 'settled' ? (
                      <Badge variant="success" dot>Disbursed to Bank</Badge>
                    ) : (
                      <Badge variant="warning" dot>Pending Clearing</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Statement Modal */}
      <FinancialStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        summary={financialSummary}
        records={financialRecords}
        dateRange={{ from: fromDate, to: toDate }}
      />
    </div>
  );
};
