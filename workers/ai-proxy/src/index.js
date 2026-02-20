// Cloudflare Worker — AI proxy for CollabBoard
// Forwards requests to Anthropic API without exposing the key to the client.

import { Langfuse } from 'langfuse';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Trace-Context',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!env.LANGFUSE_SECRET_KEY || !env.LANGFUSE_PUBLIC_KEY) {
      return new Response(JSON.stringify({ error: 'Langfuse keys not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const langfuse = new Langfuse({
      secretKey: env.LANGFUSE_SECRET_KEY,
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    });

    const waitUntil = ctx?.waitUntil?.bind(ctx);

    try {
      const body = await request.json();
      const isStreaming = body.stream === true;

      // Parse trace context from client header
      let traceContext = {};
      const traceHeader = request.headers.get('X-Trace-Context');
      if (traceHeader) {
        try {
          traceContext = JSON.parse(traceHeader);
        } catch {
          traceContext = {};
        }
      }

      const trace = langfuse.trace({
        name: 'ai-proxy-request',
        sessionId: traceContext.sessionId || undefined,
        userId: traceContext.userId || undefined,
        metadata: {
          userName: traceContext.userName || undefined,
          boardName: traceContext.boardName || undefined,
          streaming: isStreaming,
          callType: traceContext.callType || undefined,
          toolName: traceContext.toolName || undefined,
        },
      });

      const generation = trace.generation({
        name: 'anthropic-messages',
        model: body.model || 'unknown',
        input: {
          messageCount: body.messages?.length || 0,
          messages: body.messages || [],
          system: body.system || null,
          tools: body.tools || [],
          thinking: body.thinking || null,
          stream: isStreaming,
        },
        modelParameters: {
          max_tokens: body.max_tokens,
        },
      });

      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };

      if (body.thinking) {
        headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
      }

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (isStreaming) {
        generation.end({
          output: '(streaming response)',
          statusMessage: `HTTP ${anthropicResponse.status}`,
          level: anthropicResponse.status === 200 ? 'DEFAULT' : 'ERROR',
        });
        waitUntil?.(langfuse.flushAsync());

        return new Response(anthropicResponse.body, {
          status: anthropicResponse.status,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      const data = await anthropicResponse.json();
      const toolCalls = data.content
        ? data.content.filter((block) => block.type === 'tool_use').map((block) => block.name)
        : [];
      const usage = data.usage
        ? { input: data.usage.input_tokens, output: data.usage.output_tokens }
        : undefined;

      generation.end({
        output: {
          stop_reason: data.stop_reason,
          tool_calls: toolCalls,
          content: data.content || [],
        },
        statusMessage: `HTTP ${anthropicResponse.status}`,
        level: anthropicResponse.status === 200 ? 'DEFAULT' : 'ERROR',
        ...(usage ? { usage } : {}),
      });
      waitUntil?.(langfuse.flushAsync());

      return new Response(JSON.stringify(data), {
        status: anthropicResponse.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      langfuse.trace({
        name: 'ai-proxy-error',
        level: 'ERROR',
        metadata: { error: error.message },
      });
      waitUntil?.(langfuse.flushAsync());

      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
