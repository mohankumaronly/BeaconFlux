// Single responsibility: Manage chat list state, sorting, and CRUD actions (rename, pin, delete, export) with optimistic updates.

import { useState, useCallback, useRef } from 'react';
import type { ChatSummary, ExportFormat } from '../lib/api';
import { listChats, renameChat, deleteChat, pinChat, exportChat } from '../lib/api';

export interface UseChatsOptions {
  /** When true, CRUD actions are blocked (prevents DB/SSE races). */
  isStreaming: boolean;
  /** Toast callback for user feedback on error/guard. */
  onToast: (message: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export interface UseChatsResult {
  chats: ChatSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Prepend a new chat (used by chat_created SSE event). */
  prependChat: (chat: ChatSummary) => void;
  rename: (id: number, title: string) => Promise<void>;
  pin: (id: number, pinned: boolean) => Promise<void>;
  remove: (id: number) => Promise<void>;
  download: (id: number, format: ExportFormat) => Promise<void>;
}

/**
 * Pure helper to sort chats: pinned first, then by updatedAt DESC.
 * Matches backend ordering: ORDER BY pinned DESC, updatedAt DESC.
 */
export function sortChats(cs: ChatSummary[]): ChatSummary[] {
  return [...cs].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Pure guard helper to check if chat mutations should be blocked during streaming.
 */
export function shouldBlockMutation(isStreaming: boolean): boolean {
  return isStreaming;
}

/**
 * Custom hook providing reactive chat list state, optimistic CRUD operations,
 * error rollback, and automatic sorting.
 */
export function useChats(opts: UseChatsOptions): UseChatsResult {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const onToastRef = useRef(opts.onToast);
  onToastRef.current = opts.onToast;

  const isStreamingRef = useRef(opts.isStreaming);
  isStreamingRef.current = opts.isStreaming;

  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listChats();
      setChats(sortChats(rows));
    } catch {
      onToastRef.current('Failed to load chats', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const prependChat = useCallback((chat: ChatSummary) => {
    setChats((prev) => sortChats([chat, ...prev]));
  }, []);

  const rename = useCallback(
    async (id: number, title: string) => {
      if (shouldBlockMutation(isStreamingRef.current)) {
        onToastRef.current('Wait for the response to finish', 'warn');
        return;
      }
      const trimmed = title.trim();
      if (!trimmed) return;

      const prev = chatsRef.current;
      setChats((current) =>
        sortChats(current.map((c) => (c.id === id ? { ...c, title: trimmed } : c))),
      );

      try {
        await renameChat(id, trimmed);
      } catch {
        setChats(prev);
        onToastRef.current('Rename failed', 'error');
      }
    },
    [],
  );

  const pin = useCallback(
    async (id: number, pinned: boolean) => {
      if (shouldBlockMutation(isStreamingRef.current)) {
        onToastRef.current('Wait for the response to finish', 'warn');
        return;
      }

      const prev = chatsRef.current;
      setChats((current) =>
        sortChats(
          current.map((c) =>
            c.id === id
              ? { ...c, pinned, pinnedAt: pinned ? new Date().toISOString() : null }
              : c,
          ),
        ),
      );

      try {
        await pinChat(id, pinned);
      } catch {
        setChats(prev);
        onToastRef.current(pinned ? 'Pin failed' : 'Unpin failed', 'error');
      }
    },
    [],
  );

  const remove = useCallback(
    async (id: number) => {
      if (shouldBlockMutation(isStreamingRef.current)) {
        onToastRef.current('Wait for the response to finish', 'warn');
        return;
      }

      try {
        await deleteChat(id);
        await refresh();
      } catch {
        onToastRef.current('Delete failed', 'error');
      }
    },
    [refresh],
  );

  const download = useCallback(
    async (id: number, format: ExportFormat) => {
      try {
        const blob = await exportChat(id, format);
        if (typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chat-${id}.${format}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } catch {
        onToastRef.current('Export failed', 'error');
      }
    },
    [],
  );

  return {
    chats,
    loading,
    refresh,
    prependChat,
    rename,
    pin,
    remove,
    download,
  };
}
