export interface FinancialSummary {
  grossSales: number;
  costOfGoods: number;
  platformFees: number;
  shippingSubsidies: number;
  netProfit: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface FinancialRecord {
  id: string;
  orderId: string;
  date: string;
  grossSales: number;
  cogs: number;
  platformFee: number;
  shippingSubsidy: number;
  netPayout: number;
  status: 'settled' | 'processing' | 'pending';
}

export interface DailySalesData {
  date: string;
  formattedDate: string;
  sales: number;
  orders: number;
  netProfit: number;
}
