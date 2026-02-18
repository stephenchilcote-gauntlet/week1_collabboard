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
  ANTHROPIC_API_KEY: 'sk-ant-test-key',
  LANGFUSE_SECRET_KEY: 'sk-lf-test',
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
};

const makeRequest = (method, body) =>
  new Request('https://worker.test/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const makeMockCtx = () => ({ waitUntil: vi.fn() });

describe('ai-proxy worker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockTrace.mockClear();
    mockFlush.mockClear();
    mockGeneration.mockClear();
    mockGenerationEnd.mockClear();
    mockTrace.mockReturnValue({ generation: mockGeneration });
    mockGeneration.mockReturnValue({ end: mockGenerationEnd });
  });

  it('responds to OPTIONS with CORS headers (preflight)', async () => {
    const res = await worker.fetch(new Request('https://worker.test/', { method: 'OPTIONS' }), env, makeMockCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('rejects non-POST methods with 405', async () => {
    const res = await worker.fetch(new Request('https://worker.test/'), env, makeMockCtx());
    expect(res.status).toBe(405);
    const data = await res.json();
    expect(data.error).toBe('Method not allowed');
  });

  it('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    const res = await worker.fetch(makeRequest('POST', { model: 'test' }), {}, makeMockCtx());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('ANTHROPIC_API_KEY');
  });

  it('forwards request to Anthropic and returns response', async () => {
    const mockAnthropicResponse = {
      id: 'msg_test',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-20250514',
      role: 'assistant',
    };

    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (url === 'https://api.anthropic.com/v1/messages') {
        return Promise.resolve(new Response(JSON.stringify(mockAnthropicResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      // Fall through for the worker's own request parsing
      return Promise.resolve(new Response('unexpected', { status: 500 }));
    }));

    // We need to re-import because the worker uses the global fetch internally.
    // Instead, call the handler directly — it uses the global fetch for Anthropic.
    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Say hello' }],
    };

    const res = await worker.fetch(makeRequest('POST', requestBody), env, makeMockCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Content-Type')).toBe('application/json');

    const data = await res.json();
    expect(data.content[0].text).toBe('Hello!');

    // Verify the Anthropic request was made correctly
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.anthropic.com/v1/messages');
    expect(fetchCall[1].headers['x-api-key']).toBe('sk-ant-test-key');
    expect(fetchCall[1].headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(fetchCall[1].body)).toEqual(requestBody);
  });

  it('passes through Anthropic error status codes', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ error: { message: 'Invalid model' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }))
    ));

    const res = await worker.fetch(makeRequest('POST', { model: 'bad' }), env, makeMockCtx());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toBe('Invalid model');
  });

  it('returns 500 on malformed JSON body', async () => {
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const res = await worker.fetch(req, env, makeMockCtx());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it('includes CORS headers on all responses', async () => {
    // 405 response
    const res1 = await worker.fetch(new Request('https://worker.test/'), env, makeMockCtx());
    expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('*');

    // 500 response (no key)
    const res2 = await worker.fetch(makeRequest('POST', {}), {}, makeMockCtx());
    expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
