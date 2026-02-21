// Template search sub-agent — uses a cheap model to match user queries
// against the template catalog. Returns pipe-delimited results.

import { AI_PROXY_URL, getAuthToken } from './config.js';
import { TEMPLATE_CATALOG } from './templates.js';
import { parseStream } from './streamParser.js';

export const searchTemplates = async (query, traceContext, onStream) => {
  const fullContext = { ...(traceContext || {}), callType: 'tool', toolName: 'searchTemplates' };
  const useStreaming = !!onStream;
  const reqBody = {
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1024,
    system: `You are a template search agent. Given the catalog below, return 1-3 matching templates.
Format: ID|Slot1; Slot2; Slot3|short reason (one per line, no other text).
Example: swot|Strengths; Weaknesses; Opportunities; Threats|strategic grid

${TEMPLATE_CATALOG}`,
    messages: [{ role: 'user', content: query }],
  };
  if (useStreaming) {
    reqBody.stream = true;
  }
  const token = await getAuthToken();
  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Trace-Context': JSON.stringify(fullContext),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(reqBody),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Template search error ${response.status}: ${text}`);
  }
  if (useStreaming) {
    const streamCallbacks = {
      onText: (delta) => onStream({ type: 'subAgentText', delta }),
    };
    const result = await parseStream(response, streamCallbacks);
    return result.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') || '';
  }
  const result = await response.json();
  return result.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') || '';
};
