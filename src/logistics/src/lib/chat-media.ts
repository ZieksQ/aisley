import { createChatMediaClient } from '@aisley/ui/chat';
import { request as apiRequest, csrf as initializeCsrf } from './api';

export const chatMedia = createChatMediaClient({
  origin: import.meta.env.VITE_API_URL ?? '',
  role: 'logistics',
  request: apiRequest,
  csrf: initializeCsrf,
});
