import type { ServerStreamEvent } from '@local-ollama/shared';
import * as repo from './chat.repo.js';
import { streamOllamaChat, type OllamaChatMessage } from '../ollama/ollama.client.js';
import { webSearch, formatSearchContext, fetchUrlContent } from '../search/search.service.js';

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
    content: `You are a helpful search assistant. Today's date is ${today}.

### GUIDELINES:
1. **GREETINGS & GENERAL CHAT**: If the user says "Hello", "Hi", or asks a general programming/math question, answer them normally using your own knowledge.
2. **FACTUAL QUERIES**: If the user asks about current events, news, live data, or specific people/companies, rely ONLY on the provided search results and full page content.
3. **NO RESULTS HANDLING**: If you are asked a factual question but the search results are empty, say: "I searched the web but couldn't find current information on that."
4. **CROSS-REFERENCING**: You will receive the full text of the top multiple search results. Cross-reference them to ensure accuracy. If they contradict each other, state the discrepancy.

### CITATIONS (CRITICAL FOR FACTUAL ANSWERS)
- You MUST cite search results directly after the sentence: "The sky is blue[1]."
- Do NOT leave a space between the word and the bracket.
- Do NOT include a separate "References" section at the end.

### FORMATTING
- If the user asks for images/wallpapers and an "Image URL:" is in the results, you MUST render it using Markdown: ![Description](Image_URL).`
  };

  const ollamaMessages: OllamaChatMessage[] = [
    systemPrompt,
    ...history.map(m => ({ role: m.role as any, content: m.content }))
  ];

  // Define Tools
  const webSearchTool = {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information. Use this for news, current versions, sports scores, or images.',
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

  const fetchUrlTool = {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch the full text content of a specific URL. Use this when the user provides a link or asks you to read a specific webpage.',
      parameters: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            description: 'The exact URL to fetch (e.g., https://github.com/...)'
          }
        }
      }
    }
  };

  let assistantText = '';
  let currentTools = [webSearchTool, fetchUrlTool];

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
      const toolName = toolCall.function.name;
      const args = toolCall.function.arguments || {};

      if (toolName === 'web_search') {
        const searchQuery = args.query;

        // GUARD: Block empty or undefined queries
        if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim() === '' || searchQuery === 'undefined') {
          ollamaMessages.push({
            role: 'tool',
            content: 'Search failed: No valid query provided. Please answer the user using your existing knowledge.',
          });
          break;
        }

        yield { type: 'token', text: `\n\n*(Searching the web for: "${searchQuery}"...)*\n\n` };

        const searchResults = await webSearch(searchQuery, 5, params.signal);
        
        let combinedPageContext = '';
        
        // 👇 NEW: Scrape the top 3 results concurrently
        if (searchResults.length > 0) {
          const topResults = searchResults.slice(0, 3);
          yield { type: 'token', text: `\n*(Reading top ${topResults.length} web pages for accurate context...)*\n\n` };
          
          const pagePromises = topResults.map(async (result, index) => {
            if (!result.url) return '';
            const content = await fetchUrlContent(result.url);
            if (content && !content.startsWith('Failed to fetch')) {
              return `\n\n=== FULL CONTENT FROM RESULT [${index + 1}] (${result.url}) ===\n${content}`;
            }
            return '';
          });

          const pages = await Promise.all(pagePromises);
          combinedPageContext = pages.join('');
        }

        const searchContext = formatSearchContext(searchResults);

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

        // Feed snippets + ALL full page content to the AI
        ollamaMessages.push({
          role: 'tool',
          content: (searchContext || 'No results found.') + combinedPageContext,
        });
      } 
      
      else if (toolName === 'fetch_url') {
        const targetUrl = args.url;

        if (!targetUrl || typeof targetUrl !== 'string') {
          ollamaMessages.push({
            role: 'tool',
            content: 'Fetch failed: No valid URL provided.',
          });
          break;
        }

        yield { type: 'token', text: `\n\n*(Reading webpage: "${targetUrl}"...)*\n\n` };

        const pageContent = await fetchUrlContent(targetUrl);

        ollamaMessages.push({
          role: 'tool',
          content: pageContent || 'Could not extract text from that page.',
        });
      }

      // Disable tools for next pass so it writes the final answer
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