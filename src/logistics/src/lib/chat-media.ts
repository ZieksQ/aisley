import { createChatMediaClient } from '@aisley/chat-ui';
import { request as apiRequest, csrf as initializeCsrf } from './api';

export const chatMedia = createChatMediaClient({
  origin: import.meta.env.VITE_API_URL ?? '',
  role: 'logistics',
  request: apiRequest,
  csrf: initializeCsrf,
});
