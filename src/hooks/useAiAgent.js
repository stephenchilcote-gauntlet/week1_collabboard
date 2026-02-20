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

export const apiHistoryToDisplay = (apiMessages = []) => {
  const display = [];
  for (let i = 0; i < apiMessages.length; i += 1) {
    const message = apiMessages[i];
    if (!message || !message.role) continue;
    if (message.role === 'user') {
      if (typeof message.content === 'string') {
        display.push({ role: 'user', text: message.content });
      }
      continue;
    }
    if (message.role === 'assistant') {
      if (typeof message.content === 'string') {
        display.push({ role: 'assistant', text: message.content });
        continue;
      }
      if (!Array.isArray(message.content)) continue;
      message.content.forEach((block) => {
        if (block?.type === 'text' && block.text) {
          display.push({ role: 'assistant', text: block.text });
          return;
        }
        if (block?.type === 'tool_use') {
          const summary = summarizeToolCall(block.name, block.input);
          let ok = true;
          const nextMessage = apiMessages[i + 1];
          if (nextMessage?.role === 'user' && Array.isArray(nextMessage.content)) {
            const toolResult = nextMessage.content.find(
              (resultBlock) => resultBlock?.type === 'tool_result' && resultBlock.tool_use_id === block.id,
            );
            if (toolResult?.content) {
              try {
                const parsed = JSON.parse(toolResult.content);
                if (parsed?.ok === false) ok = false;
              } catch (error) {
                ok = true;
              }
            }
          }
          display.push({ role: 'tool', text: summary, ok });
        }
      });
    }
  }
  return display;
};

const TOOL_LABELS = {
  createObject: 'Created',
  updateObject: 'Updated',
  deleteObject: 'Deleted',
  getBoardState: 'Read board',
  fitFrameToObjects: 'Fit frame',
  layoutObjects: 'Laid out objects',
};

const TOOL_PENDING_LABELS = {
  createObject: 'Creating…',
  updateObject: 'Updating…',
  deleteObject: 'Deleting…',
  getBoardState: 'Reading board…',
  fitFrameToObjects: 'Fitting frame…',
  layoutObjects: 'Laying out objects…',
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
  const [subAgentThinkingText, setSubAgentThinkingText] = useState('');
  const [subAgentOutputText, setSubAgentOutputText] = useState('');
  const [isSubAgentActive, setIsSubAgentActive] = useState(false);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const historyRef = useRef([]);
  const displayHistoryRef = useRef([]);
  const pendingDisplayRef = useRef([]);
  const streamingTextRef = useRef('');
  const thinkingTextRef = useRef('');
  const subAgentThinkingTextRef = useRef('');
  const subAgentOutputTextRef = useRef('');

  const flushDisplayMessages = useCallback(() => {
    setDisplayMessages([...displayHistoryRef.current, ...pendingDisplayRef.current]);
  }, []);

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
    displayHistoryRef.current = [];
    pendingDisplayRef.current = [];
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
    displayHistoryRef.current = apiHistoryToDisplay(historyRef.current);
    pendingDisplayRef.current = [];
    setDisplayMessages([...displayHistoryRef.current]);
  }, [boardName]);

  const submit = useCallback(async (message) => {
    setIsLoading(true);
    setProgress({ phase: 'calling', round: 0 });
    setStreamingText('');
    setThinkingText('');
    setIsThinking(false);
    setSubAgentThinkingText('');
    setSubAgentOutputText('');
    setIsSubAgentActive(false);
    streamingTextRef.current = '';
    thinkingTextRef.current = '';
    subAgentThinkingTextRef.current = '';
    subAgentOutputTextRef.current = '';

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
    pendingDisplayRef.current = [{ role: 'user', text: message }];
    flushDisplayMessages();

    let pendingAssistantIndex = null;

    const commitStreamingText = () => {
      const text = streamingTextRef.current;
      if (!text) return;
      if (pendingAssistantIndex === null) {
        pendingAssistantIndex = pendingDisplayRef.current.length;
        pendingDisplayRef.current = [...pendingDisplayRef.current, { role: 'assistant', text }];
      } else {
        pendingDisplayRef.current[pendingAssistantIndex] = { role: 'assistant', text };
      }
      flushDisplayMessages();
    };

    const handleToolCall = (name, input, toolResult) => {
      const summary = summarizeToolCall(name, input);
      const ok = toolResult?.ok !== false;
      const pendingIndex = [...pendingDisplayRef.current]
        .reverse()
        .findIndex((entry) => entry.role === 'tool' && entry.pending);
      if (pendingIndex !== -1) {
        const indexFromStart = pendingDisplayRef.current.length - 1 - pendingIndex;
        pendingDisplayRef.current[indexFromStart] = { role: 'tool', text: summary, ok };
      } else {
        pendingDisplayRef.current = [...pendingDisplayRef.current, { role: 'tool', text: summary, ok }];
      }
      flushDisplayMessages();
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
      } else if (event.type === 'subAgentThinking') {
        setIsSubAgentActive(true);
        subAgentThinkingTextRef.current += event.delta;
        setSubAgentThinkingText(subAgentThinkingTextRef.current);
      } else if (event.type === 'subAgentText') {
        setIsSubAgentActive(true);
        subAgentOutputTextRef.current += event.delta;
        setSubAgentOutputText(subAgentOutputTextRef.current);
      } else if (event.type === 'toolStart') {
        commitStreamingText();
        pendingAssistantIndex = null;
        if (thinkingTextRef.current || streamingTextRef.current) {
          setIsThinking(false);
          setThinkingText('');
          thinkingTextRef.current = '';
          streamingTextRef.current = '';
          setStreamingText('');
        }
        setIsSubAgentActive(false);
        setSubAgentThinkingText('');
        setSubAgentOutputText('');
        subAgentThinkingTextRef.current = '';
        subAgentOutputTextRef.current = '';
        const pendingLabel = TOOL_PENDING_LABELS[event.name] || event.name;
        pendingDisplayRef.current = [
          ...pendingDisplayRef.current,
          { role: 'tool', text: pendingLabel, pending: true },
        ];
        flushDisplayMessages();
      } else if (event.type === 'done') {
        commitStreamingText();
        setIsThinking(false);
        setThinkingText('');
        thinkingTextRef.current = '';
        streamingTextRef.current = '';
        setStreamingText('');
        setIsSubAgentActive(false);
        setSubAgentThinkingText('');
        setSubAgentOutputText('');
        subAgentThinkingTextRef.current = '';
        subAgentOutputTextRef.current = '';
        pendingAssistantIndex = null;
      }
    };

    try {
      const result = await runAgent(message, operations, setProgress, viewportContext, historyRef.current, handleToolCall, handleStream, traceContext);
      // Clear streaming state
      setStreamingText('');
      setThinkingText('');
      setIsThinking(false);
      setSubAgentThinkingText('');
      setSubAgentOutputText('');
      setIsSubAgentActive(false);
      streamingTextRef.current = '';
      thinkingTextRef.current = '';
      subAgentThinkingTextRef.current = '';
      subAgentOutputTextRef.current = '';

      // Use the full API-format messages from runAgent (includes tool_use/tool_result blocks)
      const normalizedMessages = Array.isArray(result.messages) ? [...result.messages] : [];
      const lastMessage = normalizedMessages[normalizedMessages.length - 1];
      if (result.text) {
        const alreadyHasFinalText = lastMessage?.role === 'assistant'
          && typeof lastMessage.content === 'string'
          && lastMessage.content === result.text;
        if (!alreadyHasFinalText) {
          normalizedMessages.push({ role: 'assistant', content: result.text });
        }
      }
      historyRef.current = normalizedMessages;
      displayHistoryRef.current = apiHistoryToDisplay(historyRef.current);
      pendingDisplayRef.current = [];
      setDisplayMessages([...displayHistoryRef.current]);

      // Persist API history to Firebase
      await updateConversation(boardName, convId, {
        updatedAt: Date.now(),
        messages: historyRef.current,
      });
    } catch (error) {
      const errorText = `Error: ${error.message}`;
      setStreamingText('');
      setThinkingText('');
      setIsThinking(false);
      setSubAgentThinkingText('');
      setSubAgentOutputText('');
      setIsSubAgentActive(false);
      streamingTextRef.current = '';
      thinkingTextRef.current = '';
      subAgentThinkingTextRef.current = '';
      subAgentOutputTextRef.current = '';
      pendingDisplayRef.current = [...pendingDisplayRef.current, { role: 'assistant', text: errorText }];
      setDisplayMessages([...displayHistoryRef.current, ...pendingDisplayRef.current]);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [createObject, updateObject, deleteObject, viewport, cursors, userId, userName, conversationId, boardName, selectedIds, flushDisplayMessages]);

  return { submit, isLoading, progress, conversationId, startNewConversation, loadConversation, displayMessages, conversationList, streamingText, thinkingText, isThinking, subAgentThinkingText, subAgentOutputText, isSubAgentActive };
};
