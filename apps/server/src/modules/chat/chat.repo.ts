import { eq, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { chats, messages, type Chat, type Message } from '../../db/schema.js';

export async function createChat(title: string): Promise<Chat> {
  const [row] = await db.insert(chats).values({ title }).returning();
  if (!row) throw new Error('Failed to create chat');
  return row;
}

export async function getChat(id: number): Promise<Chat | undefined> {
  const [row] = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
  return row;
}

export async function listChats(): Promise<Chat[]> {
  return db.select().from(chats).orderBy(desc(chats.pinned), desc(chats.updatedAt));
}

export async function touchChat(id: number): Promise<void> {
  await db
    .update(chats)
    .set({ updatedAt: sql`now()` })
    .where(eq(chats.id, id));
}

export async function appendMessage(
  chatId: number,
  role: 'system' | 'user' | 'assistant',
  content: string,
): Promise<Message> {
  const [row] = await db
    .insert(messages)
    .values({ chatId, role, content })
    .returning();
  if (!row) throw new Error('Failed to insert message');
  return row;
}

export async function listMessages(chatId: number): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt), asc(messages.id));
}

/**
 * Rename a chat's title.
 * Does NOT bump updatedAt — rename is metadata, not activity.
 * @returns Updated Chat row, or undefined if id not found.
 */
export async function renameChat(id: number, title: string): Promise<Chat | undefined> {
  const [row] = await db
    .update(chats)
    .set({ title })
    .where(eq(chats.id, id))
    .returning();
  return row;
}

/**
 * Delete a chat by id. Messages cascade via FK onDelete: 'cascade'.
 * @returns true if a row was deleted, false if no row matched.
 */
export async function deleteChat(id: number): Promise<boolean> {
  const result = await db
    .delete(chats)
    .where(eq(chats.id, id))
    .returning({ id: chats.id });
  return result.length > 0;
}

/**
 * Pin or unpin a chat.
 * Sets pinnedAt = now() when pinned=true, null when pinned=false.
 * @returns Updated Chat row, or undefined if id not found.
 */
export async function setPinned(id: number, pinned: boolean): Promise<Chat | undefined> {
  const [row] = await db
    .update(chats)
    .set({
      pinned,
      pinnedAt: pinned ? sql`now()` : null,
    })
    .where(eq(chats.id, id))
    .returning();
  return row;
}

/**
 * Fetch a chat and all its messages for export.
 * Messages ordered by (createdAt ASC, id ASC) — same as listMessages.
 * @returns { chat, messages } or undefined if chat not found.
 */
export async function getChatWithMessages(
  id: number,
): Promise<{ chat: Chat; messages: Message[] } | undefined> {
  const chat = await getChat(id);
  if (!chat) return undefined;
  const msgs = await listMessages(id);
  return { chat, messages: msgs };
}

/**
 * Chat repository interface object for controller consumption and test stubbing.
 */
export const chatRepo = {
  createChat,
  getChat,
  listChats,
  touchChat,
  appendMessage,
  listMessages,
  renameChat,
  deleteChat,
  setPinned,
  getChatWithMessages,
};


