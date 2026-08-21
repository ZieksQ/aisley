import React, { useState, useEffect, useRef } from 'react';
import { useSeller } from '../../context/SellerContext';
import type { ChatAttachment } from '../../types/chat';
import { formatPHP } from '../../utils/formatters';
import {
  FaMagnifyingGlass,
  FaPaperPlane,
  FaBolt,
  FaBoxOpen,
  FaXmark,
  FaTicket,
  FaShieldHalved,
} from 'react-icons/fa6';

export const ChatView: React.FC = () => {
  const {
    chatThreads,
    activeChatId,
    setActiveChatId,
    sendMessage,
    cannedReplies,
    products,
    vouchers,
    orders,
  } = useSeller();

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCannedDropdown, setShowCannedDropdown] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showVoucherPicker, setShowVoucherPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeThread = chatThreads.find((t) => t.id === activeChatId) || chatThreads[0];

  const filteredThreads = chatThreads.filter((t) =>
    t.participant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Active buyer order context
  const activeOrder = activeThread?.participant.activeOrderId
    ? orders.find((o) => o.id === activeThread.participant.activeOrderId)
    : null;

  // Auto-scroll to bottom of messages when new message is sent or thread changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages.length, activeChatId]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeThread) return;

    sendMessage(activeThread.id, messageInput.trim());
    setMessageInput('');
    setShowCannedDropdown(false);
    setShowProductPicker(false);
    setShowVoucherPicker(false);
  };

  const handleSelectCanned = (text: string) => {
    setMessageInput(text);
    setShowCannedDropdown(false);
  };

  const handleAttachProduct = (prod: any) => {
    if (!activeThread) return;
    const attachment: ChatAttachment = {
      type: 'product',
      data: {
        id: prod.id,
        title: prod.title,
        price: prod.basePrice,
        subtitle: `SKU: ${prod.sku} • In Stock (${prod.stock})`,
        imageUrl: prod.imageUrl,
      },
    };
    sendMessage(activeThread.id, `Here is the product card for ${prod.title}:`, attachment);
    setShowProductPicker(false);
  };

  const handleAttachVoucher = (v: any) => {
    if (!activeThread) return;
    const attachment: ChatAttachment = {
      type: 'voucher',
      data: {
        id: v.id,
        title: `${v.code} - ${v.discountType === 'percentage' ? `${v.discountValue}% OFF` : `₱${v.discountValue} OFF`}`,
        code: v.code,
        discount: v.discountType === 'percentage' ? `${v.discountValue}% OFF` : `₱${v.discountValue} OFF`,
        subtitle: `Min spend ${formatPHP(v.minSpend)}`,
      },
    };
    sendMessage(activeThread.id, `I've attached an Aisley discount voucher for you!`, attachment);
    setShowVoucherPicker(false);
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[560px] max-h-[calc(100vh-140px)] rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#0F172A] shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column: Conversation Thread List (4 cols) */}
      <div className="lg:col-span-4 border-r border-slate-300 dark:border-slate-800 flex flex-col bg-[#F8FAFC] dark:bg-slate-900/60 h-full min-h-0 overflow-hidden">
        {/* Thread Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] shrink-0">
          <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight mb-2">
            Client Concierge Chat
          </h2>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <FaMagnifyingGlass className="size-3" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversation threads..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Thread Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 min-h-0">
          {filteredThreads.map((thread) => {
            const isActive = thread.id === activeThread?.id;

            return (
              <div
                key={thread.id}
                onClick={() => setActiveChatId(thread.id)}
                className={`p-3.5 flex items-start gap-3 cursor-pointer transition ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 border-l-4 border-[#E723A2]'
                    : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={
                      thread.participant.avatarUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                    }
                    alt={thread.participant.name}
                    className="size-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  {thread.participant.role === 'admin' ? (
                    <span className="absolute -bottom-1 -right-1 size-3.5 bg-slate-900 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      A
                    </span>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 size-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {thread.participant.name}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-num shrink-0">
                      {thread.lastMessageTime}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                    {thread.lastMessage}
                  </p>

                  {thread.participant.activeOrderId && (
                    <span className="inline-block mt-1 text-[10px] font-mono-num font-bold text-[#E723A2] bg-[#FDF2F9] dark:bg-pink-950/40 px-1.5 py-0.5 rounded border border-[#F9CFEA] dark:border-pink-900/60">
                      Order #{thread.participant.activeOrderId}
                    </span>
                  )}
                </div>

                {thread.unreadCount > 0 && (
                  <span className="size-5 rounded-full bg-[#E723A2] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {thread.unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Center Column: Active Chat Window */}
      <div className="lg:col-span-5 flex flex-col bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-slate-800 h-full min-h-0 overflow-hidden relative">
        {activeThread ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0F172A] shrink-0 z-10">
              <div className="flex items-center gap-3">
                <img
                  src={
                    activeThread.participant.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                  }
                  alt={activeThread.participant.name}
                  className="size-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {activeThread.participant.name}
                    </h3>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700">
                      Verified Buyer
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {activeThread.participant.email || 'Direct Buyer Inquiry'}
                  </p>
                </div>
              </div>

              {/* Canned replies trigger button */}
              <div className="relative">
                <button
                  onClick={() => setShowCannedDropdown(!showCannedDropdown)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FaBolt className="text-amber-500" /> Canned Replies
                </button>

                {/* Canned Replies Popover */}
                {showCannedDropdown && (
                  <div className="absolute right-0 top-10 z-30 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Quick Canned Replies
                      </span>
                      <button
                        onClick={() => setShowCannedDropdown(false)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <FaXmark className="size-3" />
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1.5">
                      {cannedReplies.map((can) => (
                        <button
                          key={can.id}
                          onClick={() => handleSelectCanned(can.text)}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-[#FDF2F9] dark:hover:bg-slate-800 border border-transparent hover:border-[#F9CFEA] dark:hover:border-pink-900/60 transition group cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#E723A2]">
                              {can.title}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              {can.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                            {can.text}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F8FAFC] dark:bg-[#0B0F19] min-h-0 overscroll-contain">
              {activeThread.messages.map((msg) => {
                const isMe = msg.senderRole === 'seller';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono-num">
                        {msg.senderName} • {msg.timestamp}
                      </span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-medium space-y-2.5 ${
                        isMe
                          ? 'bg-[#E723A2] text-white rounded-br-xs shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-xs shadow-xs'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                      {/* Product Card Attachment */}
                      {msg.attachment?.type === 'product' && (
                        <div
                          className={`p-2.5 rounded-xl flex items-center gap-2.5 ${
                            isMe ? 'bg-black/20 text-white' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                          }`}
                        >
                          {msg.attachment.data.imageUrl && (
                            <img
                              src={msg.attachment.data.imageUrl}
                              alt={msg.attachment.data.title}
                              className="size-12 rounded-lg object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold truncate text-xs">{msg.attachment.data.title}</p>
                            <p className="text-[10px] opacity-80">{msg.attachment.data.subtitle}</p>
                            {msg.attachment.data.price && (
                              <p className="font-black font-mono-num text-xs mt-0.5">
                                {formatPHP(msg.attachment.data.price)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Voucher Card Attachment */}
                      {msg.attachment?.type === 'voucher' && (
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            isMe
                              ? 'bg-black/20 border-white/20 text-white'
                              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FaTicket className="size-4" />
                            <div>
                              <p className="font-black font-mono-num tracking-wider text-xs">
                                {msg.attachment.data.code}
                              </p>
                              <p className="text-[10px] opacity-80">{msg.attachment.data.subtitle}</p>
                            </div>
                          </div>
                          <span className="font-bold text-xs font-mono-num">
                            {msg.attachment.data.discount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment Drawers / Popups */}
            {showProductPicker && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Attach Product from Catalog</span>
                  <button onClick={() => setShowProductPicker(false)} className="cursor-pointer">
                    <FaXmark className="size-3 text-slate-400" />
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleAttachProduct(p)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#E723A2] cursor-pointer shrink-0 w-44 bg-[#F8FAFC] dark:bg-slate-800"
                    >
                      <img src={p.imageUrl} alt={p.title} className="w-full h-16 rounded-lg object-cover mb-1" />
                      <p className="font-bold text-xs truncate text-slate-900 dark:text-white">{p.title}</p>
                      <p className="text-[11px] font-mono-num font-bold text-emerald-700 dark:text-emerald-400">
                        {formatPHP(p.basePrice)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showVoucherPicker && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Attach Promo Code</span>
                  <button onClick={() => setShowVoucherPicker(false)} className="cursor-pointer">
                    <FaXmark className="size-3 text-slate-400" />
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {vouchers.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => handleAttachVoucher(v)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#E723A2] cursor-pointer shrink-0 bg-[#FDF2F9] dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <span className="font-black font-mono-num text-xs uppercase">{v.code}</span>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300">
                        {v.discountType === 'percentage' ? `${v.discountValue}% OFF` : `₱${v.discountValue} OFF`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar (Fixed & Docked to bottom, Never Disappears) */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] flex flex-col gap-2 shrink-0 sticky bottom-0 z-10"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductPicker(!showProductPicker);
                    setShowVoucherPicker(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                    showProductPicker
                      ? 'border-[#E723A2] bg-[#FDF2F9] dark:bg-pink-950/50 text-[#E723A2] dark:text-pink-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <FaBoxOpen className="text-[#E723A2]" /> Product
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowVoucherPicker(!showVoucherPicker);
                    setShowProductPicker(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                    showVoucherPicker
                      ? 'border-[#0284C7] bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <FaTicket className="text-[#0284C7]" /> Voucher
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message to buyer (Press Enter to send)..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-[#E723A2] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
                >
                  <FaPaperPlane /> Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            Select a conversation thread to start messaging
          </div>
        )}
      </div>

      {/* Right Column: Buyer & Active Order Context Panel (3 cols) */}
      <div className="lg:col-span-3 bg-[#F8FAFC] dark:bg-slate-900/60 p-5 overflow-y-auto h-full min-h-0 space-y-5 text-xs hidden lg:block border-l border-slate-300 dark:border-slate-800">
        <h3 className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Client Information Context
        </h3>

        {activeThread ? (
          <div className="space-y-4">
            <div className="text-center p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img
                src={
                  activeThread.participant.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                }
                alt={activeThread.participant.name}
                className="size-16 rounded-2xl object-cover mx-auto border border-slate-200 dark:border-slate-700 mb-2"
              />
              <p className="font-bold text-sm text-slate-900 dark:text-white">
                {activeThread.participant.name}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {activeThread.participant.email || 'customer@aisley.ph'}
              </p>
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 text-[10px] font-bold">
                <FaShieldHalved /> Authenticated Buyer
              </span>
            </div>

            {/* Active Order in Inquiry */}
            {activeOrder && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Linked Order
                  </span>
                  <span className="font-mono-num font-bold text-slate-900 dark:text-white text-xs">
                    {activeOrder.id}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">{activeOrder.items[0]?.productTitle}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Qty: {activeOrder.items[0]?.quantity} • {formatPHP(activeOrder.totalAmount)}
                  </p>
                  <div className="pt-1">
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-[10px] font-bold uppercase">
                      {activeOrder.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-center">No active client data</p>
        )}
      </div>
    </div>
  );
};
