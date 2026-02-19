import { useCallback, useEffect, useRef, useState } from 'react';
import { get, limitToLast, onValue, orderByChild, push, query, ref, set, update } from 'firebase/database';
import { db } from '../firebase/config.js';
import { runAgent } from '../ai/agent.js';
import { screenToBoard } from '../utils/coordinates.js';

const conversationsRef = (boardName) => ref(db, `boards/${boardName}/conversations`);

const saveConversation = (boardName, convId, data) => {
  const convRef = ref(db, `boards/${boardName}/conversations/${convId}`);
  return set(convRef, data);
};

const updateConversation = (boardName, convId, data) => {
  const convRef = ref(db, `boards/${boardName}/conversations/${convId}`);
  return update(convRef, data);
};

const buildDisplayMessages = (history) =>
  history
    .filter((m) => typeof m.content === 'string')
    .map((m) => {
      if (m.role === 'tool') return { role: 'tool', text: m.content, ok: m.ok !== false };
      return { role: m.role, text: m.content };
    });

const TOOL_LABELS = {
  createObject: 'Created',
  updateObject: 'Updated',
  deleteObject: 'Deleted',
  getBoardState: 'Read board',
  fitFrameToObjects: 'Fit frame',
};

const TOOL_PENDING_LABELS = {
  createObject: 'Creating…',
  updateObject: 'Updating…',
  deleteObject: 'Deleting…',
  getBoardState: 'Reading board…',
  fitFrameToObjects: 'Fitting frame…',
};

const summarizeToolCall = (name, input) => {
  const label = TOOL_LABELS[name] || name;
  if (name === 'createObject') {
    const desc = input?.text ? `"${input.text.slice(0, 40)}"` : input?.type || 'object';
    return `${label} ${input?.type || ''} ${desc}`.trim();
  }
  if (name === 'updateObject') return `${label} object`;
  if (name === 'deleteObject') return `${label} object`;
  return label;
};

export const useAiAgent = ({ objects, createObject, updateObject, deleteObject, viewport, cursors, userId, userName, boardName, selectedIds }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [displayMessages, setDisplayMessages] = useState([]);
  const [conversationList, setConversationList] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [thinkingText, setThinkingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const historyRef = useRef([]);
  const streamingTextRef = useRef('');
  const thinkingTextRef = useRef('');

  // Listen for conversation list from Firebase (most recent 50)
  useEffect(() => {
    const q = query(conversationsRef(boardName), orderByChild('updatedAt'), limitToLast(50));
    const unsub = onValue(q, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        setConversationList([]);
        return;
      }
      const list = Object.entries(val)
        .map(([id, conv]) => {
          const msgs = Array.isArray(conv.messages) ? conv.messages : [];
          const firstUserMsg = msgs.find((m) => m.role === 'user' && typeof m.content === 'string');
          return {
            id,
            preview: firstUserMsg?.content?.slice(0, 80) || 'Empty conversation',
            updatedAt: conv.updatedAt || conv.createdAt || 0,
            createdByName: conv.createdByName || null,
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setConversationList(list);
    });
    return unsub;
  }, [boardName]);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    historyRef.current = [];
    setDisplayMessages([]);
  }, []);

  const loadConversation = useCallback(async (convId) => {
    const convRef = ref(db, `boards/${boardName}/conversations/${convId}`);
    const snapshot = await get(convRef);
    const conv = snapshot.val();
    if (!conv) return;
    const msgs = Array.isArray(conv.messages) ? conv.messages : [];
    historyRef.current = msgs;
    setConversationId(convId);
    setDisplayMessages(buildDisplayMessages(msgs));
  }, [boardName]);

  const submit = useCallback(async (message) => {
    setIsLoading(true);
    setProgress({ phase: 'calling', round: 0 });
    setStreamingText('');
    setThinkingText('');
    setIsThinking(false);
    streamingTextRef.current = '';
    thinkingTextRef.current = '';

    const operations = {
      createObject,
      updateObject,
      deleteObject,
      getObjects: () => objectsRef.current,
      viewportContext: null,
    };

    let viewportContext = null;
    if (viewport) {
      const topLeft = screenToBoard(0, 0, viewport.panX, viewport.panY, viewport.zoom);
      const bottomRight = screenToBoard(
        viewport.viewportWidth, viewport.viewportHeight,
        viewport.panX, viewport.panY, viewport.zoom,
      );
      const myCursor = userId && cursors?.[userId];
      const center = screenToBoard(
        viewport.viewportWidth / 2, viewport.viewportHeight / 2,
        viewport.panX, viewport.panY, viewport.zoom,
      );
      const selIds = selectedIds instanceof Set ? [...selectedIds] : [];
      viewportContext = {
        viewLeft: topLeft.x,
        viewTop: topLeft.y,
        viewRight: bottomRight.x,
        viewBottom: bottomRight.y,
        cursorX: myCursor?.x ?? center.x,
        cursorY: myCursor?.y ?? center.y,
        selectedIds: selIds,
      };
      operations.viewportContext = viewportContext;
    }

    // Create conversation in Firebase if this is the first message
    let convId = conversationId;
    if (!convId) {
      const newRef = push(conversationsRef(boardName));
      convId = newRef.key;
      setConversationId(convId);
      await saveConversation(boardName, convId, {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: userId ?? null,
        createdByName: userName ?? null,
        boardId: boardName,
        messages: [],
      });
    }

    const traceContext = {
      sessionId: convId,
      userId: userId || 'anonymous',
      userName: userName || null,
      boardName,
    };

    // Optimistically add the user message to display
    setDisplayMessages((prev) => [...prev, { role: 'user', text: message }]);

    const toolCalls = [];
    let preToolText = '';

    const handleToolCall = (name, input, toolResult) => {
      const summary = summarizeToolCall(name, input);
      const ok = toolResult?.ok !== false;
      toolCalls.push({ role: 'tool', name, summary, ok });
      // Replace the first pending tool entry with the final summary
      setDisplayMessages((prev) => {
        const idx = prev.findIndex((m) => m.role === 'tool' && m.pending);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { role: 'tool', text: summary, ok };
          return updated;
        }
        return [...prev, { role: 'tool', text: summary, ok }];
      });
    };

    const handleStream = (event) => {
      if (event.type === 'thinking') {
        setIsThinking(true);
        thinkingTextRef.current += event.delta;
        setThinkingText(thinkingTextRef.current);
      } else if (event.type === 'text') {
        if (thinkingTextRef.current) {
          setIsThinking(false);
        }
        streamingTextRef.current += event.delta;
        setStreamingText(streamingTextRef.current);
      } else if (event.type === 'toolStart') {
        // Commit any streamed text as a display message before showing tool status
        if (streamingTextRef.current && !preToolText) {
          preToolText = streamingTextRef.current;
          setDisplayMessages((prev) => [...prev, { role: 'assistant', text: preToolText }]);
        }
        if (thinkingTextRef.current || streamingTextRef.current) {
          setIsThinking(false);
          setThinkingText('');
          thinkingTextRef.current = '';
          streamingTextRef.current = '';
          setStreamingText('');
        }
        const pendingLabel = TOOL_PENDING_LABELS[event.name] || event.name;
        setDisplayMessages((prev) => [...prev, { role: 'tool', text: pendingLabel, pending: true }]);
      } else if (event.type === 'done') {
        setIsThinking(false);
        setThinkingText('');
        thinkingTextRef.current = '';
        streamingTextRef.current = '';
        setStreamingText('');
      }
    };

    try {
      const apiHistory = historyRef.current.filter((m) => m.role !== 'tool');
      const result = await runAgent(message, operations, setProgress, viewportContext, apiHistory, handleToolCall, handleStream, traceContext);
      const replyText = result.text || 'Done!';

      // Clear streaming state
      setStreamingText('');
      setThinkingText('');
      setIsThinking(false);
      streamingTextRef.current = '';
      thinkingTextRef.current = '';

      // Store user message, pre-tool text, tool calls, and final assistant reply in history
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: message },
        ...(preToolText ? [{ role: 'assistant', content: preToolText }] : []),
        ...toolCalls.map((tc) => ({ role: 'tool', content: tc.summary, ok: tc.ok })),
        { role: 'assistant', content: replyText },
      ];

      // Update display messages from canonical history
      setDisplayMessages(buildDisplayMessages(historyRef.current));

      // Persist to Firebase
      await updateConversation(boardName, convId, {
        updatedAt: Date.now(),
        messages: historyRef.current,
      });
    } catch (error) {
      const errorText = `Error: ${error.message}`;
      setStreamingText('');
      setThinkingText('');
      setIsThinking(false);
      streamingTextRef.current = '';
      thinkingTextRef.current = '';
      setDisplayMessages((prev) => [...prev, { role: 'assistant', text: errorText }]);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [createObject, updateObject, deleteObject, viewport, cursors, userId, userName, conversationId, boardName, selectedIds]);

  return { submit, isLoading, progress, conversationId, startNewConversation, loadConversation, displayMessages, conversationList, streamingText, thinkingText, isThinking };
};
