// Single responsibility: Database repository operations for the providers table.

import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  providers,
  type ProviderRow,
  type NewProviderRow,
} from '../../db/schema.js';

export const providerRepo = {
  createProvider: async (data: NewProviderRow): Promise<ProviderRow> => {
    const [row] = await db.insert(providers).values(data).returning();
    if (!row) throw new Error('Failed to create provider');
    return row;
  },

  getProvider: async (id: string): Promise<ProviderRow | undefined> => {
    const [row] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id))
      .limit(1);
    return row;
  },

  listProviders: async (): Promise<ProviderRow[]> => {
    return db.select().from(providers).orderBy(desc(providers.createdAt));
  },

  updateProvider: async (
    id: string,
    data: Partial<NewProviderRow>,
  ): Promise<ProviderRow | undefined> => {
    const [row] = await db
      .update(providers)
      .set({
        ...data,
        updatedAt: sql`now()`,
      })
      .where(eq(providers.id, id))
      .returning();
    return row;
  },

  deleteProvider: async (id: string): Promise<boolean> => {
    const result = await db
      .delete(providers)
      .where(eq(providers.id, id))
      .returning({ id: providers.id });
    return result.length > 0;
  },
};

export const createProvider = (data: NewProviderRow) => providerRepo.createProvider(data);
export const getProvider = (id: string) => providerRepo.getProvider(id);
export const listProviders = () => providerRepo.listProviders();
export const updateProvider = (id: string, data: Partial<NewProviderRow>) =>
  providerRepo.updateProvider(id, data);
export const deleteProvider = (id: string) => providerRepo.deleteProvider(id);
