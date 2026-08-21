import React, { useState } from 'react';
import type { Order } from '../../types/order';
import { Modal } from '../common/Modal';
import { FaCalendarDay, FaClock, FaNoteSticky, FaCheck } from 'react-icons/fa6';

interface CourierHandoverModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (
    orderId: string,
    courierDetails: {
      name: 'J&T Express' | 'Flash Express' | 'Aisley Express' | 'Lalamove';
      scheduledPickupDate: string;
      scheduledTimeSlot: string;
      courierNotes?: string;
    }
  ) => void;
}

export const CourierHandoverModal: React.FC<CourierHandoverModalProps> = ({
  order,
  isOpen,
  onClose,
  onSchedule,
}) => {
  const [courierName, setCourierName] = useState<'J&T Express' | 'Flash Express' | 'Aisley Express' | 'Lalamove'>('Aisley Express');
  const [pickupDate, setPickupDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [timeSlot, setTimeSlot] = useState('09:00 - 12:00 PHT (Morning Slot)');
  const [notes, setNotes] = useState('Handle with care. Luxury garment box with seal.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!order) return null;

  const couriers: {
    name: 'Aisley Express' | 'J&T Express' | 'Flash Express' | 'Lalamove';
    tag: string;
    sla: string;
    badge: string;
  }[] = [
    {
      name: 'Aisley Express',
      tag: 'Priority White-Glove Atelier Fleet',
      sla: 'Next-Day Delivery (Metro Manila / Cebu)',
      badge: 'Recommended',
    },
    {
      name: 'J&T Express',
      tag: 'Nationwide Philippine Island Coverage',
      sla: '2–3 Days Luzon / VisMin',
      badge: 'Nationwide',
    },
    {
      name: 'Flash Express',
      tag: 'Express Commercial Courier Hubs',
      sla: '1–2 Days Urban Centers',
      badge: 'Fast',
    },
    {
      name: 'Lalamove',
      tag: 'Same-Day Dedicated Courier Van/Bike',
      sla: '3 Hours Direct Delivery',
      badge: 'Same Day',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSchedule(order.id, {
        name: courierName,
        scheduledPickupDate: pickupDate,
        scheduledTimeSlot: timeSlot,
        courierNotes: notes,
      });
      onClose();
    }, 500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Logistics Courier Pickup"
      subtitle={`Order #${order.id} • Destination: ${order.shippingAddress.city}, ${order.shippingAddress.province}`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Courier Partner Selection Cards */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Select Logistics Provider Partner
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {couriers.map((c) => (
              <div
                key={c.name}
                onClick={() => setCourierName(c.name)}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition ${
                  courierName === c.name
                    ? 'border-[#E723A2] bg-[#FDF2F9]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{c.name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      courierName === c.name
                        ? 'bg-[#E723A2] text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {c.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{c.tag}</p>
                <p className="text-[10px] font-bold text-slate-700 font-mono-num mt-1">
                  SLA: {c.sla}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Date & Time Slot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
              <FaCalendarDay className="text-[#E723A2]" /> Scheduled Pickup Date
            </label>
            <input
              type="date"
              required
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
              <FaClock className="text-[#0284C7]" /> Time Slot Window
            </label>
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            >
              <option value="09:00 - 12:00 PHT (Morning Slot)">09:00 - 12:00 PHT (Morning Slot)</option>
              <option value="13:00 - 16:00 PHT (Afternoon Slot)">13:00 - 16:00 PHT (Afternoon Slot)</option>
              <option value="16:00 - 19:00 PHT (Evening Priority)">16:00 - 19:00 PHT (Evening Priority)</option>
            </select>
          </div>
        </div>

        {/* Handling Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
            <FaNoteSticky className="text-amber-500" /> Dispatch Instructions / Landmark
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Atelier concierge desk, 4th floor. Request signed manifest."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FaCheck /> Confirm & Assign Tracking
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
