import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { apiHistoryToDisplay, useAiAgent } from './useAiAgent.js';

// --- Firebase mocks ---
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockPush = vi.fn();
const mockOnValue = vi.fn();

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => 'mock-ref'),
  get: (...args) => mockGet(...args),
  set: (...args) => mockSet(...args),
  update: (...args) => mockUpdate(...args),
  push: (...args) => mockPush(...args),
  onValue: (...args) => mockOnValue(...args),
  query: vi.fn(() => 'mock-query'),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
}));

// --- runAgent mock ---
const mockRunAgent = vi.fn();
vi.mock('../ai/agent.js', () => ({
  runAgent: (...args) => mockRunAgent(...args),
}));

const makeProps = (overrides = {}) => ({
  objects: {},
  createObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
  viewport: null,
  cursors: null,
  userId: 'user-1',
  userName: 'Test User',
  boardName: 'test-board',
  selectedIds: new Set(),
  ...overrides,
});

describe('useAiAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: conversation list listener returns nothing
    mockOnValue.mockImplementation((_ref, cb) => {
      cb({ val: () => null });
      return vi.fn();
    });
    // Default: push returns a key
    mockPush.mockReturnValue({ key: 'conv-1' });
    // Default: set/update resolve
    mockSet.mockResolvedValue();
    mockUpdate.mockResolvedValue();
  });

  describe('apiHistoryToDisplay', () => {
    it('maps API history entries to display messages', () => {
      const apiMessages = [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Working on it' },
            { type: 'tool_use', id: 'tool-1', name: 'deleteObject', input: { objectId: 'x' } },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: '{"ok":false,"error":"Nope"}' }],
        },
      ];

      const display = apiHistoryToDisplay(apiMessages);

      expect(display).toEqual([
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Working on it' },
        { role: 'tool', text: 'Deleted object', ok: false },
      ]);
    });
  });

  describe('submit - simple text reply (no tools)', () => {
    it('shows user message and assistant reply in displayMessages', async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: 'Hello back!',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hello back!' },
        ],
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Hello');
      });

      const msgs = result.current.displayMessages;
      expect(msgs).toHaveLength(2);
      expect(msgs[0]).toEqual({ role: 'user', text: 'Hello' });
      expect(msgs[1]).toEqual({ role: 'assistant', text: 'Hello back!' });
    });

    it('stores full API-format messages in history passed to runAgent', async () => {
      const apiMessages = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Reply 1' },
      ];
      mockRunAgent.mockResolvedValueOnce({ text: 'Reply 1', messages: apiMessages });

      const apiMessages2 = [
        ...apiMessages,
        { role: 'user', content: 'Second' },
        { role: 'assistant', content: 'Reply 2' },
      ];
      mockRunAgent.mockResolvedValueOnce({ text: 'Reply 2', messages: apiMessages2 });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('First');
      });

      await act(async () => {
        await result.current.submit('Second');
      });

      // Second call should receive the full API history from first call
      const secondCallHistory = mockRunAgent.mock.calls[1][4];
      expect(secondCallHistory).toEqual(apiMessages);
    });

    it('appends final assistant text when missing from API history', async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: 'Final reply',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Hello');
      });

      expect(result.current.displayMessages).toEqual([
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Final reply' },
      ]);

      const persistedData = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][1];
      expect(persistedData.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Final reply' },
      ]);
    });

    it('does not duplicate assistant text if already in API history', async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: 'Echo',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Echo' },
        ],
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Hi');
      });

      const persistedData = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][1];
      expect(persistedData.messages).toEqual([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Echo' },
      ]);
    });
  });

  describe('submit - with tool calls', () => {
    it('preserves tool_use/tool_result blocks in API history across turns', async () => {
      const toolUseBlock = { type: 'tool_use', id: 'tu1', name: 'createObject', input: { type: 'sticky' } };
      const toolResultBlock = { type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true,"objectId":"obj-1","type":"sticky"}' };

      const turn1Messages = [
        { role: 'user', content: 'Create a sticky' },
        { role: 'assistant', content: [toolUseBlock] },
        { role: 'user', content: [toolResultBlock] },
        { role: 'assistant', content: 'Created!' },
      ];
      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall) => {
        onToolCall?.('createObject', { type: 'sticky' }, { ok: true, objectId: 'obj-1', type: 'sticky' });
        return { text: 'Created!', messages: turn1Messages };
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Create a sticky');
      });

      // Now verify history passed to next turn includes tool blocks
      const turn2Messages = [
        ...turn1Messages,
        { role: 'user', content: 'Fit the frame' },
        { role: 'assistant', content: 'Done!' },
      ];
      mockRunAgent.mockResolvedValueOnce({ text: 'Done!', messages: turn2Messages });

      await act(async () => {
        await result.current.submit('Fit the frame');
      });

      const historyForTurn2 = mockRunAgent.mock.calls[1][4];
      // Should contain the tool_use and tool_result blocks from turn 1
      expect(historyForTurn2).toEqual(turn1Messages);
      const hasToolResult = historyForTurn2.some(
        (m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_result'),
      );
      expect(hasToolResult).toBe(true);
    });

    it('shows tool call summaries in displayMessages', async () => {
      const apiMessages = [
        { role: 'user', content: 'Make a note' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tu1', name: 'createObject', input: { type: 'sticky', text: 'Hello' } }],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true,"objectId":"obj-1"}' }],
        },
        { role: 'assistant', content: 'Created!' },
      ];

      mockRunAgent.mockResolvedValueOnce({
        text: 'Created!',
        messages: apiMessages,
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Make a note');
      });

      const msgs = result.current.displayMessages;
      const toolMsg = msgs.find((m) => m.role === 'tool');
      expect(toolMsg).toBeDefined();
      expect(toolMsg.text).toContain('Created');
      expect(toolMsg.ok).toBe(true);
    });

    it('marks failed tool calls as not ok', async () => {
      const apiMessages = [
        { role: 'user', content: 'Delete x' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tu1', name: 'deleteObject', input: { objectId: 'x' } }],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":false,"error":"Not found"}' }],
        },
        { role: 'assistant', content: 'Failed' },
      ];

      mockRunAgent.mockResolvedValueOnce({
        text: 'Failed',
        messages: apiMessages,
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Delete x');
      });

      const toolMsg = result.current.displayMessages.find((m) => m.role === 'tool');
      expect(toolMsg.ok).toBe(false);
    });

    it('does not duplicate tool summaries already resolved via handleToolCall', async () => {
      const apiMessages = [
        { role: 'user', content: 'Create' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tu1', name: 'createObject', input: { type: 'sticky' } }],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true,"objectId":"obj-1"}' }],
        },
        { role: 'assistant', content: 'Done!' },
      ];

      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall, onStream) => {
        // Simulate streaming: toolStart, then toolEnd, then handleToolCall
        onStream?.({ type: 'toolStart', name: 'createObject' });
        onToolCall?.('createObject', { type: 'sticky' }, { ok: true, objectId: 'obj-1' });
        return {
          text: 'Done!',
          messages: apiMessages,
        };
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Create');
      });

      const toolMsgs = result.current.displayMessages.filter((m) => m.role === 'tool');
      // Should have exactly one tool message, not duplicated
      expect(toolMsgs).toHaveLength(1);
      expect(toolMsgs[0].pending).toBeUndefined();
    });

    it('keeps final assistant text when tool history stops at tool_result', async () => {
      const apiMessages = [
        { role: 'user', content: 'Create' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tu1', name: 'createObject', input: { type: 'sticky' } }],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true,"objectId":"obj-1"}' }],
        },
      ];

      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall, onStream) => {
        onStream?.({ type: 'toolStart', name: 'createObject' });
        onToolCall?.('createObject', { type: 'sticky' }, { ok: true, objectId: 'obj-1' });
        onStream?.({ type: 'done' });
        return {
          text: 'Created!',
          messages: apiMessages,
        };
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Create');
      });

      expect(result.current.displayMessages.some((msg) => msg.text === 'Created!')).toBe(true);

      const persistedData = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][1];
      expect(persistedData.messages).toEqual([
        ...apiMessages,
        { role: 'assistant', content: 'Created!' },
      ]);
    });

    it('shows pending tool label during tool execution', async () => {
      let resolveRunAgent;
      const runAgentPromise = new Promise((resolve) => {
        resolveRunAgent = resolve;
      });

      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, _onToolCall, onStream) => {
        onStream?.({ type: 'toolStart', name: 'createObject' });
        return runAgentPromise;
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      let submitPromise;
      await act(async () => {
        submitPromise = result.current.submit('Create');
        await Promise.resolve();
      });

      expect(result.current.displayMessages).toEqual([
        { role: 'user', text: 'Create' },
        { role: 'tool', text: 'Creating…', pending: true },
      ]);

      await act(async () => {
        resolveRunAgent({
          text: 'Created',
          messages: [
            { role: 'user', content: 'Create' },
            { role: 'assistant', content: 'Created' },
          ],
        });
        await submitPromise;
      });
    });

    it('replaces pending tool label with summary on tool call', async () => {
      let resolveRunAgent;
      const runAgentPromise = new Promise((resolve) => {
        resolveRunAgent = resolve;
      });

      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall, onStream) => {
        onStream?.({ type: 'toolStart', name: 'deleteObject' });
        onToolCall?.('deleteObject', { objectId: 'x' }, { ok: false, error: 'Not found' });
        return runAgentPromise;
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      let submitPromise;
      await act(async () => {
        submitPromise = result.current.submit('Delete');
        await Promise.resolve();
      });

      expect(result.current.displayMessages).toEqual([
        { role: 'user', text: 'Delete' },
        { role: 'tool', text: 'Deleted object', ok: false },
      ]);

      await act(async () => {
        resolveRunAgent({
          text: 'Failed',
          messages: [
            { role: 'user', content: 'Delete' },
            { role: 'assistant', content: 'Failed' },
          ],
        });
        await submitPromise;
      });
    });
  });

  describe('submit - user message persistence', () => {
    it('user message is visible in displayMessages after submit completes', async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: 'Reply',
        messages: [
          { role: 'user', content: 'My message' },
          { role: 'assistant', content: 'Reply' },
        ],
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('My message');
      });

      const userMsgs = result.current.displayMessages.filter((m) => m.role === 'user');
      expect(userMsgs).toHaveLength(1);
      expect(userMsgs[0].text).toBe('My message');
    });

    it('user messages survive across multiple submits', async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: 'Reply 1',
        messages: [{ role: 'user', content: 'Msg 1' }, { role: 'assistant', content: 'Reply 1' }],
      });
      mockRunAgent.mockResolvedValueOnce({
        text: 'Reply 2',
        messages: [
          { role: 'user', content: 'Msg 1' },
          { role: 'assistant', content: 'Reply 1' },
          { role: 'user', content: 'Msg 2' },
          { role: 'assistant', content: 'Reply 2' },
        ],
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Msg 1');
      });

      await act(async () => {
        await result.current.submit('Msg 2');
      });

      const userMsgs = result.current.displayMessages.filter((m) => m.role === 'user');
      expect(userMsgs).toHaveLength(2);
      expect(userMsgs[0].text).toBe('Msg 1');
      expect(userMsgs[1].text).toBe('Msg 2');
    });
  });

  describe('submit - error handling', () => {
    it('shows error message when runAgent throws', async () => {
      mockRunAgent.mockRejectedValueOnce(new Error('API is down'));

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Hello');
      });

      const msgs = result.current.displayMessages;
      const errorMsg = msgs.find((m) => m.role === 'assistant' && m.text.includes('Error'));
      expect(errorMsg).toBeDefined();
      expect(errorMsg.text).toContain('API is down');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('submit - Firebase persistence', () => {
    it('persists API messages to Firebase', async () => {
      const apiMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'createObject', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true,"objectId":"obj-1"}' }] },
        { role: 'assistant', content: 'Done' },
      ];

      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall) => {
        onToolCall?.('createObject', { type: 'sticky' }, { ok: true, objectId: 'obj-1' });
        return { text: 'Done', messages: apiMessages };
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Hello');
      });

      // update is called to persist the conversation
      expect(mockUpdate).toHaveBeenCalled();
      const persistedData = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][1];
      // messages should be API-format (includes tool_use/tool_result)
      expect(persistedData.messages).toEqual(apiMessages);
      expect(persistedData.displayMessages).toBeUndefined();
    });
  });

  describe('loadConversation', () => {
    it('loads API history and derives display from API messages', async () => {
      const apiMessages = [
        { role: 'user', content: 'Create a note' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'createObject', input: { type: 'sticky' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true,"objectId":"obj-1"}' }] },
        { role: 'assistant', content: 'Created!' },
      ];

      mockGet.mockResolvedValueOnce({
        val: () => ({
          messages: apiMessages,
        }),
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.loadConversation('conv-1');
      });

      // Display should show the user, tool, and assistant messages
      const msgs = result.current.displayMessages;
      expect(msgs).toHaveLength(3);
      expect(msgs[0]).toEqual({ role: 'user', text: 'Create a note' });
      expect(msgs[1].role).toBe('tool');
      expect(msgs[1].text).toContain('Created');
      expect(msgs[1].ok).toBe(true);
      expect(msgs[2]).toEqual({ role: 'assistant', text: 'Created!' });

      // Submit should pass full API history (including tool blocks) to runAgent
      mockRunAgent.mockResolvedValueOnce({
        text: 'Next reply',
        messages: [...apiMessages, { role: 'user', content: 'Follow up' }, { role: 'assistant', content: 'Next reply' }],
      });

      await act(async () => {
        await result.current.submit('Follow up');
      });

      const historyPassedToApi = mockRunAgent.mock.calls[0][4];
      expect(historyPassedToApi).toEqual(apiMessages);
    });
  });

  describe('startNewConversation', () => {
    it('clears history and display messages', async () => {
      mockRunAgent.mockResolvedValueOnce({
        text: 'Reply',
        messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Reply' }],
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Hello');
      });

      expect(result.current.displayMessages).toHaveLength(2);

      act(() => {
        result.current.startNewConversation();
      });

      expect(result.current.displayMessages).toHaveLength(0);

      // Next submit should pass empty history
      mockRunAgent.mockResolvedValueOnce({
        text: 'Fresh reply',
        messages: [{ role: 'user', content: 'New' }, { role: 'assistant', content: 'Fresh reply' }],
      });

      await act(async () => {
        await result.current.submit('New');
      });

      const historyPassedToApi = mockRunAgent.mock.calls[1][4];
      expect(historyPassedToApi).toEqual([]);
    });
  });

  describe('streaming events', () => {
    it('shows streaming text during response', async () => {
      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, _onToolCall, onStream) => {
        onStream?.({ type: 'text', delta: 'Hel' });
        onStream?.({ type: 'text', delta: 'lo' });
        return {
          text: 'Hello',
          messages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }],
        };
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Hi');
      });

      // After submit completes, streaming text should be cleared
      expect(result.current.streamingText).toBe('');
      expect(result.current.isLoading).toBe(false);
    });

    it('commits streaming text when a tool starts', async () => {
      let resolveRunAgent;
      const runAgentPromise = new Promise((resolve) => {
        resolveRunAgent = resolve;
      });

      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, _onToolCall, onStream) => {
        onStream?.({ type: 'text', delta: 'Working' });
        onStream?.({ type: 'toolStart', name: 'getBoardState' });
        return runAgentPromise;
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      let submitPromise;
      await act(async () => {
        submitPromise = result.current.submit('Read');
        await Promise.resolve();
      });

      expect(result.current.displayMessages).toEqual([
        { role: 'user', text: 'Read' },
        { role: 'assistant', text: 'Working' },
        { role: 'tool', text: 'Reading board…', pending: true },
      ]);

      await act(async () => {
        resolveRunAgent({
          text: 'Done',
          messages: [
            { role: 'user', content: 'Read' },
            { role: 'assistant', content: 'Done' },
          ],
        });
        await submitPromise;
      });
    });

    it('commits streaming text when streaming ends without tools', async () => {
      let resolveRunAgent;
      const runAgentPromise = new Promise((resolve) => {
        resolveRunAgent = resolve;
      });

      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, _onToolCall, onStream) => {
        onStream?.({ type: 'text', delta: 'Final' });
        onStream?.({ type: 'done' });
        return runAgentPromise;
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      let submitPromise;
      await act(async () => {
        submitPromise = result.current.submit('Ping');
        await Promise.resolve();
      });

      expect(result.current.displayMessages).toEqual([
        { role: 'user', text: 'Ping' },
        { role: 'assistant', text: 'Final' },
      ]);

      await act(async () => {
        resolveRunAgent({
          text: 'Final',
          messages: [
            { role: 'user', content: 'Ping' },
            { role: 'assistant', content: 'Final' },
          ],
        });
        await submitPromise;
      });
    });
  });
});
