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
  return { ok: false, error: `Object "${value}" not found.` };
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

  if (input.type === 'sticky' || input.type === 'text') obj.text = input.text ?? '';
  if (input.type === 'text') obj.fontSize = input.fontSize ?? defaults.fontSize;
  if (input.type === 'frame') obj.title = input.title ?? 'Frame';
  if (input.type === 'embed') obj.html = input.html ?? '';

  const created = await createObject(obj);
  return { ok: true, label: created.label, type: input.type };
};

const handleUpdate = async (input, operations) => {
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

const handleDelete = async (input, operations) => {
  const objects = operations.getObjects();
  const res = resolveId(input.objectId, objects);
  if (!res.ok) return { ok: false, error: res.error, matches: res.matches };
  const label = objects[res.id]?.label;
  await operations.deleteObject(res.id);
  return { ok: true, label };
};

const handleGetBoardState = (operations) => {
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

  const summary = Object.values(objects)
    .filter((obj) => !viewRect || intersectsRect(viewRect, getObjectBounds(obj)))
    .map((obj) => {
      const cx = (obj.width != null) ? obj.x + obj.width / 2 : obj.x;
      const cy = (obj.height != null) ? obj.y + obj.height / 2 : obj.y;
      const label = obj.label || uuidToLabel(obj.id);
      const base = { label, id: obj.id, type: obj.type, x: cx, y: cy };
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

export const executeTool = async (toolName, input, operations) => {
  console.log(`[AI Tool] ${toolName}`, input);
  let result;
  try {
    switch (toolName) {
      case 'createObject': result = await handleCreate(input, operations); break;
      case 'updateObject': result = await handleUpdate(input, operations); break;
      case 'deleteObject': result = await handleDelete(input, operations); break;
      case 'getBoardState': result = handleGetBoardState(operations); break;
      case 'fitFrameToObjects': result = await handleFitFrameToObjects(input, operations); break;
      default: result = { ok: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[AI Tool] ${toolName} failed:`, err);
    result = { ok: false, error: err.message };
  }
  console.log(`[AI Tool] ${toolName} result:`, result);
  return result;
};
