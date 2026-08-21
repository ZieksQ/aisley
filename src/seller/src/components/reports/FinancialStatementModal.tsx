import React from 'react';
import type { FinancialSummary, FinancialRecord } from '../../types/finance';
import { useSeller } from '../../context/SellerContext';
import { formatPHP, formatDate } from '../../utils/formatters';
import { FaPrint, FaXmark, FaFileLines } from 'react-icons/fa6';

interface FinancialStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: FinancialSummary;
  records: FinancialRecord[];
  dateRange: { from: string; to: string };
}

export const FinancialStatementModal: React.FC<FinancialStatementModalProps> = ({
  isOpen,
  onClose,
  summary,
  records,
  dateRange,
}) => {
  const { storeSettings } = useSeller();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-[#0B0F19]/80 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Top Actions (Hidden on Print) */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <FaFileLines className="text-[#E723A2]" />
            <span className="text-sm font-bold">Atelier Financial Statement Generator</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <FaPrint /> Print Official Statement
            </button>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <FaXmark />
            </button>
          </div>
        </div>

        {/* The Printable A4 Statement Area */}
        <div className="printable-area p-8 text-black bg-white select-text font-sans text-xs border border-slate-300 m-4 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-wider uppercase font-sans">AISLEY</h1>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-600">
                Atelier Settlement & Merchant Statement
              </p>
            </div>

            <div className="text-right space-y-0.5">
              <p className="text-xs font-black uppercase">{storeSettings.storeName}</p>
              <p className="text-[10px] text-slate-500 font-mono-num">
                TIN: {storeSettings.taxInfo.tinNumber} • Entity: {storeSettings.taxInfo.registeredEntityName}
              </p>
              <p className="text-[10px] text-slate-500">
                Statement Period: {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
              </p>
            </div>
          </div>

          {/* Statement Executive Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-black bg-slate-50">
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Gross Sales Revenue</p>
              <p className="text-base font-black font-mono-num mt-0.5">{formatPHP(summary.grossSales)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Cost of Goods (COGS)</p>
              <p className="text-base font-black font-mono-num mt-0.5">{formatPHP(summary.costOfGoods)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Platform Fees (3.5%)</p>
              <p className="text-base font-black font-mono-num text-rose-700 mt-0.5">
                -{formatPHP(summary.platformFees)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500">Net Seller Disbursed</p>
              <p className="text-base font-black font-mono-num text-emerald-800 mt-0.5">
                {formatPHP(summary.netProfit)}
              </p>
            </div>
          </div>

          {/* Itemized Order Settlement Ledger */}
          <div className="space-y-2">
            <h3 className="font-black uppercase text-xs tracking-wider border-b border-black pb-1">
              Order Settlement Ledger
            </h3>

            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-300 font-bold uppercase text-[9px] text-slate-600">
                  <th className="py-1">Order Ref</th>
                  <th className="py-1">Date</th>
                  <th className="py-1 text-right">Gross Sales</th>
                  <th className="py-1 text-right">COGS</th>
                  <th className="py-1 text-right">Aisley Fee (3.5%)</th>
                  <th className="py-1 text-right">Shipping Subsidy</th>
                  <th className="py-1 text-right">Net Payout</th>
                  <th className="py-1 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono-num">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1 font-bold">{r.orderId}</td>
                    <td className="py-1 text-slate-600">{formatDate(r.date)}</td>
                    <td className="py-1 text-right">{formatPHP(r.grossSales)}</td>
                    <td className="py-1 text-right">{formatPHP(r.cogs)}</td>
                    <td className="py-1 text-right text-rose-700">-{formatPHP(r.platformFee)}</td>
                    <td className="py-1 text-right text-rose-700">
                      {r.shippingSubsidy > 0 ? `-${formatPHP(r.shippingSubsidy)}` : '₱0.00'}
                    </td>
                    <td className="py-1 text-right font-black text-emerald-800">{formatPHP(r.netPayout)}</td>
                    <td className="py-1 text-center font-sans uppercase text-[9px] font-bold">
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Disbursement Banking Account Reference */}
          <div className="p-4 border-2 border-black space-y-1">
            <h4 className="font-black uppercase text-[10px]">Merchant Payout Account Reference</h4>
            <p className="text-[11px]">
              Disbursement Channel: <strong>{storeSettings.payoutBank.provider}</strong> ({storeSettings.payoutBank.autoDisbursementSchedule.toUpperCase()} SCHEDULE)
            </p>
            <p className="text-[11px]">
              Account Name: <strong>{storeSettings.payoutBank.accountName}</strong> • No: <span className="font-mono-num font-bold">{storeSettings.payoutBank.accountNumber}</span>
            </p>
          </div>

          {/* Legal & Compliance Footer */}
          <div className="flex items-center justify-between border-t border-black pt-4 text-[9px] text-slate-500">
            <p>Certified Electronic Statement • Generated by Aisley Merchant Operations</p>
            <p className="font-mono-num">{new Date().toLocaleString()} PHT</p>
          </div>
        </div>
      </div>
    </div>
  );
};
