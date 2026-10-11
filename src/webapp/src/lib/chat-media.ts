import { createChatMediaClient } from '@aisley/ui/chat';
import { apiRequest, initializeCsrf } from './api';

export const chatMedia = createChatMediaClient({
  origin: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  role: 'customer',
  request: apiRequest,
  csrf: initializeCsrf,
});
