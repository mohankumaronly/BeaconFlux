import type { Request, Response } from 'express';
import { z } from 'zod';
import { streamChat } from './chat.service.js';
import { chatRepo as repo } from './chat.repo.js';
import { env } from '../../config/env.js';
import { isAllowedOllamaUrl } from '../ollama/ollama.client.js';
import { getProviderById, makeOllamaProvider } from '../../providers/registry.js';

const ChatBody = z.object({
  chatId: z.number().int().positive().optional(),
  message: z.string().min(1, 'message required').max(32_000),
  model: z.string().min(1).default('llama3.2'),
  // Optional: client-supplied Ollama target. Omit to use env.OLLAMA_URL.
  ollamaUrl: z.string().url().optional(),
  // Allow both a valid UUID and an empty string (which means local Ollama)
  providerId: z.union([z.string().uuid(), z.literal('')]).optional(),
});

const RenameBody = z.object({
  title: z.string().trim().min(1, 'title required').max(120, 'title too long'),
});
const PinBody = z.object({ pinned: z.boolean() });
const ExportQuery = z.object({
  format: z.enum(['md', 'json']).default('md'),
});

export async function postChat(req: Request, res: Response): Promise<void> {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const { chatId, message, model, ollamaUrl, providerId } = parsed.data;

  // Resolve target: providerId -> client ollamaUrl override -> env default
  let provider;
  
  // Only attempt DB lookup if providerId is a non-empty string
  if (providerId && providerId !== '') {
    provider = await getProviderById(providerId);
    if (!provider) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }
  } else if (ollamaUrl) {
    if (!isAllowedOllamaUrl(ollamaUrl)) {
      res.status(400).json({
        error: 'URL not allowed',
        message: `Hostname must match OLLAMA_ALLOWED_HOSTS. Allowed: ${env.OLLAMA_ALLOWED_HOSTS.join(', ')}`,
      });
      return;
    }
    provider = makeOllamaProvider(ollamaUrl.replace(/\/+$/, ''));
  } else {
    // Fallback to local Ollama env URL
    provider = makeOllamaProvider(env.OLLAMA_URL);
  }

  // Fail fast before opening SSE if model isn't on the target
  try {
    await provider.ensureModel(model);
  } catch (err) {
    res.status(400).json({
      error: 'Model unavailable',
      message: (err as Error).message,
    });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx/CDN buffering
  res.flushHeaders();

  const abort = new AbortController();
  // Abort the Ollama stream only if the CLIENT disconnects before we finish.
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const send = (event: unknown): void => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    for await (const ev of streamChat({
      chatId,
      userMessage: message,
      model,
      provider,
      signal: abort.signal,
    })) {
      send(ev);
    }
  } catch (err) {
    send({ type: 'error', message: (err as Error).message });
  } finally {
    res.end();
  }
}

export async function listChatsHandler(_req: Request, res: Response): Promise<void> {
  const rows = await repo.listChats();
  res.json(rows);
}

export async function getMessagesHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid chat id' });
    return;
  }
  const chat = await repo.getChat(id);
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  const msgs = await repo.listMessages(id);
  res.json({ chat, messages: msgs });
}

/**
 * PATCH /api/v1/chats/:id — rename a chat.
 * 200 ChatSummary | 400 invalid body/id | 404 not found
 */
export async function renameChatHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid chat id' });
    return;
  }
  const parsed = RenameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const updated = await repo.renameChat(id, parsed.data.title);
  if (!updated) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  res.json(updated);
}

/**
 * DELETE /api/v1/chats/:id — delete a chat and cascade messages.
 * 204 no body | 400 invalid id | 404 not found
 */
export async function deleteChatHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid chat id' });
    return;
  }
  const deleted = await repo.deleteChat(id);
  if (!deleted) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  res.status(204).end();
}

/**
 * PATCH /api/v1/chats/:id/pin — pin/unpin a chat.
 * 200 ChatSummary | 400 invalid body/id | 404 not found
 */
export async function pinChatHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid chat id' });
    return;
  }
  const parsed = PinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const updated = await repo.setPinned(id, parsed.data.pinned);
  if (!updated) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  res.json(updated);
}

/**
 * GET /api/v1/chats/:id/export?format=md|json — download a chat transcript.
 * 200 file (headers below) | 400 invalid id/format | 404 not found
 * Headers:
 *   Content-Type: text/markdown; charset=utf-8 | application/json; charset=utf-8
 *   Content-Disposition: attachment; filename="chat-<id>-<slug>.<ext>"
 *   Cache-Control: no-store
 * md body: "# <title>\n\n_Exported <ISO> · <n> messages_\n\n---\n\n"
 *          then per message "## User\n<content>\n\n" or "## Assistant\n<content>\n\n"
 * json body: { chat, messages } (same shape as MessagesResponse)
 */
export async function exportChatHandler(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid chat id' });
    return;
  }
  const parsedQuery = ExportQuery.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: 'Invalid format', details: parsedQuery.error.flatten() });
    return;
  }

  const data = await repo.getChatWithMessages(id);
  if (!data) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }

  const { format } = parsedQuery.data;
  const slug =
    data.chat.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'chat';
  const ext = format === 'md' ? 'md' : 'json';
  const filename = `chat-${id}-${slug}.${ext}`;

  res.setHeader(
    'Content-Type',
    format === 'md' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');

  if (format === 'md') {
    const nowIso = new Date().toISOString();
    let body = `# ${data.chat.title}\n\n_Exported ${nowIso} · ${data.messages.length} messages_\n\n---\n\n`;
    for (const msg of data.messages) {
      const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      body += `## ${roleLabel}\n${msg.content}\n\n`;
    }
    res.send(body);
  } else {
    res.send(JSON.stringify({ chat: data.chat, messages: data.messages }, null, 2));
  }
}