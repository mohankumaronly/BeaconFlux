import type { ServerStreamEvent } from '@local-ollama/shared';
import * as repo from './chat.repo.js';
import { streamOllamaChat, type OllamaChatMessage } from '../ollama/ollama.client.js';
import { webSearch, formatSearchContext } from '../search/search.service.js';

export type ChatStreamEvent = ServerStreamEvent;

export type StreamChatParams = {
  chatId?: number;
  userMessage: string;
  model: string;
  baseUrl: string;
  signal?: AbortSignal;
};

export async function* streamChat(
  params: StreamChatParams,
): AsyncGenerator<ChatStreamEvent> {
  let chatId = params.chatId;

  // 1. Ensure chat exists
  if (chatId == null) {
    const title = params.userMessage.length > 60 
      ? params.userMessage.slice(0, 57) + '...' 
      : params.userMessage;
    const chat = await repo.createChat(title || 'New chat');
    chatId = chat.id;
    yield { type: 'chat_created', chatId };
  } else {
    const existing = await repo.getChat(chatId);
    if (!existing) {
      yield { type: 'error', message: `Chat ${chatId} not found` };
      return;
    }
  }

  // 2. Persist user message
  await repo.appendMessage(chatId, 'user', params.userMessage);

  // 3. Build history and System Prompt
  const history = await repo.listMessages(chatId);
  const today = new Date().toISOString().split('T')[0];
  
  const systemPrompt: OllamaChatMessage = {
    role: 'system',
    content: `You are a helpful assistant. Today's date is ${today}.
You have access to a web search tool. You MUST use the tool if the user asks about current events, live data, prices, versions, or facts that may have changed recently.
If the user asks a follow-up question (like "in india" or "check again"), look at the chat history to understand the context.
Do NOT guess or use training data for real-time information; use the web_search tool instead.`
  };

  const ollamaMessages: OllamaChatMessage[] = [
    systemPrompt,
    ...history.map(m => ({ role: m.role as any, content: m.content }))
  ];

  // Define the Web Search Tool
  const webSearchTool = {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information. Use this for news, current versions, sports scores, or facts you do not know.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { 
            type: 'string', 
            description: 'The search query to look up. Be specific and include context from the chat history if needed.' 
          }
        }
      }
    }
  };

  let assistantText = '';
  let currentTools = [webSearchTool];

  try {
    // --- AGENT LOOP ---
    let loopCount = 0;
    const MAX_LOOPS = 3;

    while (loopCount < MAX_LOOPS) {
      loopCount++;
      let hasToolCall = false;
      let currentAssistantMessage: OllamaChatMessage = { role: 'assistant', content: '', tool_calls: [] };
      
      for await (const chunk of streamOllamaChat(
        params.baseUrl,
        ollamaMessages,
        params.model,
        params.signal,
        currentTools
      )) {
        if (chunk.type === 'token') {
          if (!hasToolCall) {
            assistantText += chunk.text;
            currentAssistantMessage.content += chunk.text;
            yield { type: 'token', text: chunk.text };
          }
        } else if (chunk.type === 'tool_calls') {
          hasToolCall = true;
          currentAssistantMessage.tool_calls = chunk.toolCalls;
        }
      }

      if (!hasToolCall) break;

      // Process Tool Call
      ollamaMessages.push(currentAssistantMessage);
      
      const toolCall = currentAssistantMessage.tool_calls![0];
      const searchQuery = toolCall.function.arguments.query;
      
      yield { type: 'token', text: `\n\n*(Searching the web for: "${searchQuery}"...)*\n\n` };

      // Execute search
      const searchResults = await webSearch(searchQuery, 5, params.signal);
      const searchContext = formatSearchContext(searchResults);

      // 👇 YIELD FULL SOURCES INCLUDING THUMBNAILS
      if (searchResults.length > 0) {
        yield { 
          type: 'sources', 
          sources: searchResults.map(r => ({ 
            title: r.title, 
            url: r.url, 
            snippet: r.snippet,
            publishedDate: r.publishedDate,
            thumbnail: r.thumbnail || '',
          })) 
        };
      }

      ollamaMessages.push({
        role: 'tool',
        content: searchContext || 'No results found.',
      });
      
      // Disable tool for next pass so it writes the final answer
      currentTools = []; 
    }

    const saved = await repo.appendMessage(chatId, 'assistant', assistantText);
    await repo.touchChat(chatId);
    yield { type: 'done', chatId, assistantMessageId: saved.id };

  } catch (err) {
    yield { type: 'error', message: (err as Error).message };
    if (assistantText.length > 0) {
      const saved = await repo.appendMessage(chatId, 'assistant', assistantText);
      await repo.touchChat(chatId);
      yield { type: 'done', chatId, assistantMessageId: saved.id };
    }
    return;
  }
}