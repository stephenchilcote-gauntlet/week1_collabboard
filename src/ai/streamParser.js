// Parses Anthropic SSE streaming responses into structured content blocks,
// invoking callbacks for each incremental delta.

export async function parseStream(response, callbacks) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let currentEvent = '';
  const blocks = [];
  const blockJsonBuffers = {};
  let stopReason = null;

  const processLine = (line) => {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
      return;
    }

    if (!line.startsWith('data: ')) return;

    const raw = line.slice(6).trim();
    if (raw === '[DONE]') return;

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const { type } = data;

    if (type === 'content_block_start') {
      const { index, content_block: block } = data;
      if (block.type === 'thinking') {
        blocks[index] = { type: 'thinking', thinking: '' };
      } else if (block.type === 'text') {
        blocks[index] = { type: 'text', text: '' };
      } else if (block.type === 'tool_use') {
        blocks[index] = { type: 'tool_use', id: block.id, name: block.name, input: {} };
        blockJsonBuffers[index] = '';
        callbacks.onToolStart?.(index, block.id, block.name);
      }
    } else if (type === 'content_block_delta') {
      const { index, delta } = data;
      if (delta.type === 'thinking_delta') {
        blocks[index].thinking += delta.thinking;
        callbacks.onThinking?.(delta.thinking);
      } else if (delta.type === 'text_delta') {
        blocks[index].text += delta.text;
        callbacks.onText?.(delta.text);
      } else if (delta.type === 'input_json_delta') {
        blockJsonBuffers[index] += delta.partial_json;
        callbacks.onToolDelta?.(index, delta.partial_json);
      }
    } else if (type === 'content_block_stop') {
      const { index } = data;
      if (blocks[index]?.type === 'tool_use') {
        const jsonStr = blockJsonBuffers[index];
        try {
          blocks[index].input = jsonStr ? JSON.parse(jsonStr) : {};
        } catch {
          blocks[index].input = {};
        }
        delete blockJsonBuffers[index];
        callbacks.onToolEnd?.(index);
      }
    } else if (type === 'message_delta') {
      if (data.delta?.stop_reason) {
        stopReason = data.delta.stop_reason;
        callbacks.onStop?.(stopReason);
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      processLine(line);
    }
  }

  if (buffer.trim()) {
    processLine(buffer);
  }

  return { content: blocks.filter(Boolean), stop_reason: stopReason };
}
