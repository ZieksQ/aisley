import type { CheckoutIntent, VoucherSelection } from './types';

const key = 'aisley:checkout-address-return';
type AddressReturn = {
  customerId: string;
  intent: CheckoutIntent;
  vouchers: VoucherSelection[];
  logistics: Record<string, string>;
};

// Keep only review selections, never a quote, address/contact snapshot or purchase key.
export function saveAddressReturn(value: AddressReturn) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function clearAddressReturn() {
  sessionStorage.removeItem(key);
}

export function takeAddressReturn(customerId: string, intent: CheckoutIntent): AddressReturn | null {
  try {
    const raw = sessionStorage.getItem(key);
    clearAddressReturn();
    if (!raw) return null;
    const saved = JSON.parse(raw) as AddressReturn;
    if (saved.customerId !== customerId || JSON.stringify(saved.intent) !== JSON.stringify(intent)
      || !Array.isArray(saved.vouchers) || !saved.logistics || typeof saved.logistics !== 'object' || Array.isArray(saved.logistics)
      || saved.vouchers.some((item) => !item || typeof item.voucher_id !== 'string' || typeof item.target_shop_id !== 'string')
      || Object.values(saved.logistics).some((value) => typeof value !== 'string')) return null;
    return saved;
  } catch {
    return null;
  }
}
