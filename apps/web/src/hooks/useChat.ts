import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSource } from '@local-ollama/shared';
import type { Message, MessageStats } from '../types';
import { streamChatApi, getMessages } from '../lib/api';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

export interface StreamProgress {
  tokens: number;
  elapsedMs: number;
  tokensPerSecond: number;
}

export interface UseChatResult {
  messages: Message[];
  chatId: number | undefined;
  isStreaming: boolean;
  progress: StreamProgress | null;
  error: string | null;
  send: (text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  loadChat: (id: number) => Promise<void>;
  currentSources: WebSource[];
}

export interface UseChatOptions {
  model: string;
  systemPrompt?: string;
  ollamaUrl?: string;
  providerId?: string;
  onChatCreated?: (chat: { id: number; title: string }) => void;
}

export function useChat(options: UseChatOptions): UseChatResult {
  const { model, onChatCreated, providerId } = options;
  const ollamaUrl = options.ollamaUrl;

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<number | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSources, setCurrentSources] = useState<WebSource[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const chatIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setChatId(undefined);
    setError(null);
    setProgress(null);
    setIsStreaming(false);
    setCurrentSources([]); // <-- CLEAR
  }, []);

  const loadChat = useCallback(async (id: number) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setError(null);
    setProgress(null);
    setIsStreaming(false);
    setCurrentSources([]); // <-- CLEAR
    try {
      const { messages: rows } = await getMessages(id);
      setChatId(id);
      setMessages(
        rows
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map<Message>((m) => ({
            id: String(m.id),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: new Date(m.createdAt).getTime(),
          })),
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to load chat');
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (abortRef.current) return;

      setError(null);
      setProgress(null);
      setCurrentSources([]); // <-- CLEAR ON SEND

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      };

      const assistantId = uid();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let activeChatId = chatIdRef.current;
      let firstTokenAt = 0;
      let tokenCount = 0;
      let full = '';

      try {
        for await (const ev of streamChatApi(
          { chatId: activeChatId, message: trimmed, model, ollamaUrl, providerId },
          controller.signal,
        )) {
          if (ev.type === 'chat_created') {
            activeChatId = ev.chatId;
            chatIdRef.current = ev.chatId;
            setChatId(ev.chatId);
            const title = trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed;
            onChatCreated?.({ id: ev.chatId, title });
          } else if (ev.type === 'token') {
            if (!firstTokenAt) firstTokenAt = performance.now();
            tokenCount += 1;
            full += ev.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + ev.text } : m,
              ),
            );
            if (tokenCount % 3 === 0 && firstTokenAt) {
              const elapsedMs = performance.now() - firstTokenAt;
              const tokensPerSecond = elapsedMs > 0 ? tokenCount / (elapsedMs / 1000) : 0;
              setProgress({ tokens: tokenCount, elapsedMs, tokensPerSecond });
            }
          } else if (ev.type === 'sources') {
            // 👇 CAPTURE SOURCES HERE
            setCurrentSources(ev.sources);
          } else if (ev.type === 'error') {
            setError(ev.message);
          } else if (ev.type === 'done') {
            const completionTokens = tokenCount || estimateTokens(full);
            const elapsedMs = firstTokenAt ? performance.now() - firstTokenAt : 0;
            const stats: MessageStats = {
              promptTokens: 0,
              completionTokens,
              totalTokens: completionTokens,
              tokensPerSecond: elapsedMs > 0 ? completionTokens / (elapsedMs / 1000) : 0,
              promptTokensPerSecond: 0,
              totalMs: elapsedMs,
              evalMs: elapsedMs,
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, id: String(ev.assistantMessageId), stats }
                  : m,
              ),
            );
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || 'Unknown error');
        }
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.content === '')),
        );
      } finally {
        setIsStreaming(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [model, ollamaUrl, providerId, onChatCreated],
  );

  return { messages, chatId, isStreaming, progress, error, send, stop, clear, loadChat, currentSources };
}