import React from 'react';
import type { Order } from '../../types/order';
import { useSeller } from '../../context/SellerContext';
import { formatPHP } from '../../utils/formatters';
import { FaPrint, FaXmark, FaTruckFast } from 'react-icons/fa6';

interface ShippingWaybillProps {
  order: Order;
  onClose: () => void;
}

export const ShippingWaybill: React.FC<ShippingWaybillProps> = ({ order, onClose }) => {
  const { storeSettings, seller } = useSeller();

  const handlePrint = () => {
    window.print();
  };

  const trackingNumber = order.trackingNumber || `AIS-EXP-${order.id.replace('ORD-', '')}-MNL`;
  const courierName = order.courier?.name || 'Aisley Express Priority';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-[#0B0F19]/80 backdrop-blur-xs">
      {/* Container */}
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Top Actions (Hidden on Print) */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <FaTruckFast className="text-[#E723A2]" />
            <span className="text-sm font-bold">A6 Standard Thermal Waybill Preview</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <FaPrint /> Print Shipping Label
            </button>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <FaXmark />
            </button>
          </div>
        </div>

        {/* The Printable A6 Document Area */}
        <div className="printable-area p-6 text-black bg-white select-text font-sans text-xs border-4 border-black m-4">
          {/* Header Bar */}
          <div className="flex items-start justify-between border-b-2 border-black pb-3">
            <div>
              <h1 className="text-2xl font-black tracking-wider uppercase font-sans">AISLEY</h1>
              <p className="text-[10px] font-bold tracking-widest uppercase">Logistics Network</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2 py-0.5 border-2 border-black text-xs font-black uppercase">
                {courierName}
              </span>
              <p className="text-[10px] font-mono-num font-bold mt-1">STANDARD DOMESTIC AIR</p>
            </div>
          </div>

          {/* Large Simulated Code-128 Barcode */}
          <div className="my-3 text-center py-2 border-b-2 border-black">
            {/* SVG Barcode Lines Simulation */}
            <svg className="w-full h-14 mx-auto" viewBox="0 0 300 50">
              {/* Repeating lines for crisp barcode aesthetic */}
              {[
                3, 2, 4, 1, 3, 2, 5, 2, 3, 1, 4, 2, 3, 1, 5, 2, 4, 1, 3, 2, 4, 1, 3, 2, 5, 2, 3, 1, 4, 2,
                3, 1, 5, 2, 4, 1, 3, 2, 4, 1, 3, 2, 5, 2, 3, 1, 4, 2, 3, 1, 5, 2, 4, 1, 3, 2, 4, 1, 3, 2
              ].map((w, i) => (
                <rect
                  key={i}
                  x={i * 5 + 2}
                  y="0"
                  width={w}
                  height="45"
                  fill="black"
                />
              ))}
            </svg>
            <p className="text-sm font-black font-mono-num tracking-widest mt-1">{trackingNumber}</p>
          </div>

          {/* Sender & Receiver Address Grid */}
          <div className="grid grid-cols-2 border-b-2 border-black text-[11px]">
            {/* Sender */}
            <div className="p-3 border-r-2 border-black space-y-1">
              <p className="font-bold text-[9px] uppercase tracking-wider text-slate-500">SENDER (ORIGIN MERCHANT)</p>
              <p className="font-black text-xs">{storeSettings.storeName}</p>
              <p className="text-[10px]">Attn: {seller?.firstName} {seller?.lastName}</p>
              <p className="text-[10px] leading-tight">
                {seller?.address.houseNumber} {seller?.address.street}, {seller?.address.barangay}
              </p>
              <p className="text-[10px] font-bold">
                {seller?.address.city}, {seller?.address.province} {seller?.address.postalCode}
              </p>
              <p className="font-mono-num text-[10px]">Tel: {seller?.contactNo}</p>
            </div>

            {/* Recipient */}
            <div className="p-3 space-y-1 bg-slate-50">
              <p className="font-bold text-[9px] uppercase tracking-wider text-slate-500">RECIPIENT (DESTINATION)</p>
              <p className="font-black text-xs">{order.shippingAddress.fullName}</p>
              <p className="text-[10px] leading-tight">
                {order.shippingAddress.street}, {order.shippingAddress.barangay}
              </p>
              <p className="text-[10px] font-bold">
                {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}
              </p>
              <p className="font-mono-num text-[10px]">Tel: {order.shippingAddress.phone}</p>
            </div>
          </div>

          {/* Hub Routing & QR Code Block */}
          <div className="grid grid-cols-3 border-b-2 border-black p-3 items-center">
            <div className="col-span-2 space-y-1">
              <p className="text-[9px] font-bold uppercase text-slate-500">SORTING HUB ROUTING CODE</p>
              <p className="text-xl font-black font-mono-num">
                MNL-HUB-{(order.shippingAddress.postalCode || '1200').slice(0, 3)} / A-04
              </p>
              <p className="text-[10px] font-medium">Order Ref: #{order.id} • Method: {order.paymentMethod}</p>
            </div>

            {/* QR Code Graphic Simulation */}
            <div className="flex flex-col items-center justify-center">
              <div className="size-16 border-2 border-black p-1 grid grid-cols-4 gap-0.5 bg-white">
                <div className="bg-black col-span-2 row-span-2" />
                <div className="bg-black" />
                <div className="bg-white" />
                <div className="bg-white" />
                <div className="bg-black" />
                <div className="bg-black" />
                <div className="bg-white" />
                <div className="bg-black" />
                <div className="bg-black" />
              </div>
              <span className="text-[8px] font-mono-num font-bold mt-0.5">SCAN-POD</span>
            </div>
          </div>

          {/* Itemized SKU Table for Fulfillment Handover */}
          <div className="p-3 border-b-2 border-black">
            <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">DECLARED PACKAGE CONTENT(S)</p>
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="border-b border-black font-bold">
                  <th className="py-0.5">Item / SKU</th>
                  <th className="py-0.5">Variant</th>
                  <th className="py-0.5 text-center">Qty</th>
                  <th className="py-0.5 text-right">Declared (₱)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1 font-medium">{item.productTitle}</td>
                    <td className="py-1 text-slate-600">{item.variantName || 'Standard'}</td>
                    <td className="py-1 text-center font-bold font-mono-num">{item.quantity}</td>
                    <td className="py-1 text-right font-bold font-mono-num">{formatPHP(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Security / Declaration */}
          <div className="p-3 text-[9px] text-slate-700 flex justify-between items-center">
            <div>
              <p className="font-bold">Fragile Luxury Consignment • Keep Dry</p>
              <p>Printed on: {new Date().toLocaleString()} PHT</p>
            </div>
            <div className="text-right font-mono-num font-bold">
              PAGE 1 OF 1 • A6 THERMAL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
