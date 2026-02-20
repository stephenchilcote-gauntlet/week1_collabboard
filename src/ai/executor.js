// Executes AI tool calls against board operations.
// Pure logic — no React, no Firebase, no network. Takes operation callbacks.

import { generateId } from '../utils/ids.js';
import {
  DEFAULT_STICKY_COLOR,
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_CIRCLE_COLOR,
  DEFAULT_TEXT_COLOR,
} from '../utils/colors.js';
import { getObjectBounds, intersectsRect, containsRect } from '../utils/coordinates.js';
import { uuidToLabel } from './labels.js';
import { AI_PROXY_URL } from './config.js';
import { parseStream } from './streamParser.js';

const TYPE_DEFAULTS = {
  sticky: { width: 200, height: 160, color: DEFAULT_STICKY_COLOR },
  rectangle: { width: 240, height: 160, color: DEFAULT_RECTANGLE_COLOR },
  circle: { width: 200, height: 200, color: DEFAULT_CIRCLE_COLOR },
  text: { width: 200, height: 60, color: DEFAULT_TEXT_COLOR, fontSize: 16 },
  frame: { width: 420, height: 260 },
  connector: { strokeWidth: 2, color: '#111827', style: 'line' },
  embed: { width: 400, height: 300 },
};

const maxZIndex = (objects) =>
  Object.values(objects).reduce((max, o) => Math.max(max, o.zIndex ?? 0), 0);

// Resolve a label or UUID to a UUID. Returns { ok, id, matches? } or { ok:false, error }.
const resolveId = (value, objects) => {
  if (!value) return { ok: false, error: 'No ID provided.' };
  // Direct UUID match (own property only — avoid prototype keys like 'constructor')
  if (Object.hasOwn(objects, value)) return { ok: true, id: value };
  // Label match — find objects whose label matches
  const matches = Object.values(objects).filter((o) => o.label === value);
  if (matches.length === 1) return { ok: true, id: matches[0].id };
  if (matches.length > 1) {
    const details = matches.map((o) => ({ id: o.id, label: o.label, type: o.type }));
    return { ok: false, error: `Multiple objects match label "${value}".`, matches: details };
  }
  const count = Object.keys(objects).length;
  const types = [...new Set(Object.values(objects).map((o) => o.type))].join(', ');
  return { ok: false, error: `Object "${value}" not found. Board has ${count} object(s)${types ? ` (types: ${types})` : ''}.` };
};

const handleCreate = async (input, operations) => {
  const { createObject, getObjects } = operations;
  const defaults = TYPE_DEFAULTS[input.type] ?? {};
  const objects = getObjects();

  if (input.type === 'connector') {
    const fromRes = resolveId(input.fromId, objects);
    if (!fromRes.ok) return { ok: false, error: `Source: ${fromRes.error}`, matches: fromRes.matches };
    const toRes = resolveId(input.toId, objects);
    if (!toRes.ok) return { ok: false, error: `Target: ${toRes.error}`, matches: toRes.matches };
    const fromZ = objects[fromRes.id].zIndex ?? 0;
    const toZ = objects[toRes.id].zIndex ?? 0;
    const id = generateId();
    const obj = {
      id,
      type: 'connector',
      label: uuidToLabel(id),
      fromId: fromRes.id,
      toId: toRes.id,
      style: input.style || defaults.style,
      strokeWidth: defaults.strokeWidth,
      color: input.color || defaults.color,
      zIndex: input.zIndex ?? Math.min(fromZ, toZ) - 1,
    };
    const created = await createObject(obj);
    return { ok: true, label: created.label, type: 'connector' };
  }

  const color = input.color || defaults.color;
  const width = input.width ?? defaults.width;
  const height = input.height ?? defaults.height;
  const centerX = input.x ?? 0;
  const centerY = input.y ?? 0;
  const autoZ = input.type === 'frame' ? (maxZIndex(objects) - 1) : (maxZIndex(objects) + 1);
  const id = generateId();
  const obj = {
    id,
    type: input.type,
    label: uuidToLabel(id),
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    zIndex: input.zIndex ?? autoZ,
    ...(color != null && { color }),
  };

  if (input.text != null || input.type === 'sticky' || input.type === 'text' || input.type === 'rectangle' || input.type === 'circle') {
    obj.text = input.text ?? '';
  }
  if (input.type === 'text') obj.fontSize = input.fontSize ?? defaults.fontSize;
  if (input.type === 'frame') obj.title = input.title ?? 'Frame';
  if (input.type === 'embed') obj.html = input.html ?? '';

  const created = await createObject(obj);
  return { ok: true, label: created.label, type: input.type };
};

const handleUpdateSingle = async (input, operations) => {
  const { updateObject, getObjects } = operations;
  const objects = getObjects();
  const res = resolveId(input.objectId, objects);
  if (!res.ok) return { ok: false, error: res.error, matches: res.matches };
  const objectId = res.id;
  const target = objects[objectId];

  const updates = {};
  const newWidth = input.width ?? target.width ?? 0;
  const newHeight = input.height ?? target.height ?? 0;
  if (input.x != null) updates.x = input.x - newWidth / 2;
  if (input.y != null) updates.y = input.y - newHeight / 2;
  if (input.width != null) updates.width = input.width;
  if (input.height != null) updates.height = input.height;
  if (input.text != null) updates.text = input.text;
  if (input.color != null) updates.color = input.color;
  if (input.title != null) updates.title = input.title;
  if (input.zIndex != null) updates.zIndex = input.zIndex;

  if (Object.keys(updates).length === 0) return { ok: false, error: 'No updates provided.' };

  // When moving a frame, shift all contained objects by the same delta
  const movedChildren = [];
  if (target.type === 'frame' && (updates.x != null || updates.y != null)) {
    const dx = (updates.x ?? target.x) - target.x;
    const dy = (updates.y ?? target.y) - target.y;
    if (dx !== 0 || dy !== 0) {
      const frameBounds = getObjectBounds(target);
      for (const obj of Object.values(objects)) {
        if (obj.id === target.id || obj.type === 'connector') continue;
        const childBounds = getObjectBounds(obj);
        if (containsRect(frameBounds, childBounds)) {
          const childUpdates = {};
          if (typeof obj.x1 === 'number') {
            childUpdates.x1 = obj.x1 + dx;
            childUpdates.y1 = obj.y1 + dy;
            childUpdates.x2 = obj.x2 + dx;
            childUpdates.y2 = obj.y2 + dy;
          } else {
            childUpdates.x = obj.x + dx;
            childUpdates.y = obj.y + dy;
          }
          movedChildren.push(updateObject(obj.id, childUpdates));
        }
      }
    }
  }

  await Promise.all([updateObject(objectId, updates), ...movedChildren]);
  return { ok: true, label: target.label, movedChildren: movedChildren.length };
};

const handleUpdate = async (input, operations) => {
  if (input.updates) {
    const results = [];
    for (const entry of input.updates) {
      results.push(await handleUpdateSingle(entry, operations));
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      return { ok: false, error: `${failed.length}/${results.length} updates failed.`, results };
    }
    return { ok: true, updated: results.length, results };
  }
  return handleUpdateSingle(input, operations);
};

const handleDelete = async (input, operations) => {
  const objects = operations.getObjects();
  const res = resolveId(input.objectId, objects);
  if (!res.ok) return { ok: false, error: res.error, matches: res.matches };
  const label = objects[res.id]?.label;
  await operations.deleteObject(res.id);
  return { ok: true, label };
};

export const collectViewportObjects = (operations) => {
  const objects = operations.getObjects();
  const vc = operations.viewportContext;

  // Build expanded viewport rect (25% margin on each side)
  let viewRect = null;
  if (vc) {
    const w = vc.viewRight - vc.viewLeft;
    const h = vc.viewBottom - vc.viewTop;
    const mx = w * 0.25;
    const my = h * 0.25;
    viewRect = { x: vc.viewLeft - mx, y: vc.viewTop - my, width: w + mx * 2, height: h + my * 2 };
  }

  // Separate connectors from spatial objects
  const allObjects = Object.values(objects);
  const spatialObjects = allObjects.filter((obj) => obj.type !== 'connector');
  const connectors = allObjects.filter((obj) => obj.type === 'connector');

  // Filter spatial objects by viewport
  const visibleSpatial = spatialObjects.filter(
    (obj) => !viewRect || intersectsRect(viewRect, getObjectBounds(obj)),
  );
  const visibleIds = new Set(visibleSpatial.map((obj) => obj.id));

  // Include connectors where at least one endpoint is in the viewport
  const visibleConnectors = connectors.filter(
    (c) => !viewRect || visibleIds.has(c.fromId) || visibleIds.has(c.toId),
  );

  const mapSpatial = (obj) => {
    const cx = (obj.width != null) ? obj.x + obj.width / 2 : obj.x;
    const cy = (obj.height != null) ? obj.y + obj.height / 2 : obj.y;
    const label = obj.label || uuidToLabel(obj.id);
    const base = { label, id: obj.id, type: obj.type, x: cx, y: cy };
    if (obj.width != null) base.width = obj.width;
    if (obj.height != null) base.height = obj.height;
    if (obj.text != null) base.text = obj.text.length > 300 ? obj.text.slice(0, 300) + '…' : obj.text;
    if (obj.title != null) base.title = obj.title.length > 100 ? obj.title.slice(0, 100) + '…' : obj.title;
    if (obj.color != null) base.color = obj.color;
    if (obj.html != null) base.html = obj.html.slice(0, 200);
    if (obj.zIndex != null) base.zIndex = obj.zIndex;
    return base;
  };

  const mapConnector = (obj) => {
    const label = obj.label || uuidToLabel(obj.id);
    const fromLabel = objects[obj.fromId]?.label || uuidToLabel(obj.fromId);
    const toLabel = objects[obj.toId]?.label || uuidToLabel(obj.toId);
    const base = { label, id: obj.id, type: 'connector', from: fromLabel, to: toLabel };
    if (obj.style != null) base.style = obj.style;
    if (obj.color != null) base.color = obj.color;
    if (obj.zIndex != null) base.zIndex = obj.zIndex;
    return base;
  };

  return [...visibleSpatial.map(mapSpatial), ...visibleConnectors.map(mapConnector)];
};

const extractBoardInfo = async (query, boardData, traceContext, onStream) => {
  const fullContext = { ...(traceContext || {}), callType: 'tool', toolName: 'getBoardState' };
  const useStreaming = !!onStream;
  const reqBody = {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: 'You provide the information requested by this prompt: as concise JSON. Default to returning all fields, except UUIDs - return those only if requested.',
    messages: [
      {
        role: 'user',
        content: `Board objects:\n${JSON.stringify(boardData)}\n\nQuery: ${query}`,
      },
    ],
  };
  if (useStreaming) {
    reqBody.stream = true;
    reqBody.thinking = { type: 'enabled', budget_tokens: 5000 };
  }
  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Trace-Context': JSON.stringify(fullContext),
    },
    body: JSON.stringify(reqBody),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Board query LLM error ${response.status}: ${text}`);
  }
  if (useStreaming) {
    const streamCallbacks = {
      onThinking: (delta) => onStream({ type: 'subAgentThinking', delta }),
      onText: (delta) => onStream({ type: 'subAgentText', delta }),
    };
    const result = await parseStream(response, streamCallbacks);
    let text = result.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('') || '';
    if (result.stop_reason === 'max_tokens') text += '\n[WARNING: response was truncated]';
    return text;
  }
  const result = await response.json();
  let text = result.content
    ?.filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('') || '';
  if (result.stop_reason === 'max_tokens') text += '\n[WARNING: response was truncated]';
  return text;
};

const applyStructuredQuery = (objects, filter, fields) => {
  let result = objects;
  if (filter && typeof filter === 'object') {
    result = result.filter((obj) => {
      for (const [key, val] of Object.entries(filter)) {
        if (val === undefined || val === null) continue;
        if (key === 'text' && typeof val === 'string') {
          if (!obj.text || !obj.text.toLowerCase().includes(val.toLowerCase())) return false;
        } else if (obj[key] !== val) {
          return false;
        }
      }
      return true;
    });
  }
  if (fields && Array.isArray(fields) && fields.length > 0) {
    result = result.map((obj) => {
      const picked = {};
      for (const f of fields) {
        if (obj[f] !== undefined) picked[f] = obj[f];
      }
      return picked;
    });
  }
  return result;
};

const handleGetBoardState = async (input, operations, traceContext, onStream) => {
  let summary = collectViewportObjects(operations);
  const total = summary.length;

  // Apply structured filters first (AND with the natural language query)
  if (input.filter || input.fields) {
    summary = applyStructuredQuery(summary, input.filter, input.fields);
  }

  const query = input.query;
  try {
    const extracted = await extractBoardInfo(query, summary, traceContext, onStream);
    return { ok: true, result: extracted };
  } catch (err) {
    console.error('[AI Tool] getBoardState sub-agent failed, returning raw data:', err);
    return { ok: true, objects: summary, count: summary.length };
  }
};

const handleFitFrameToObjects = async (input, operations) => {
  const { updateObject, getObjects } = operations;
  const objects = getObjects();
  const frameRes = resolveId(input.frameId, objects);
  if (!frameRes.ok) return { ok: false, error: frameRes.error, matches: frameRes.matches };
  const frame = objects[frameRes.id];
  if (frame.type !== 'frame') return { ok: false, error: `Object "${input.frameId}" is not a frame.` };
  if (!input.objectIds || input.objectIds.length === 0) return { ok: false, error: 'No objectIds provided.' };

  const resolvedIds = input.objectIds.map((v) => resolveId(v, objects));
  const failed = resolvedIds.find((r) => !r.ok);
  if (failed) return { ok: false, error: failed.error, matches: failed.matches };
  const targets = resolvedIds.map((r) => objects[r.id]).filter(Boolean);
  if (targets.length === 0) return { ok: false, error: 'None of the specified objects were found.' };

  const bounds = targets.map((o) => getObjectBounds(o));
  const minX = Math.min(...bounds.map((b) => b.x));
  const minY = Math.min(...bounds.map((b) => b.y));
  const maxX = Math.max(...bounds.map((b) => b.x + b.width));
  const maxY = Math.max(...bounds.map((b) => b.y + b.height));

  const bw = maxX - minX;
  const bh = maxY - minY;
  const padX = bw * 0.15;
  const padY = bh * 0.15;

  const updates = {
    x: minX - padX,
    y: minY - padY,
    width: bw + padX * 2,
    height: bh + padY * 2,
  };
  await updateObject(frameRes.id, updates);
  return { ok: true, label: frame.label };
};

const resolveMultipleIds = (ids, objects) => {
  const resolved = [];
  for (const id of ids) {
    const res = resolveId(id, objects);
    if (!res.ok) return { ok: false, error: res.error, matches: res.matches };
    resolved.push(objects[res.id]);
  }
  return { ok: true, targets: resolved };
};

const handleLayoutObjects = async (input, operations) => {
  const { updateObject, getObjects } = operations;
  const objects = getObjects();
  const { mode, objectIds } = input;

  if (!objectIds || objectIds.length === 0) return { ok: false, error: 'No objectIds provided.' };
  if (!mode) return { ok: false, error: 'No layout mode specified. Use "grid", "distributeH", "distributeV", or "align".' };

  const resolved = resolveMultipleIds(objectIds, objects);
  if (!resolved.ok) return resolved;
  const targets = resolved.targets;

  if (mode === 'grid') {
    const columns = input.columns ?? Math.ceil(Math.sqrt(targets.length));
    const spacing = input.spacing ?? 30;
    const startX = input.startX ?? targets[0].x ?? 0;
    const startY = input.startY ?? targets[0].y ?? 0;
    const promises = targets.map((obj, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const w = obj.width ?? 200;
      const h = obj.height ?? 160;
      const x = startX + col * (w + spacing);
      const y = startY + row * (h + spacing);
      return updateObject(obj.id, { x, y });
    });
    await Promise.all(promises);
    return { ok: true, arranged: targets.length, mode: 'grid', columns };
  }

  if (mode === 'distributeH' || mode === 'distributeV') {
    if (targets.length < 2) return { ok: false, error: 'Need at least 2 objects to distribute.' };
    const horizontal = mode === 'distributeH';
    const sorted = [...targets].sort((a, b) => horizontal ? (a.x - b.x) : (a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startPos = horizontal ? first.x : first.y;
    const lastSize = horizontal ? (last.width ?? 0) : (last.height ?? 0);
    const endPos = horizontal ? (last.x + lastSize) : (last.y + lastSize);
    const totalSpan = endPos - startPos;
    const totalObjSize = sorted.reduce((sum, o) => sum + (horizontal ? (o.width ?? 0) : (o.height ?? 0)), 0);
    const gap = targets.length > 1 ? (totalSpan - totalObjSize) / (targets.length - 1) : 0;
    let pos = startPos;
    const promises = sorted.map((obj) => {
      const size = horizontal ? (obj.width ?? 0) : (obj.height ?? 0);
      const update = horizontal ? { x: pos } : { y: pos };
      pos += size + gap;
      return updateObject(obj.id, update);
    });
    await Promise.all(promises);
    return { ok: true, arranged: targets.length, mode };
  }

  if (mode === 'align') {
    const alignment = input.alignment ?? 'left';
    const bounds = targets.map((o) => getObjectBounds(o));
    let ref;
    switch (alignment) {
      case 'left': ref = Math.min(...bounds.map((b) => b.x)); break;
      case 'right': ref = Math.max(...bounds.map((b) => b.x + b.width)); break;
      case 'center': {
        const minX = Math.min(...bounds.map((b) => b.x));
        const maxX = Math.max(...bounds.map((b) => b.x + b.width));
        ref = (minX + maxX) / 2;
        break;
      }
      case 'top': ref = Math.min(...bounds.map((b) => b.y)); break;
      case 'bottom': ref = Math.max(...bounds.map((b) => b.y + b.height)); break;
      case 'middle': {
        const minY = Math.min(...bounds.map((b) => b.y));
        const maxY = Math.max(...bounds.map((b) => b.y + b.height));
        ref = (minY + maxY) / 2;
        break;
      }
      default: return { ok: false, error: `Unknown alignment "${alignment}". Use left, center, right, top, middle, or bottom.` };
    }
    const promises = targets.map((obj) => {
      const w = obj.width ?? 0;
      const h = obj.height ?? 0;
      let update;
      switch (alignment) {
        case 'left': update = { x: ref }; break;
        case 'right': update = { x: ref - w }; break;
        case 'center': update = { x: ref - w / 2 }; break;
        case 'top': update = { y: ref }; break;
        case 'bottom': update = { y: ref - h }; break;
        case 'middle': update = { y: ref - h / 2 }; break;
      }
      return updateObject(obj.id, update);
    });
    await Promise.all(promises);
    return { ok: true, arranged: targets.length, mode: 'align', alignment };
  }

  return { ok: false, error: `Unknown layout mode "${mode}". Use "grid", "distributeH", "distributeV", or "align".` };
};

export const executeTool = async (toolName, input, operations, traceContext, onStream) => {
  console.log(`[AI Tool] ${toolName}`, input);
  let result;
  try {
    switch (toolName) {
      case 'createObject': result = await handleCreate(input, operations); break;
      case 'updateObject': result = await handleUpdate(input, operations); break;
      case 'deleteObject': result = await handleDelete(input, operations); break;
      case 'getBoardState': result = await handleGetBoardState(input, operations, traceContext, onStream); break;
      case 'fitFrameToObjects': result = await handleFitFrameToObjects(input, operations); break;
      case 'layoutObjects': result = await handleLayoutObjects(input, operations); break;
      default: result = { ok: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[AI Tool] ${toolName} failed:`, err);
    result = { ok: false, error: err.message };
  }
  console.log(`[AI Tool] ${toolName} result:`, result);
  return result;
};
