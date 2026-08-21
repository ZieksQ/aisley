import React from 'react';
import { useSeller } from '../../context/SellerContext';
import { MetricCard } from '../common/MetricCard';
import { SolidBarChart, CategoryShareBar } from '../common/SolidChart';
import { Badge } from '../common/Badge';
import { formatPHP, formatDate } from '../../utils/formatters';
import {
  FaPesoSign,
  FaBoxesStacked,
  FaStar,
  FaTriangleExclamation,
  FaComments,
  FaTruckFast,
  FaBoxOpen,
  FaArrowRight,
  FaCircleCheck,
  FaStore,
} from 'react-icons/fa6';

export const DashboardView: React.FC = () => {
  const {
    seller,
    orders,
    products,
    financialSummary,
    dailySales,
    chatThreads,
    reviews,
    setCurrentView,
    updateOrderStatus,
    setActiveWaybillOrder,
  } = useSeller();

  // Calculate urgent actions
  const toPackOrders = orders.filter((o) => o.status === 'new' || o.status === 'to_pack');
  const lowStockProducts = products.filter((p) => p.stock <= p.lowStockThreshold && p.status === 'active');
  const unreadMessagesCount = chatThreads.reduce((sum, t) => sum + t.unreadCount, 0);

  // Average rating
  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '5.0';

  // Category sales share
  const categoryData = [
    { label: 'Haute Couture Silk', percentage: 48, color: '#E723A2', amount: 38500 },
    { label: 'Artisanal Leather', percentage: 26, color: '#0F172A', amount: 21000 },
    { label: 'Botanical Fragrance', percentage: 16, color: '#0284C7', amount: 13000 },
    { label: 'Fine Jewelry', percentage: 10, color: '#10B981', amount: 8200 },
  ];

  const recentOrders = orders.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="primary" dot>New Order</Badge>;
      case 'to_pack':
        return <Badge variant="warning" dot>To Pack</Badge>;
      case 'courier_handover':
        return <Badge variant="info" dot>Courier Pickup</Badge>;
      case 'in_transit':
        return <Badge variant="info">In Transit</Badge>;
      case 'delivered':
        return <Badge variant="success" dot>Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#0B0F19] p-6 text-white border border-[#1E293B] relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-800 text-[11px] font-bold text-[#E723A2] uppercase tracking-wider">
            <FaStore /> Atelier Verified Merchant
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
            Welcome back, {seller?.firstName || 'Claire'}
          </h1>
          <p className="text-xs text-slate-400">
            {seller?.businessName || 'Maison Dela Tour Atelier'} • Metro Manila Regional Hub
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <button
            onClick={() => setCurrentView('inventory')}
            className="px-4 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <FaBoxOpen /> Manage Catalog
          </button>
          <button
            onClick={() => setCurrentView('orders')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider transition border border-slate-700 flex items-center gap-2 cursor-pointer"
          >
            <FaTruckFast /> Fulfillment Queue
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Revenue"
          value={formatPHP(financialSummary.grossSales)}
          change="+18.4%"
          isPositive={true}
          icon={<FaPesoSign className="size-5" />}
          iconBgColor="bg-[#FDF2F9]"
          iconTextColor="text-[#E723A2]"
          action={{
            label: 'View reports',
            onClick: () => setCurrentView('reports'),
          }}
        />

        <MetricCard
          title="Net Disbursed Profit"
          value={formatPHP(financialSummary.netProfit)}
          change="+14.2%"
          isPositive={true}
          icon={<FaCircleCheck className="size-5" />}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-[#10B981]"
          action={{
            label: 'COGS breakdown',
            onClick: () => setCurrentView('reports'),
          }}
        />

        <MetricCard
          title="Active Orders Volume"
          value={`${financialSummary.orderCount} Orders`}
          subtitle={`${toPackOrders.length} requiring pack/handover`}
          icon={<FaBoxesStacked className="size-5" />}
          iconBgColor="bg-sky-50"
          iconTextColor="text-[#0284C7]"
          action={{
            label: 'Open ERP',
            onClick: () => setCurrentView('orders'),
          }}
        />

        <MetricCard
          title="Atelier Merchant Rating"
          value={`${avgRating} / 5.0`}
          subtitle={`${reviews.length} verified client reviews`}
          icon={<FaStar className="size-5" />}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          action={{
            label: 'Read feedback',
            onClick: () => setCurrentView('reviews'),
          }}
        />
      </div>

      {/* Urgent Operational Action Items Alert Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setCurrentView('orders')}
          className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs hover:border-amber-400 transition cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center shrink-0">
              <FaBoxOpen className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {toPackOrders.length} Orders Awaiting Packing
              </p>
              <p className="text-[11px] text-slate-500">Generate A6 Waybills & Pack</p>
            </div>
          </div>
          <FaArrowRight className="size-3.5 text-amber-600" />
        </div>

        <div
          onClick={() => setCurrentView('inventory')}
          className="p-4 rounded-2xl bg-white border border-rose-200 shadow-xs hover:border-rose-400 transition cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center shrink-0">
              <FaTriangleExclamation className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {lowStockProducts.length} Items with Low Inventory
              </p>
              <p className="text-[11px] text-slate-500">Restock to prevent out-of-stock</p>
            </div>
          </div>
          <FaArrowRight className="size-3.5 text-rose-600" />
        </div>

        <div
          onClick={() => setCurrentView('chat')}
          className="p-4 rounded-2xl bg-white border border-sky-200 shadow-xs hover:border-sky-400 transition cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-sky-50 text-[#0284C7] grid place-items-center shrink-0">
              <FaComments className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {unreadMessagesCount > 0 ? `${unreadMessagesCount} Unread Client Inquiries` : 'Client Concierge Live'}
              </p>
              <p className="text-[11px] text-slate-500">Instant canned replies ready</p>
            </div>
          </div>
          <FaArrowRight className="size-3.5 text-[#0284C7]" />
        </div>
      </div>

      {/* Solid Charts & Category Share Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <SolidBarChart
            title="7-Day Daily Sales Velocity (Gross PHP)"
            subtitle="Solid revenue per operational cut-off period"
            data={dailySales.map((d) => ({
              label: d.formattedDate,
              value: d.sales,
            }))}
            height={220}
          />
        </div>

        <div className="lg:col-span-4">
          <CategoryShareBar
            title="Revenue Distribution by Atelier Category"
            items={categoryData}
          />
        </div>
      </div>

      {/* Recent Incoming Orders Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Atelier Orders</h3>
            <p className="text-xs text-slate-500">Fulfill pending orders to maintain priority carrier rating.</p>
          </div>

          <button
            onClick={() => setCurrentView('orders')}
            className="text-xs font-bold text-[#E723A2] hover:underline flex items-center gap-1 cursor-pointer"
          >
            View all {orders.length} orders &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-slate-100 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Buyer Details</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Net Payout</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 font-mono-num">{order.id}</span>
                    <p className="text-[11px] text-slate-400 font-mono-num">{formatDate(order.createdAt)}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{order.customer.name}</p>
                    <p className="text-[11px] text-slate-500">{order.shippingAddress.city}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{order.items[0]?.productTitle}</p>
                    {order.items.length > 1 && (
                      <p className="text-[11px] text-slate-500">+{order.items.length - 1} more piece(s)</p>
                    )}
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-700 font-mono-num">
                    {formatPHP(order.netSellerPayout)}
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(order.status)}</td>
                  <td className="py-3 px-4 text-right">
                    {order.status === 'new' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'to_pack')}
                        className="px-3 py-1.5 rounded-lg bg-[#E723A2] text-white text-[11px] font-bold hover:bg-[#D61590] transition shadow-xs cursor-pointer"
                      >
                        Accept & Pack
                      </button>
                    )}
                    {order.status === 'to_pack' && (
                      <button
                        onClick={() => {
                          setActiveWaybillOrder(order);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 transition shadow-xs cursor-pointer"
                      >
                        Print Waybill
                      </button>
                    )}
                    {order.status === 'courier_handover' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'in_transit')}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-[11px] font-bold hover:bg-sky-700 transition shadow-xs cursor-pointer"
                      >
                        Handed to Driver
                      </button>
                    )}
                    {order.status === 'in_transit' && (
                      <span className="text-[11px] text-sky-600 font-semibold">In Transit</span>
                    )}
                    {order.status === 'delivered' && (
                      <span className="text-[11px] text-emerald-600 font-semibold">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
