// Single responsibility: Define database schema for chats, messages, and providers.

import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  boolean,
  jsonb,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const providers = pgTable('providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 32 }).notNull(), // 'ollama' | 'openai' | 'custom'
  label: varchar('label', { length: 64 }).notNull(),
  baseUrl: text('base_url').notNull(),
  apiKeyEnc: text('api_key_enc'), // null for keyless (ollama, lmstudio)
  defaultModel: varchar('default_model', { length: 128 }),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  title: text('title').notNull().default('New chat'),
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    chatId: integer('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['system', 'user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'set null' }),
    model: varchar('model', { length: 128 }),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    chatIdIdx: index('messages_chat_id_idx').on(t.chatId),
    createdAtIdx: index('messages_created_at_idx').on(t.createdAt),
  }),
);

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ProviderRow = typeof providers.$inferSelect;
export type NewProviderRow = typeof providers.$inferInsert;
