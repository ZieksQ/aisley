import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import type { Order, OrderStatus } from '../../types/order';
import { Badge } from '../common/Badge';
import { OrderInspectorDrawer } from './OrderInspectorDrawer';
import { CourierHandoverModal } from './CourierHandoverModal';
import { ShippingWaybill } from './ShippingWaybill';
import { formatPHP, formatDate } from '../../utils/formatters';
import { exportOrdersToCSV } from '../../utils/exportCsv';
import {
  FaMagnifyingGlass,
  FaFileCsv,
  FaPrint,
  FaTruckFast,
  FaBoxOpen,
  FaEye,
  FaCheck,
} from 'react-icons/fa6';

export const OrdersView: React.FC = () => {
  const {
    orders,
    updateOrderStatus,
    activeWaybillOrder,
    setActiveWaybillOrder,
  } = useSeller();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [courierSchedulingOrder, setCourierSchedulingOrder] = useState<Order | null>(null);

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.trackingNumber && order.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      order.items.some((i) => i.productTitle.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return <Badge variant="primary" dot>New Order</Badge>;
      case 'to_pack':
        return <Badge variant="warning" dot>To Pack</Badge>;
      case 'courier_handover':
        return <Badge variant="info" dot>Awaiting Pickup</Badge>;
      case 'in_transit':
        return <Badge variant="info">In Transit</Badge>;
      case 'delivered':
        return <Badge variant="success" dot>Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
    }
  };

  const statusCounts = {
    all: orders.length,
    new: orders.filter((o) => o.status === 'new').length,
    to_pack: orders.filter((o) => o.status === 'to_pack').length,
    courier_handover: orders.filter((o) => o.status === 'courier_handover').length,
    in_transit: orders.filter((o) => o.status === 'in_transit').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Order Fulfillment & Logistics ERP
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Process boutique consignments, generate A6 waybills, and coordinate carrier pickups.
          </p>
        </div>

        <button
          onClick={() => exportOrdersToCSV(filteredOrders)}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <FaFileCsv /> Export CSV Ledger
        </button>
      </div>

      {/* Status Pipeline Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'All Orders', count: statusCounts.all },
          { id: 'new', label: 'New Orders', count: statusCounts.new },
          { id: 'to_pack', label: 'To Pack', count: statusCounts.to_pack },
          { id: 'courier_handover', label: 'Courier Handover', count: statusCounts.courier_handover },
          { id: 'in_transit', label: 'In Transit', count: statusCounts.in_transit },
          { id: 'delivered', label: 'Delivered', count: statusCounts.delivered },
          { id: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id as OrderStatus | 'all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-2 border ${
              statusFilter === tab.id
                ? 'bg-[#0F172A] dark:bg-[#E723A2] text-white border-[#0F172A] dark:border-[#E723A2] shadow-xs'
                : 'bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono-num font-bold ${
                statusFilter === tab.id
                  ? 'bg-[#E723A2] dark:bg-black text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <FaMagnifyingGlass className="size-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, buyer name, item or tracking code..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Showing <strong>{filteredOrders.length}</strong> of {orders.length} orders
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Order ID & Date</th>
                <th className="py-3.5 px-4">Client & Destination</th>
                <th className="py-3.5 px-4">Purchased Items</th>
                <th className="py-3.5 px-4">Net Settlement</th>
                <th className="py-3.5 px-4">Status & Courier</th>
                <th className="py-3.5 px-4 text-right">Fulfillment Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <FaBoxOpen className="size-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-400">No orders found</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Try adjusting your status filter or search term</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setInspectingOrder(order)}
                        className="font-bold text-slate-900 dark:text-white hover:text-[#E723A2] dark:hover:text-[#E723A2] font-mono-num block cursor-pointer"
                      >
                        {order.id}
                      </button>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">{formatDate(order.createdAt)}</p>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono-num">
                        {order.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 dark:text-white">{order.customer.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {order.shippingAddress.city}, {order.shippingAddress.province}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-num">{order.customer.phone}</p>
                    </td>

                    <td className="py-3.5 px-4 max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <img
                          src={order.items[0]?.imageUrl}
                          alt={order.items[0]?.productTitle}
                          className="size-9 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                        />
                        <div className="truncate">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{order.items[0]?.productTitle}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {order.items.length > 1 ? `+${order.items.length - 1} other item(s)` : `${order.items[0]?.quantity} unit`}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 font-mono-num text-sm">
                        {formatPHP(order.netSellerPayout)}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Gross: {formatPHP(order.subtotal)}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      {getStatusBadge(order.status)}
                      {order.trackingNumber && (
                        <p className="text-[10px] font-mono-num text-slate-500 dark:text-slate-400 block truncate">
                          {order.trackingNumber}
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Detailed Inspector Drawer */}
                        <button
                          onClick={() => setInspectingOrder(order)}
                          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Inspect Order"
                        >
                          <FaEye className="size-3" />
                        </button>

                        {order.status === 'new' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'to_pack')}
                            className="px-3 py-1.5 rounded-lg bg-[#E723A2] hover:bg-[#D61590] text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                          >
                            Pack Order
                          </button>
                        )}

                        {order.status === 'to_pack' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setActiveWaybillOrder(order)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Print Waybill"
                            >
                              <FaPrint /> Waybill
                            </button>
                            <button
                              onClick={() => setCourierSchedulingOrder(order)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <FaTruckFast /> Courier
                            </button>
                          </div>
                        )}

                        {order.status === 'courier_handover' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setActiveWaybillOrder(order)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] cursor-pointer"
                              title="Reprint Waybill"
                            >
                              <FaPrint />
                            </button>
                            <button
                              onClick={() => updateOrderStatus(order.id, 'in_transit')}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                            >
                              Handed to Driver
                            </button>
                          </div>
                        )}

                        {order.status === 'in_transit' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <FaCheck /> Mark Delivered
                          </button>
                        )}

                        {order.status === 'delivered' && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Disbursed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Inspector Drawer */}
      <OrderInspectorDrawer
        order={inspectingOrder}
        isOpen={inspectingOrder !== null}
        onClose={() => setInspectingOrder(null)}
        onUpdateStatus={(id, status) => {
          updateOrderStatus(id, status);
          if (inspectingOrder && inspectingOrder.id === id) {
            setInspectingOrder((prev) => (prev ? { ...prev, status } : null));
          }
        }}
        onOpenWaybill={(o) => setActiveWaybillOrder(o)}
        onOpenCourierModal={(o) => setCourierSchedulingOrder(o)}
      />

      {/* Courier Handover Modal */}
      <CourierHandoverModal
        order={courierSchedulingOrder}
        isOpen={courierSchedulingOrder !== null}
        onClose={() => setCourierSchedulingOrder(null)}
        onSchedule={(id, details) => {
          updateOrderStatus(id, 'courier_handover', details);
        }}
      />

      {/* Printable Shipping Waybill Modal */}
      {activeWaybillOrder && (
        <ShippingWaybill
          order={activeWaybillOrder}
          onClose={() => setActiveWaybillOrder(null)}
        />
      )}
    </div>
  );
};
