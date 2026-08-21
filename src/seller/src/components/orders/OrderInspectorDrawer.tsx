import React from 'react';
import type { Order, OrderStatus } from '../../types/order';
import { Drawer } from '../common/Drawer';
import { Badge } from '../common/Badge';
import { formatPHP, formatDateTime } from '../../utils/formatters';
import {
  FaBoxOpen,
  FaLocationDot,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaReceipt,
  FaPrint,
  FaTruckFast,
  FaCheck,
  FaBan,
  FaTag,
} from 'react-icons/fa6';

interface OrderInspectorDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onOpenWaybill: (order: Order) => void;
  onOpenCourierModal: (order: Order) => void;
}

export const OrderInspectorDrawer: React.FC<OrderInspectorDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onOpenWaybill,
  onOpenCourierModal,
}) => {
  if (!order) return null;

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return <Badge variant="primary" dot>New Order</Badge>;
      case 'to_pack':
        return <Badge variant="warning" dot>To Pack</Badge>;
      case 'courier_handover':
        return <Badge variant="info" dot>Awaiting Courier Pickup</Badge>;
      case 'in_transit':
        return <Badge variant="info">In Transit</Badge>;
      case 'delivered':
        return <Badge variant="success" dot>Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Order #${order.id}`}
      subtitle={`Placed on ${formatDateTime(order.createdAt)} • ${order.orderNumber}`}
      width="xl"
    >
      <div className="space-y-6 text-xs">
        {/* Status & Quick ERP Actions Bar */}
        <div className="p-4 rounded-2xl bg-[#0B0F19] text-white flex flex-wrap items-center justify-between gap-3 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">ERP Lifecycle:</span>
            {getStatusBadge(order.status)}
          </div>

          <div className="flex items-center gap-2">
            {order.status === 'new' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'to_pack')}
                className="px-3.5 py-1.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white font-bold uppercase tracking-wider transition text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FaBoxOpen /> Accept & Pack
              </button>
            )}

            {order.status === 'to_pack' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenWaybill(order)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition text-[11px] flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <FaPrint /> Printable Waybill
                </button>
                <button
                  onClick={() => onOpenCourierModal(order)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider transition text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FaTruckFast /> Schedule Courier
                </button>
              </div>
            )}

            {order.status === 'courier_handover' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'in_transit')}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold uppercase tracking-wider transition text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FaCheck /> Handover Completed
              </button>
            )}

            {order.status === 'in_transit' && (
              <button
                onClick={() => onUpdateStatus(order.id, 'delivered')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider transition text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FaCheck /> Confirm Delivery (POD)
              </button>
            )}
          </div>
        </div>

        {/* Courier Dispatch Information (If scheduled) */}
        {order.courier && (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-900 flex items-center gap-1.5">
                <FaTruckFast className="text-sky-600" /> Logistics Partner: {order.courier.name}
              </span>
              <span className="font-mono-num font-bold text-sky-800 text-[11px]">
                Tracking: {order.trackingNumber || 'PENDING'}
              </span>
            </div>
            <p className="text-sky-800 text-[11px]">
              Scheduled Pickup: <strong>{order.courier.scheduledPickupDate}</strong> ({order.courier.scheduledTimeSlot})
            </p>
            {order.courier.courierNotes && (
              <p className="text-slate-600 text-[11px] italic">Notes: {order.courier.courierNotes}</p>
            )}
          </div>
        )}

        {/* Itemized Purchases Table */}
        <div className="rounded-2xl border border-slate-300 p-4 space-y-3 bg-white shadow-sm">
          <h3 className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <FaBoxOpen className="text-[#E723A2]" /> Itemized Customer Order
          </h3>

          <div className="divide-y divide-slate-200">
            {order.items.map((item) => (
              <div key={item.id} className="py-3 flex items-center gap-3">
                <img
                  src={item.imageUrl}
                  alt={item.productTitle}
                  className="size-14 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{item.productTitle}</p>
                  <p className="text-slate-500 text-[11px]">{item.variantName || 'Standard Variant'}</p>
                  <p className="text-slate-400 font-mono-num text-[10px]">SKU: {item.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-slate-900 font-mono-num">{formatPHP(item.unitPrice)}</p>
                  <p className="text-slate-500 font-mono-num text-[11px]">Qty: {item.quantity}</p>
                  <p className="text-slate-400 font-mono-num text-[10px]">
                    COGS: {formatPHP(item.costOfGoods * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {order.customerNotes && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px]">
              <strong className="block mb-0.5">Customer Delivery Instructions:</strong>
              &ldquo;{order.customerNotes}&rdquo;
            </div>
          )}
        </div>

        {/* Buyer & Shipping Address Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-300 space-y-1.5">
            <h4 className="font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FaUser className="text-[#E723A2]" /> Buyer Contact
            </h4>
            <p className="font-bold text-slate-900">{order.customer.name}</p>
            <p className="text-slate-500 flex items-center gap-1">
              <FaEnvelope className="size-3 text-slate-400" /> {order.customer.email}
            </p>
            <p className="text-slate-500 flex items-center gap-1 font-mono-num">
              <FaPhone className="size-3 text-slate-400" /> {order.customer.phone}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-300 space-y-1.5">
            <h4 className="font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FaLocationDot className="text-[#0284C7]" /> Delivery Address
            </h4>
            <p className="font-medium text-slate-800 leading-tight">
              {order.shippingAddress.street}, {order.shippingAddress.barangay}
            </p>
            <p className="font-bold text-slate-900">
              {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}
            </p>
            <p className="text-slate-500 font-mono-num text-[11px]">Tel: {order.shippingAddress.phone}</p>
          </div>
        </div>

        {/* ERP Financial Net Payout Breakdown */}
        <div className="rounded-2xl border-2 border-slate-900 bg-white p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <FaReceipt className="text-[#E723A2]" /> ERP Net Settlement Statement
            </h4>
            <span className="font-mono-num font-bold text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
              Payment: {order.paymentMethod} ({order.paymentStatus.toUpperCase()})
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Gross Subtotal</span>
              <span className="font-bold font-mono-num text-slate-900">{formatPHP(order.subtotal)}</span>
            </div>

            {order.voucherDiscount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span className="flex items-center gap-1">
                  <FaTag /> Voucher Subsidy ({order.voucherCode})
                </span>
                <span className="font-bold font-mono-num">-{formatPHP(order.voucherDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-500">
              <span>Platform Service Fee (3.5%)</span>
              <span className="font-bold font-mono-num text-rose-600">-{formatPHP(order.platformFee)}</span>
            </div>

            {order.shippingSubsidy > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Shipping Subsidy</span>
                <span className="font-bold font-mono-num text-rose-600">-{formatPHP(order.shippingSubsidy)}</span>
              </div>
            )}

            <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-baseline">
              <div>
                <span className="font-black text-sm text-slate-900 uppercase">Net Seller Disbursed Payout</span>
                <p className="text-[10px] text-slate-500">Credited to GCash / Bank account upon delivery</p>
              </div>
              <span className="text-xl font-black text-emerald-700 font-mono-num">
                {formatPHP(order.netSellerPayout)}
              </span>
            </div>
          </div>
        </div>

        {/* Cancellation button */}
        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <div className="pt-2">
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to cancel Order #${order.id}?`)) {
                  onUpdateStatus(order.id, 'cancelled');
                }
              }}
              className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <FaBan /> Cancel Order & Issue Refund
            </button>
          </div>
        )}
      </div>
    </Drawer>
  );
};
