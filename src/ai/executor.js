// Executes AI tool calls against board operations.
// Pure logic — no React, no Firebase, no network. Takes operation callbacks.

import { generateId } from '../utils/ids.js';
import {
  DEFAULT_STICKY_COLOR,
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_CIRCLE_COLOR,
  DEFAULT_TEXT_COLOR,
} from '../utils/colors.js';
import { containsRect, getObjectBounds } from '../utils/coordinates.js';

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

const handleCreate = async (input, operations) => {
  const { createObject, getObjects } = operations;
  const defaults = TYPE_DEFAULTS[input.type] ?? {};
  const objects = getObjects();

  if (input.type === 'connector') {
    if (!objects[input.fromId]) return { ok: false, error: `Source object ${input.fromId} not found.` };
    if (!objects[input.toId]) return { ok: false, error: `Target object ${input.toId} not found.` };
    const fromZ = objects[input.fromId].zIndex ?? 0;
    const toZ = objects[input.toId].zIndex ?? 0;
    const obj = {
      id: generateId(),
      type: 'connector',
      fromId: input.fromId,
      toId: input.toId,
      style: input.style || defaults.style,
      strokeWidth: defaults.strokeWidth,
      color: input.color || defaults.color,
      zIndex: input.zIndex ?? Math.min(fromZ, toZ) - 1,
    };
    const created = await createObject(obj);
    return { ok: true, objectId: created.id, type: 'connector' };
  }

  const color = input.color || defaults.color;
  const width = input.width ?? defaults.width;
  const height = input.height ?? defaults.height;
  const centerX = input.x ?? 0;
  const centerY = input.y ?? 0;
  const autoZ = input.type === 'frame' ? (maxZIndex(objects) - 1) : (maxZIndex(objects) + 1);
  const obj = {
    id: generateId(),
    type: input.type,
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    zIndex: input.zIndex ?? autoZ,
    ...(color != null && { color }),
  };

  if (input.type === 'sticky' || input.type === 'text') obj.text = input.text ?? '';
  if (input.type === 'text') obj.fontSize = input.fontSize ?? defaults.fontSize;
  if (input.type === 'frame') obj.title = input.title ?? 'Frame';
  if (input.type === 'embed') obj.html = input.html ?? '';

  const created = await createObject(obj);
  return { ok: true, objectId: created.id, type: input.type };
};

const handleUpdate = async (input, operations) => {
  const { updateObject, getObjects } = operations;
  const objects = getObjects();
  const target = objects[input.objectId];
  if (!target) return { ok: false, error: `Object ${input.objectId} not found.` };

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

  await Promise.all([updateObject(input.objectId, updates), ...movedChildren]);
  return { ok: true, objectId: input.objectId, movedChildren: movedChildren.length };
};

const handleDelete = async (input, operations) => {
  const objects = operations.getObjects();
  if (!objects[input.objectId]) return { ok: false, error: `Object ${input.objectId} not found.` };
  await operations.deleteObject(input.objectId);
  return { ok: true, objectId: input.objectId };
};

const handleGetBoardState = (operations) => {
  const objects = operations.getObjects();
  const summary = Object.values(objects).map((obj) => {
    const cx = (obj.width != null) ? obj.x + obj.width / 2 : obj.x;
    const cy = (obj.height != null) ? obj.y + obj.height / 2 : obj.y;
    const base = { id: obj.id, type: obj.type, x: cx, y: cy };
    if (obj.width != null) base.width = obj.width;
    if (obj.height != null) base.height = obj.height;
    if (obj.text != null) base.text = obj.text;
    if (obj.title != null) base.title = obj.title;
    if (obj.color != null) base.color = obj.color;
    if (obj.html != null) base.html = obj.html.slice(0, 200);
    if (obj.zIndex != null) base.zIndex = obj.zIndex;
    return base;
  });
  return { ok: true, objects: summary, count: summary.length };
};

export const executeTool = async (toolName, input, operations) => {
  console.log(`[AI Tool] ${toolName}`, input);
  let result;
  try {
    switch (toolName) {
      case 'createObject': result = await handleCreate(input, operations); break;
      case 'updateObject': result = await handleUpdate(input, operations); break;
      case 'deleteObject': result = await handleDelete(input, operations); break;
      case 'getBoardState': result = handleGetBoardState(operations); break;
      default: result = { ok: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[AI Tool] ${toolName} failed:`, err);
    result = { ok: false, error: err.message };
  }
  console.log(`[AI Tool] ${toolName} result:`, result);
  return result;
};
