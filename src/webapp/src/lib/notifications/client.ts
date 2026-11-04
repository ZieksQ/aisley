import { apiRequest, initializeCsrf } from '@/lib/api';
import type { NotificationResponse } from './types';

export const customerNotificationsUpdatedEvent = 'aisley:customer-notifications-updated';

export function listCustomerNotifications(query: URLSearchParams) {
  return apiRequest<NotificationResponse>(`/api/v1/customer/notifications?${query.toString()}`);
}

export async function markCustomerNotificationRead(id: string): Promise<void> {
  await initializeCsrf();
  await apiRequest(`/api/v1/customer/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
  window.dispatchEvent(new Event(customerNotificationsUpdatedEvent));
}
