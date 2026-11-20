import { Router } from 'express';
import {
  postChat,
  listChatsHandler,
  getMessagesHandler,
  renameChatHandler,
  deleteChatHandler,
  pinChatHandler,
  exportChatHandler,
} from './chat.controller.js';

export const chatRouter = Router();
chatRouter.post('/chat', postChat);
chatRouter.get('/chats', listChatsHandler);
chatRouter.get('/chats/:id/messages', getMessagesHandler);
chatRouter.patch('/chats/:id', renameChatHandler);
chatRouter.delete('/chats/:id', deleteChatHandler);
chatRouter.patch('/chats/:id/pin', pinChatHandler);
chatRouter.get('/chats/:id/export', exportChatHandler);

