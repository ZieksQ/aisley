import { apiRequest, initializeCsrf } from '@/lib/api';

export async function markCustomerNotificationRead(id: string): Promise<void> {
  await initializeCsrf();
  await apiRequest(`/api/v1/customer/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}
