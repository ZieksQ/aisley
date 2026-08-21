import type { FinancialRecord } from '../types/finance';
import type { Order } from '../types/order';

export function exportFinancialRecordsToCSV(records: FinancialRecord[], filename = 'Aisley_Financial_Report.csv') {
  const headers = ['Record ID', 'Order ID', 'Date', 'Gross Sales (PHP)', 'COGS (PHP)', 'Platform Fee (3.5%)', 'Shipping Subsidy (PHP)', 'Net Payout (PHP)', 'Status'];
  
  const rows = records.map((r) => [
    r.id,
    r.orderId,
    r.date,
    r.grossSales.toFixed(2),
    r.cogs.toFixed(2),
    r.platformFee.toFixed(2),
    r.shippingSubsidy.toFixed(2),
    r.netPayout.toFixed(2),
    r.status.toUpperCase(),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportOrdersToCSV(orders: Order[], filename = 'Aisley_Orders_Report.csv') {
  const headers = ['Order ID', 'Order Number', 'Date', 'Customer Name', 'Customer Email', 'Items Count', 'Subtotal', 'Voucher Discount', 'Shipping Fee', 'Platform Fee', 'Net Seller Payout', 'Status', 'Payment Method'];
  
  const rows = orders.map((o) => [
    o.id,
    o.orderNumber,
    o.createdAt,
    o.customer.name,
    o.customer.email,
    o.items.length,
    o.subtotal.toFixed(2),
    o.voucherDiscount.toFixed(2),
    o.shippingFee.toFixed(2),
    o.platformFee.toFixed(2),
    o.netSellerPayout.toFixed(2),
    o.status.toUpperCase(),
    o.paymentMethod,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
