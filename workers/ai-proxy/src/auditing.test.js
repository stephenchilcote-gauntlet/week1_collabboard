import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerationEnd = vi.fn();
const mockGeneration = vi.fn();
const mockTrace = vi.fn();
const mockFlush = vi.fn();

vi.mock('langfuse', () => ({
  Langfuse: vi.fn(function LangfuseMock() {
    return { trace: mockTrace, flushAsync: mockFlush };
  }),
}));

import worker from './index.js';

const env = {
  ANTHROPIC_API_KEY: '[REDACTED:api-key]',
  LANGFUSE_SECRET_KEY: 'sk-lf-test',
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
};

const makeRequest = (body) =>
  new Request('https://worker.test/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeMockCtx = () => ({ waitUntil: vi.fn() });

const stubFetch = (responseBody, status = 200) => {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }))
  ));
};

describe('Langfuse auditing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockTrace.mockClear();
    mockGeneration.mockClear();
    mockGenerationEnd.mockClear();
    mockFlush.mockClear();
    mockTrace.mockReturnValue({ generation: mockGeneration });
    mockGeneration.mockReturnValue({ end: mockGenerationEnd });
  });

  it('returns 500 when LANGFUSE_SECRET_KEY is missing', async () => {
    const res = await worker.fetch(
      makeRequest({ model: 'test', messages: [] }),
      { ANTHROPIC_API_KEY: '[REDACTED:api-key]' },
      makeMockCtx(),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Langfuse');
  });

  it('returns 500 when LANGFUSE_PUBLIC_KEY is missing', async () => {
    const res = await worker.fetch(
      makeRequest({ model: 'test', messages: [] }),
      { ANTHROPIC_API_KEY: 'sk-ant-test', LANGFUSE_SECRET_KEY: 'sk-lf-test' },
      makeMockCtx(),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Langfuse');
  });

  it('creates a trace for each request', async () => {
    stubFetch({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi' }], usage: { input_tokens: 10, output_tokens: 5 } });
    const ctx = makeMockCtx();
    await worker.fetch(makeRequest({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    }), env, ctx);

    expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({ name: 'ai-proxy-request' }));
  });

  it('creates a generation span with model and tool names', async () => {
    stubFetch({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi' }], usage: { input_tokens: 10, output_tokens: 5 } });
    const ctx = makeMockCtx();
    await worker.fetch(makeRequest({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ name: 'createObject' }, { name: 'deleteObject' }],
    }), env, ctx);

    expect(mockGeneration).toHaveBeenCalledWith(expect.objectContaining({
      name: 'anthropic-messages',
      model: 'claude-sonnet-4-5-20250929',
    }));
    const genCall = mockGeneration.mock.calls[0][0];
    expect(genCall.input.tools).toEqual(['createObject', 'deleteObject']);
  });

  it('records token usage on generation end', async () => {
    stubFetch({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done' }], usage: { input_tokens: 150, output_tokens: 42 } });
    const ctx = makeMockCtx();
    await worker.fetch(makeRequest({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Test' }],
    }), env, ctx);

    expect(mockGenerationEnd).toHaveBeenCalledWith(expect.objectContaining({
      usage: { input: 150, output: 42 },
    }));
  });

  it('records tool_use calls in generation output', async () => {
    stubFetch({
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: 'Creating...' },
        { type: 'tool_use', id: 'tu1', name: 'createObject', input: {} },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const ctx = makeMockCtx();
    await worker.fetch(makeRequest({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Create a note' }],
    }), env, ctx);

    const endCall = mockGenerationEnd.mock.calls[0][0];
    expect(endCall.output.tool_calls).toEqual(['createObject']);
    expect(endCall.output.stop_reason).toBe('tool_use');
  });

  it('sets ERROR level when Anthropic returns non-200', async () => {
    stubFetch({ error: { message: 'Rate limited' } }, 429);
    const ctx = makeMockCtx();
    await worker.fetch(makeRequest({
      model: 'test',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Test' }],
    }), env, ctx);

    expect(mockGenerationEnd).toHaveBeenCalledWith(expect.objectContaining({
      level: 'ERROR',
      statusMessage: 'HTTP 429',
    }));
  });

  it('flushes Langfuse via ctx.waitUntil', async () => {
    stubFetch({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ok' }], usage: { input_tokens: 5, output_tokens: 2 } });
    const ctx = makeMockCtx();
    await worker.fetch(makeRequest({
      model: 'test',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Test' }],
    }), env, ctx);

    expect(ctx.waitUntil).toHaveBeenCalled();
    expect(mockFlush).toHaveBeenCalledOnce();
  });

  it('traces errors when request processing throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network down'))));
    const ctx = makeMockCtx();
    const res = await worker.fetch(makeRequest({ model: 'test', messages: [] }), env, ctx);

    expect(res.status).toBe(500);
    expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({
      name: 'ai-proxy-error',
      level: 'ERROR',
      metadata: { error: 'Network down' },
    }));
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('flushes on streaming responses too', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"message_start"}\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(stream, { status: 200 }))));

    const ctx = makeMockCtx();
    await worker.fetch(makeRequest({
      model: 'test',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Stream' }],
      stream: true,
    }), env, ctx);

    expect(mockGenerationEnd).toHaveBeenCalledWith(expect.objectContaining({
      output: '(streaming response)',
    }));
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('passes X-Trace-Context header data to Langfuse trace', async () => {
    stubFetch({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi' }], usage: { input_tokens: 10, output_tokens: 5 } });
    const traceContext = { sessionId: 'conv-123', userId: 'user-456', userName: 'Alice', boardName: 'my-board' };
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Trace-Context': JSON.stringify(traceContext) },
      body: JSON.stringify({ model: 'test', max_tokens: 100, messages: [{ role: 'user', content: 'Hi' }] }),
    });
    const ctx = makeMockCtx();
    await worker.fetch(req, env, ctx);

    expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'conv-123',
      userId: 'user-456',
      metadata: expect.objectContaining({ userName: 'Alice', boardName: 'my-board' }),
    }));
  });
});
