// AI agent — sends user messages to Anthropic via the proxy worker,
// handles tool-use loops, and executes tool calls against the board.
// Supports streaming responses with extended thinking.

import { AI_PROXY_URL } from './config.js';
import { TOOLS } from './tools.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { executeTool } from './executor.js';
import { parseStream } from './streamParser.js';

const MAX_TOOL_ROUNDS = 40;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const parseRetryAfter = (response) => {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return null;
};

const buildRequestBody = (messages, systemPrompt) => ({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,
  system: systemPrompt,
  tools: TOOLS,
  messages,
  thinking: { type: 'enabled', budget_tokens: 10000 },
  stream: true,
});

const callProxyStream = async (messages, systemPrompt, onProgress, streamCallbacks, traceContext) => {
  const fullContext = traceContext ? { ...traceContext, callType: 'conversation' } : { callType: 'conversation' };
  const body = JSON.stringify(buildRequestBody(messages, systemPrompt));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-Context': JSON.stringify(fullContext),
      },
      body,
    });

    if ((response.status === 429 || response.status === 529) && attempt < MAX_RETRIES) {
      const retryMs = parseRetryAfter(response) || (2 ** attempt) * 60000;
      const waitSec = Math.ceil(retryMs / 1000);
      onProgress?.({ phase: 'rate_limited', waitSec });
      await sleep(retryMs);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI proxy error ${response.status}: ${text}`);
    }

    return parseStream(response, streamCallbacks);
  }
};

// Non-streaming fallback for tests and simple cases
const callProxy = async (messages, systemPrompt, onProgress, traceContext) => {
  const fullContext = traceContext ? { ...traceContext, callType: 'conversation' } : { callType: 'conversation' };
  const reqBody = buildRequestBody(messages, systemPrompt);
  delete reqBody.stream;
  delete reqBody.thinking;
  reqBody.max_tokens = 4096;
  const body = JSON.stringify(reqBody);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-Context': JSON.stringify(fullContext),
      },
      body,
    });

    if ((response.status === 429 || response.status === 529) && attempt < MAX_RETRIES) {
      const retryMs = parseRetryAfter(response) || (2 ** attempt) * 60000;
      const waitSec = Math.ceil(retryMs / 1000);
      onProgress?.({ phase: 'rate_limited', waitSec });
      await sleep(retryMs);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI proxy error ${response.status}: ${text}`);
    }

    return response.json();
  }
};

export const extractTextContent = (response) => {
  if (!response?.content) return '';
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
};

export const extractToolUseBlocks = (response) => {
  if (!response?.content) return [];
  return response.content.filter((block) => block.type === 'tool_use');
};

export const runAgent = async (userMessage, operations, onProgress, viewportContext, conversationHistory = [], onToolCall, onStream, traceContext) => {
  const messages = [...conversationHistory, { role: 'user', content: userMessage }];
  const systemPrompt = buildSystemPrompt(viewportContext);
  let textReply = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    onProgress?.({ phase: 'calling', round });

    let response;

    if (onStream) {
      const streamCallbacks = {
        onThinking: (delta) => onStream({ type: 'thinking', delta }),
        onText: (delta) => onStream({ type: 'text', delta }),
        onToolStart: (_index, _id, name) => onStream({ type: 'toolStart', name }),
        onToolEnd: () => onStream({ type: 'toolEnd' }),
        onStop: () => onStream({ type: 'done' }),
      };
      response = await callProxyStream(messages, systemPrompt, onProgress, streamCallbacks, traceContext);
    } else {
      response = await callProxy(messages, systemPrompt, onProgress, traceContext);
    }

    console.log(`[AI Agent] Round ${round}, stop_reason: ${response.stop_reason}, content blocks: ${response.content?.length}`);

    textReply = extractTextContent(response) || textReply;

    const toolBlocks = extractToolUseBlocks(response);
    if (toolBlocks.length === 0 || response.stop_reason === 'end_turn') {
      break;
    }

    // Signal end of thinking/text when entering tool execution
    onStream?.({ type: 'done' });

    // Strip thinking blocks — they lack the signature field when reconstructed
    // from streaming, and the API ignores them from prior turns anyway.
    const contentForHistory = response.content.filter((b) => b.type !== 'thinking');
    messages.push({ role: 'assistant', content: contentForHistory });

    const toolResults = [];
    for (const block of toolBlocks) {
      onProgress?.({ phase: 'executing', tool: block.name, round });
      let result;
      try {
        result = await executeTool(block.name, block.input, operations, traceContext, onStream);
      } catch (err) {
        console.error(`[AI Agent] Tool ${block.name} threw:`, err);
        result = { ok: false, error: err.message || 'Unknown tool error' };
      }
      onToolCall?.(block.name, block.input, result);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return { text: textReply, messages };
};
