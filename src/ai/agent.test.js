import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTextContent, extractToolUseBlocks, runAgent } from './agent.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('extractTextContent', () => {
  it('extracts text from content blocks', () => {
    const response = {
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: '1', name: 'foo', input: {} },
        { type: 'text', text: ' world' },
      ],
    };
    expect(extractTextContent(response)).toBe('Hello\n world');
  });

  it('returns empty string for no content', () => {
    expect(extractTextContent(null)).toBe('');
    expect(extractTextContent({})).toBe('');
    expect(extractTextContent({ content: [] })).toBe('');
  });
});

describe('extractToolUseBlocks', () => {
  it('extracts tool_use blocks', () => {
    const response = {
      content: [
        { type: 'text', text: 'I will create a note.' },
        { type: 'tool_use', id: 'tu1', name: 'createStickyNote', input: { text: 'Hi', x: 0, y: 0 } },
      ],
    };
    const blocks = extractToolUseBlocks(response);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe('createStickyNote');
  });

  it('returns empty array when no tool_use blocks', () => {
    expect(extractToolUseBlocks({ content: [{ type: 'text', text: 'Done' }] })).toEqual([]);
    expect(extractToolUseBlocks(null)).toEqual([]);
  });
});

describe('runAgent', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const makeOps = () => ({
    createObject: vi.fn(async (obj) => obj),
    updateObject: vi.fn(async () => {}),
    deleteObject: vi.fn(async () => {}),
    getObjects: () => ({}),
  });

  it('returns text reply for a simple response with no tool calls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Here is your answer.' }],
      }),
    });

    const ops = makeOps();
    const result = await runAgent('What is on the board?', ops);
    expect(result.text).toBe('Here is your answer.');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('executes tool calls and sends results back', async () => {
    // First call: model wants to use a tool
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Creating a note.' },
          { type: 'tool_use', id: 'tu1', name: 'createObject', input: { type: 'sticky', text: 'Note', x: 100, y: 200 } },
        ],
      }),
    });

    // Second call: model responds with final text
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done! Created a sticky note.' }],
      }),
    });

    const ops = makeOps();
    const result = await runAgent('Create a sticky note saying Note', ops);
    expect(result.text).toBe('Done! Created a sticky note.');
    expect(ops.createObject).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('handles multiple tool calls in a single response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu1', name: 'createObject', input: { type: 'sticky', text: 'A', x: 0, y: 0 } },
          { type: 'tool_use', id: 'tu2', name: 'createObject', input: { type: 'sticky', text: 'B', x: 250, y: 0 } },
        ],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Created two notes.' }],
      }),
    });

    const ops = makeOps();
    const result = await runAgent('Create two sticky notes', ops);
    expect(result.text).toBe('Created two notes.');
    expect(ops.createObject).toHaveBeenCalledTimes(2);
  });

  it('calls onProgress callback during execution', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu1', name: 'getBoardState', input: {} },
        ],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Board is empty.' }],
      }),
    });

    const progress = vi.fn();
    const ops = makeOps();
    await runAgent('What is on the board?', ops, progress);
    expect(progress).toHaveBeenCalled();
    const phases = progress.mock.calls.map((c) => c[0].phase);
    expect(phases).toContain('calling');
    expect(phases).toContain('executing');
  });

  it('throws on HTTP error from proxy', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const ops = makeOps();
    await expect(runAgent('Fail', ops)).rejects.toThrow('AI proxy error 500');
  });

  it('respects MAX_TOOL_ROUNDS limit', async () => {
    // Always return tool_use to test the limit
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu1', name: 'getBoardState', input: {} },
        ],
      }),
    });

    const ops = makeOps();
    await runAgent('Loop forever', ops);
    // MAX_TOOL_ROUNDS is 10, so we get 10 calls
    expect(mockFetch).toHaveBeenCalledTimes(10);
  });
});
