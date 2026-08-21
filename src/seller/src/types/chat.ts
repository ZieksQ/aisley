export interface ChatAttachment {
  type: 'product' | 'voucher' | 'image';
  data: {
    id: string;
    title: string;
    subtitle?: string;
    price?: number;
    discount?: string;
    code?: string;
    imageUrl?: string;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller' | 'admin';
  text: string;
  timestamp: string;
  attachment?: ChatAttachment;
  isRead: boolean;
}

export interface ChatThread {
  id: string;
  participant: {
    id: string;
    name: string;
    role: 'buyer' | 'admin';
    avatarUrl?: string;
    email?: string;
    activeOrderId?: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export interface CannedReply {
  id: string;
  title: string;
  text: string;
  category: 'Greeting' | 'Inventory' | 'Shipping' | 'Voucher' | 'Custom';
}
