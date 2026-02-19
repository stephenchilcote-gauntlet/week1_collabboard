import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiAgent } from './useAiAgent.js';

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
      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall) => {
        onToolCall?.('createObject', { type: 'sticky', text: 'Hello' }, { ok: true, objectId: 'obj-1' });
        return {
          text: 'Created!',
          messages: [{ role: 'user', content: 'Make a note' }],
        };
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
      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall) => {
        onToolCall?.('deleteObject', { objectId: 'x' }, { ok: false, error: 'Not found' });
        return {
          text: 'Failed',
          messages: [{ role: 'user', content: 'Delete x' }],
        };
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.submit('Delete x');
      });

      const toolMsg = result.current.displayMessages.find((m) => m.role === 'tool');
      expect(toolMsg.ok).toBe(false);
    });

    it('does not duplicate tool summaries already resolved via handleToolCall', async () => {
      mockRunAgent.mockImplementationOnce((_msg, _ops, _prog, _vp, _hist, onToolCall, onStream) => {
        // Simulate streaming: toolStart, then toolEnd, then handleToolCall
        onStream?.({ type: 'toolStart', name: 'createObject' });
        onToolCall?.('createObject', { type: 'sticky' }, { ok: true, objectId: 'obj-1' });
        return {
          text: 'Done!',
          messages: [{ role: 'user', content: 'Create' }],
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
    it('persists both API messages and displayMessages to Firebase', async () => {
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
      // displayMessages should be simple strings
      expect(persistedData.displayMessages).toBeDefined();
      expect(persistedData.displayMessages.every((m) => typeof m.content === 'string')).toBe(true);
    });
  });

  describe('loadConversation', () => {
    it('loads API history into historyRef and display from displayMessages', async () => {
      const apiMessages = [
        { role: 'user', content: 'Create a note' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'createObject', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{"ok":true,"objectId":"obj-1"}' }] },
        { role: 'assistant', content: 'Created!' },
      ];
      const displayMsgs = [
        { role: 'user', content: 'Create a note' },
        { role: 'tool', content: 'Created sticky', ok: true },
        { role: 'assistant', content: 'Created!' },
      ];

      mockGet.mockResolvedValueOnce({
        val: () => ({
          messages: apiMessages,
          displayMessages: displayMsgs,
        }),
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.loadConversation('conv-1');
      });

      // Display should show the user, tool, and assistant messages
      const msgs = result.current.displayMessages;
      expect(msgs.some((m) => m.role === 'user')).toBe(true);
      expect(msgs.some((m) => m.role === 'tool')).toBe(true);
      expect(msgs.some((m) => m.role === 'assistant')).toBe(true);

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

    it('falls back to legacy format when displayMessages is absent', async () => {
      const legacyMessages = [
        { role: 'user', content: 'Old message' },
        { role: 'assistant', content: 'Old reply' },
        { role: 'tool', content: 'Created sticky', ok: true },
      ];

      mockGet.mockResolvedValueOnce({
        val: () => ({ messages: legacyMessages }),
      });

      const { result } = renderHook(() => useAiAgent(makeProps()));

      await act(async () => {
        await result.current.loadConversation('conv-old');
      });

      const msgs = result.current.displayMessages;
      // Should show user and assistant (and tool from legacy)
      expect(msgs.some((m) => m.role === 'user')).toBe(true);
      expect(msgs.some((m) => m.role === 'assistant')).toBe(true);
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
  });
});
