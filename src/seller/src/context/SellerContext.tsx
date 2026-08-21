import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { SellerProfile, ApprovalMilestone } from '../types/auth';
import type { Product, Voucher } from '../types/product';
import type { Order, OrderStatus, CustomerReview } from '../types/order';
import type { DailySalesData, FinancialRecord, FinancialSummary } from '../types/finance';
import type { ChatThread, ChatMessage, CannedReply, ChatAttachment } from '../types/chat';
import type { StoreSettings } from '../types/settings';
import {
  MOCK_APPROVED_SELLER,
  MOCK_PENDING_SELLER,
  INITIAL_APPROVAL_MILESTONES,
  INITIAL_PRODUCTS,
  INITIAL_VOUCHERS,
  INITIAL_ORDERS,
  INITIAL_REVIEWS,
  INITIAL_DAILY_SALES,
  INITIAL_FINANCIAL_RECORDS,
  INITIAL_CHAT_THREADS,
  INITIAL_STORE_SETTINGS,
} from '../data/mockData';
import { INITIAL_CANNED_REPLIES } from '../data/cannedReplies';

interface SellerContextType {
  // Auth & Profile
  seller: SellerProfile | null;
  approvalMilestones: ApprovalMilestone[];
  loginAs: (type: 'approved' | 'pending' | 'new') => void;
  registerSeller: (data: Omit<SellerProfile, 'id' | 'status' | 'createdAt'>) => void;
  logout: () => void;
  simulateAdminApproval: (approved: boolean) => void;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleArchiveProduct: (id: string) => void;

  // Vouchers
  vouchers: Voucher[];
  addVoucher: (voucher: Omit<Voucher, 'id' | 'usageCount'>) => void;
  updateVoucher: (id: string, updates: Partial<Voucher>) => void;
  deleteVoucher: (id: string) => void;

  // Orders
  orders: Order[];
  updateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    courierDetails?: {
      name: 'J&T Express' | 'Flash Express' | 'Aisley Express' | 'Lalamove';
      scheduledPickupDate: string;
      scheduledTimeSlot: string;
      courierNotes?: string;
    }
  ) => void;
  activeWaybillOrder: Order | null;
  setActiveWaybillOrder: (order: Order | null) => void;

  // Reviews
  reviews: CustomerReview[];
  replyToReview: (reviewId: string, replyMessage: string) => void;

  // Financial Analytics
  financialSummary: FinancialSummary;
  financialRecords: FinancialRecord[];
  dailySales: DailySalesData[];

  // Chat
  chatThreads: ChatThread[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  sendMessage: (threadId: string, text: string, attachment?: ChatAttachment) => void;
  cannedReplies: CannedReply[];
  addCannedReply: (reply: Omit<CannedReply, 'id'>) => void;

  // Store Settings
  storeSettings: StoreSettings;
  updateStoreSettings: (updates: Partial<StoreSettings>) => void;
  addStoreCategory: (categoryName: string) => void;

  // Navigation state
  currentView: 'dashboard' | 'orders' | 'inventory' | 'vouchers' | 'reports' | 'chat' | 'reviews' | 'settings';
  setCurrentView: (view: 'dashboard' | 'orders' | 'inventory' | 'vouchers' | 'reports' | 'chat' | 'reviews' | 'settings') => void;
}

const SellerContext = createContext<SellerContextType | undefined>(undefined);

const STORAGE_KEYS = {
  SELLER: 'aisley_seller_profile',
  PRODUCTS: 'aisley_seller_products',
  ORDERS: 'aisley_seller_orders',
  VOUCHERS: 'aisley_seller_vouchers',
  REVIEWS: 'aisley_seller_reviews',
  CHATS: 'aisley_seller_chats',
  SETTINGS: 'aisley_seller_settings',
  MILESTONES: 'aisley_seller_milestones',
};

export const SellerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth state
  const [seller, setSeller] = useState<SellerProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SELLER);
    return saved ? JSON.parse(saved) : MOCK_APPROVED_SELLER;
  });

  const [approvalMilestones, setApprovalMilestones] = useState<ApprovalMilestone[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MILESTONES);
    return saved ? JSON.parse(saved) : INITIAL_APPROVAL_MILESTONES;
  });

  // Products
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  // Vouchers
  const [vouchers, setVouchers] = useState<Voucher[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOUCHERS);
    return saved ? JSON.parse(saved) : INITIAL_VOUCHERS;
  });

  // Orders
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [activeWaybillOrder, setActiveWaybillOrder] = useState<Order | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<CustomerReview[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
    return saved ? JSON.parse(saved) : INITIAL_REVIEWS;
  });

  // Chat
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHATS);
    return saved ? JSON.parse(saved) : INITIAL_CHAT_THREADS;
  });
  const [activeChatId, setActiveChatId] = useState<string | null>('chat-001');
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>(INITIAL_CANNED_REPLIES);

  // Store Settings
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : INITIAL_STORE_SETTINGS;
  });

  // View navigation
  const [currentView, setCurrentView] = useState<'dashboard' | 'orders' | 'inventory' | 'vouchers' | 'reports' | 'chat' | 'reviews' | 'settings'>('dashboard');

  // Persistence
  useEffect(() => {
    if (seller) localStorage.setItem(STORAGE_KEYS.SELLER, JSON.stringify(seller));
    else localStorage.removeItem(STORAGE_KEYS.SELLER);
  }, [seller]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(vouchers));
  }, [vouchers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chatThreads));
  }, [chatThreads]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(storeSettings));
  }, [storeSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(approvalMilestones));
  }, [approvalMilestones]);

  // Auth operations
  const loginAs = (type: 'approved' | 'pending' | 'new') => {
    if (type === 'approved') {
      setSeller(MOCK_APPROVED_SELLER);
      setCurrentView('dashboard');
    } else if (type === 'pending') {
      setSeller(MOCK_PENDING_SELLER);
    } else {
      setSeller(null);
    }
  };

  const registerSeller = (data: Omit<SellerProfile, 'id' | 'status' | 'createdAt'>) => {
    const newSeller: SellerProfile = {
      ...data,
      id: `usr_seller_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setSeller(newSeller);
    setApprovalMilestones(INITIAL_APPROVAL_MILESTONES);
  };

  const logout = () => {
    setSeller(null);
  };

  const simulateAdminApproval = (approved: boolean) => {
    if (!seller) return;
    if (approved) {
      setSeller({
        ...seller,
        status: 'approved',
      });
      setApprovalMilestones((prev) =>
        prev.map((m) => ({
          ...m,
          status: 'completed',
          timestamp: m.timestamp || 'Approved by Admin Clearance',
        }))
      );
    } else {
      setSeller({
        ...seller,
        status: 'pending',
      });
      setApprovalMilestones(INITIAL_APPROVAL_MILESTONES);
    }
  };

  // Product operations
  const addProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProd: Product = {
      ...productData,
      id: `prod-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProducts((prev) => [newProd, ...prev]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleArchiveProduct = (id: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === 'archived' ? 'active' : 'archived',
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  // Voucher operations
  const addVoucher = (voucherData: Omit<Voucher, 'id' | 'usageCount'>) => {
    const newVoucher: Voucher = {
      ...voucherData,
      id: `vouch-${Date.now()}`,
      usageCount: 0,
    };
    setVouchers((prev) => [newVoucher, ...prev]);
  };

  const updateVoucher = (id: string, updates: Partial<Voucher>) => {
    setVouchers((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
  };

  const deleteVoucher = (id: string) => {
    setVouchers((prev) => prev.filter((v) => v.id !== id));
  };

  // Order operations
  const updateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus,
    courierDetails?: {
      name: 'J&T Express' | 'Flash Express' | 'Aisley Express' | 'Lalamove';
      scheduledPickupDate: string;
      scheduledTimeSlot: string;
      courierNotes?: string;
    }
  ) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;

        let trackingNumber = order.trackingNumber;
        let waybillNumber = order.waybillNumber;

        if (newStatus === 'courier_handover' || newStatus === 'in_transit') {
          if (!trackingNumber) {
            const prefix = courierDetails?.name === 'J&T Express' ? 'JT-PH' : courierDetails?.name === 'Flash Express' ? 'FE' : 'AIS-EXP';
            trackingNumber = `${prefix}-${Math.floor(10000000 + Math.random() * 90000000)}`;
          }
          if (!waybillNumber) {
            waybillNumber = `WB-${order.id.replace('ORD-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
          }
        }

        return {
          ...order,
          status: newStatus,
          courier: courierDetails || order.courier,
          trackingNumber,
          waybillNumber,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  // Review operations
  const replyToReview = (reviewId: string, replyMessage: string) => {
    setReviews((prev) =>
      prev.map((rev) =>
        rev.id === reviewId
          ? {
              ...rev,
              sellerReply: {
                message: replyMessage,
                repliedAt: new Date().toISOString(),
              },
            }
          : rev
      )
    );
  };

  // Chat operations
  const sendMessage = (threadId: string, text: string, attachment?: ChatAttachment) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: seller?.id || 'usr_seller_001',
      senderName: `${seller?.firstName || 'Seller'} (Maison Dela Tour)`,
      senderRole: 'seller',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment,
      isRead: true,
    };

    setChatThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          lastMessage: text || (attachment ? `Sent ${attachment.type} attachment` : ''),
          lastMessageTime: newMsg.timestamp,
          messages: [...t.messages, newMsg],
        };
      })
    );

    // Simulate automatic buyer response after 2 seconds for interactive feel
    setTimeout(() => {
      setChatThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const autoReply: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            senderId: t.participant.id,
            senderName: t.participant.name,
            senderRole: t.participant.role,
            text: 'Got it! Thank you so much for the swift update and exquisite service.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isRead: true,
          };
          return {
            ...t,
            lastMessage: autoReply.text,
            lastMessageTime: autoReply.timestamp,
            messages: [...t.messages, autoReply],
          };
        })
      );
    }, 1800);
  };

  const addCannedReply = (reply: Omit<CannedReply, 'id'>) => {
    const newReply: CannedReply = {
      ...reply,
      id: `can-${Date.now()}`,
    };
    setCannedReplies((prev) => [...prev, newReply]);
  };

  // Store Settings operations
  const updateStoreSettings = (updates: Partial<StoreSettings>) => {
    setStoreSettings((prev) => ({ ...prev, ...updates }));
  };

  const addStoreCategory = (categoryName: string) => {
    if (!categoryName.trim()) return;
    setStoreSettings((prev) => ({
      ...prev,
      categories: prev.categories.includes(categoryName) ? prev.categories : [...prev.categories, categoryName],
    }));
  };

  // Financial summary calculated live from orders & records
  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const grossSales = validOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const costOfGoods = validOrders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, item) => iSum + item.costOfGoods * item.quantity, 0),
    0
  );
  const platformFees = validOrders.reduce((sum, o) => sum + o.platformFee, 0);
  const shippingSubsidies = validOrders.reduce((sum, o) => sum + o.shippingSubsidy, 0);
  const netProfit = grossSales - costOfGoods - platformFees - shippingSubsidies;

  const financialSummary: FinancialSummary = {
    grossSales,
    costOfGoods,
    platformFees,
    shippingSubsidies,
    netProfit,
    orderCount: validOrders.length,
    averageOrderValue: validOrders.length > 0 ? grossSales / validOrders.length : 0,
  };

  return (
    <SellerContext.Provider
      value={{
        seller,
        approvalMilestones,
        loginAs,
        registerSeller,
        logout,
        simulateAdminApproval,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleArchiveProduct,
        vouchers,
        addVoucher,
        updateVoucher,
        deleteVoucher,
        orders,
        updateOrderStatus,
        activeWaybillOrder,
        setActiveWaybillOrder,
        reviews,
        replyToReview,
        financialSummary,
        financialRecords: INITIAL_FINANCIAL_RECORDS,
        dailySales: INITIAL_DAILY_SALES,
        chatThreads,
        activeChatId,
        setActiveChatId,
        sendMessage,
        cannedReplies,
        addCannedReply,
        storeSettings,
        updateStoreSettings,
        addStoreCategory,
        currentView,
        setCurrentView,
      }}
    >
      {children}
    </SellerContext.Provider>
  );
};

export const useSeller = () => {
  const context = useContext(SellerContext);
  if (!context) {
    throw new Error('useSeller must be used within a SellerProvider');
  }
  return context;
};
