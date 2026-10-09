import { createChatMediaClient } from '@aisley/chat-ui';
import { apiRequest, initializeCsrf } from './api';

export const chatMedia = createChatMediaClient({
  origin: import.meta.env.VITE_API_URL ?? '',
  role: 'seller',
  request: apiRequest,
  csrf: initializeCsrf,
});
