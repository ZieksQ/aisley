import type { CannedReply } from '../types/chat';

export const INITIAL_CANNED_REPLIES: CannedReply[] = [
  {
    id: 'can-1',
    title: 'Ready to Pack',
    text: 'Hi there! Yes, this piece is currently in stock at our atelier and ready to pack today.',
    category: 'Inventory',
  },
  {
    id: 'can-2',
    title: 'Courier Dispatch Update',
    text: 'Thank you for your order! It has been packaged with our signature dust bag and is scheduled for courier pickup tomorrow morning.',
    category: 'Shipping',
  },
  {
    id: 'can-3',
    title: 'Sizing & Tailoring Consultation',
    text: 'Our garments are tailored true-to-size with an artisanal drape. For bespoke adjustments, please feel free to send us your exact measurements.',
    category: 'Custom',
  },
  {
    id: 'can-4',
    title: 'VIP Atelier Voucher Offer',
    text: 'As a valued collector of Aisley, here is a special 15% VIP discount code for your next atelier purchase: ATELIER15.',
    category: 'Voucher',
  },
  {
    id: 'can-5',
    title: 'Courier Handover Confirmation',
    text: 'Your package has been successfully handed over to our logistics partner. You can track real-time dispatch via your order dashboard.',
    category: 'Shipping',
  },
];
