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

const mockJwtVerify = vi.fn();
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: (...args) => mockJwtVerify(...args),
}));

import worker from './index.js';

const env = {
  ANTHROPIC_API_KEY: 'sk-ant-test-key',
  LANGFUSE_SECRET_KEY: 'sk-lf-test',
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
  FIREBASE_PROJECT_ID: 'test-project',
};

const makeRequest = (method, body) =>
  new Request('https://worker.test/', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer valid-firebase-token',
    },
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
    mockJwtVerify.mockClear();
    mockTrace.mockReturnValue({ generation: mockGeneration });
    mockGeneration.mockReturnValue({ end: mockGenerationEnd });
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'test-uid-123' } });
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
    const envNoKey = { ...env };
    delete envNoKey.ANTHROPIC_API_KEY;
    const res = await worker.fetch(makeRequest('POST', { model: 'test' }), envNoKey, makeMockCtx());
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
      return Promise.resolve(new Response('unexpected', { status: 500 }));
    }));

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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-firebase-token',
      },
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

    // 500 response (no Anthropic key)
    const envNoKey = { ...env };
    delete envNoKey.ANTHROPIC_API_KEY;
    const res2 = await worker.fetch(makeRequest('POST', {}), envNoKey, makeMockCtx());
    expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test' }),
    });
    const res = await worker.fetch(req, env, makeMockCtx());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns 401 when Firebase token verification fails', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('token expired'));
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer expired-token',
      },
      body: JSON.stringify({ model: 'test' }),
    });
    const res = await worker.fetch(req, env, makeMockCtx());
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Invalid or expired');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('verifies token with correct issuer and audience', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ content: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    ));

    await worker.fetch(makeRequest('POST', { model: 'test' }), env, makeMockCtx());

    expect(mockJwtVerify).toHaveBeenCalledOnce();
    const [token, , options] = mockJwtVerify.mock.calls[0];
    expect(token).toBe('valid-firebase-token');
    expect(options.issuer).toBe('https://securetoken.google.com/test-project');
    expect(options.audience).toBe('test-project');
  });

  it('skips auth when FIREBASE_PROJECT_ID is not set', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ content: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    ));

    const envNoProject = { ...env };
    delete envNoProject.FIREBASE_PROJECT_ID;
    const req = new Request('https://worker.test/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test' }),
    });
    const res = await worker.fetch(req, envNoProject, makeMockCtx());
    expect(res.status).toBe(200);
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });
});
