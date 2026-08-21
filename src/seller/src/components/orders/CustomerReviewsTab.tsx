import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import { formatDate } from '../../utils/formatters';
import { FaStar, FaShieldHalved, FaReply, FaCheck } from 'react-icons/fa6';

export const CustomerReviewsTab: React.FC = () => {
  const { reviews, replyToReview } = useSeller();
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSendReply = (reviewId: string) => {
    if (!replyText.trim()) return;
    replyToReview(reviewId, replyText);
    setReplyText('');
    setReplyingId(null);
  };

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0';

  return (
    <div className="space-y-6">
      {/* Review Summary Scoreboard */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <span className="text-3xl font-black font-mono-num">{avgRating}</span>
          </div>
          <div>
            <div className="flex items-center gap-1 text-amber-500 text-sm">
              {[1, 2, 3, 4, 5].map((s) => (
                <FaStar key={s} />
              ))}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">Atelier Merchant Reputation</h3>
            <p className="text-xs text-slate-500">Based on {reviews.length} authenticated customer feedback ratings</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
            <FaShieldHalved /> 100% Verified Purchases
          </span>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((rev) => (
          <div key={rev.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">{rev.customerName}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <FaShieldHalved /> Verified Buyer
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Purchased: <strong className="text-slate-800">{rev.productTitle}</strong> (Order #{rev.orderId})
                </p>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-0.5 text-amber-500 text-xs justify-end">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <FaStar key={i} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 font-mono-num mt-0.5">{formatDate(rev.createdAt)}</p>
              </div>
            </div>

            {/* Comment */}
            <p className="text-xs leading-relaxed text-slate-700 italic bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-100">
              &ldquo;{rev.comment}&rdquo;
            </p>

            {/* Photos */}
            {rev.photos && rev.photos.length > 0 && (
              <div className="flex gap-2 pt-1">
                {rev.photos.map((photo, i) => (
                  <img
                    key={i}
                    src={photo}
                    alt="Customer photo review"
                    className="size-16 rounded-xl object-cover border border-slate-200"
                  />
                ))}
              </div>
            )}

            {/* Seller Inline Reply */}
            {rev.sellerReply ? (
              <div className="ml-4 pl-4 border-l-2 border-[#E723A2] space-y-1 bg-[#FDF2F9] p-3 rounded-r-xl border border-l-0 border-[#F9CFEA]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#E723A2] uppercase tracking-wider">
                    Atelier Seller Response
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono-num">
                    {formatDate(rev.sellerReply.repliedAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {rev.sellerReply.message}
                </p>
              </div>
            ) : replyingId === rev.id ? (
              <div className="space-y-2 pt-2">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a warm, professional reply from your atelier..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingId(null);
                      setReplyText('');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendReply(rev.id)}
                    className="px-4 py-1.5 rounded-lg bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <FaCheck /> Post Atelier Reply
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setReplyingId(rev.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E723A2] hover:underline"
                >
                  <FaReply /> Reply to Client Feedback
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
