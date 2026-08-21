import React, { useState } from 'react';
import type { Voucher } from '../../types/product';
import { useSeller } from '../../context/SellerContext';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { formatPHP, formatDate } from '../../utils/formatters';
import {
  FaPlus,
  FaTrash,
  FaTicket,
  FaCheck,
} from 'react-icons/fa6';

export const VouchersTab: React.FC = () => {
  const { vouchers, addVoucher, deleteVoucher } = useSeller();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(15);
  const [minSpend, setMinSpend] = useState<number>(5000);
  const [maxDiscount, setMaxDiscount] = useState<number>(2000);
  const [usageLimit, setUsageLimit] = useState<number>(100);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    addVoucher({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minSpend: Number(minSpend),
      maxDiscount: discountType === 'percentage' ? Number(maxDiscount) : undefined,
      usageLimit: Number(usageLimit),
      startDate,
      endDate,
      status: 'active',
    });

    setCode('');
    setIsModalOpen(false);
  };

  const getStatusBadge = (status: Voucher['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" dot>Active Promo</Badge>;
      case 'scheduled':
        return <Badge variant="info">Scheduled</Badge>;
      case 'expired':
        return <Badge variant="neutral">Expired</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Create Promo Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Vouchers & Promotional Engine
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drive boutique sales volume with targeted percentage and cash rebate incentives.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <FaPlus /> Create Voucher Code
        </button>
      </div>

      {/* Voucher Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vouchers.map((v) => (
          <div
            key={v.id}
            className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-700 transition"
          >
            {/* Top Row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-10 rounded-2xl flex items-center justify-center bg-[#FDF2F9] dark:bg-pink-950/70 text-[#E723A2] dark:text-pink-300 border border-[#F9CFEA] dark:border-pink-800/80 shrink-0">
                  <FaTicket className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-mono-num font-black text-base tracking-wider text-slate-900 dark:text-white uppercase truncate block">
                    {v.code}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {v.discountType === 'percentage' ? `${v.discountValue}% OFF` : `₱${v.discountValue} FLAT REBATE`}
                  </p>
                </div>
              </div>

              {getStatusBadge(v.status)}
            </div>

            {/* Voucher Details */}
            <div className="my-4 space-y-2 text-xs text-slate-600 dark:text-slate-300 border-y border-slate-200 dark:border-slate-800 py-3">
              <div className="flex justify-between">
                <span>Minimum Order Spend:</span>
                <span className="font-bold font-mono-num text-slate-900 dark:text-white">{formatPHP(v.minSpend)}</span>
              </div>
              {v.maxDiscount && (
                <div className="flex justify-between">
                  <span>Max Discount Cap:</span>
                  <span className="font-bold font-mono-num text-slate-900 dark:text-white">{formatPHP(v.maxDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Redemptions Used:</span>
                <span className="font-bold font-mono-num text-slate-900 dark:text-white">
                  {v.usageCount} / {v.usageLimit} ({((v.usageCount / v.usageLimit) * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span>Valid:</span>
                <span className="font-mono-num">{formatDate(v.startDate)} – {formatDate(v.endDate)}</span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Merchant Funded</span>
              <button
                onClick={() => deleteVoucher(v.id)}
                className="size-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800/60"
                title="Delete Voucher"
              >
                <FaTrash className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Voucher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Aisley Discount Code"
        subtitle="Specify redemption conditions, spend thresholds, and promotional timeline."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateVoucher} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Voucher Code <span className="text-[#E723A2]">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. AISLEYLUXE20"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono-num font-black tracking-wider text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none uppercase"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              >
                <option value="percentage">Percentage Discount (%)</option>
                <option value="fixed">Fixed Cash Discount (₱)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Discount Value <span className="text-[#E723A2]">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                placeholder={discountType === 'percentage' ? '15' : '1000'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono-num font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Minimum Order Spend (₱)
              </label>
              <input
                type="number"
                required
                min={0}
                value={minSpend}
                onChange={(e) => setMinSpend(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-num font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Max Discount Cap (₱) {discountType === 'fixed' && '(N/A for Fixed)'}
              </label>
              <input
                type="number"
                disabled={discountType === 'fixed'}
                min={0}
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-num font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Total Global Usage Limit
            </label>
            <input
              type="number"
              required
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-num font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                End Expiry Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <FaCheck /> Launch Promotion
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
