const ELEMENT_DEFAULTS = {
  sticky: { width: 200, height: 160 },
  text: { width: 200, height: 60 },
  rect: { width: 240, height: 160 },
  rectangle: { width: 240, height: 160 },
  circle: { width: 200, height: 200 },
  embed: { width: 400, height: 300 },
};

const FRAME_PADDING = { left: 30, right: 30, top: 50, bottom: 30 };

const LAYOUT_TAGS = new Set(['grid', 'row', 'stack']);
const LEAF_TAGS = new Set(['sticky', 'text', 'rect', 'circle', 'embed']);
const TYPE_MAP = { rect: 'rectangle' };

function isElement(node) {
  return node.nodeType === 1;
}

function spatialChildren(el) {
  return Array.from(el.childNodes).filter(
    (n) => isElement(n) && n.tagName !== 'connector',
  );
}

// ---------- Pass 1: Measure (bottom-up) ----------

function measure(el) {
  const tag = el.tagName;

  if (tag === 'connector') return { el, tag, width: 0, height: 0 };

  if (LEAF_TAGS.has(tag)) {
    const defaults = ELEMENT_DEFAULTS[tag] || { width: 100, height: 100 };
    const w = Number(el.getAttribute('width') || el.getAttribute('w')) || defaults.width;
    const h = Number(el.getAttribute('height') || el.getAttribute('h')) || defaults.height;
    return { el, tag, width: w, height: h };
  }

  const children = Array.from(el.childNodes).filter(isElement).map(measure);
  const spatial = children.filter((c) => c.tag !== 'connector');

  if (tag === 'grid') {
    const cols = Number(el.getAttribute('cols') || 2);
    const gap = Number(el.getAttribute('gap') || 30);
    const maxW = Math.max(...spatial.map((c) => c.width));
    const maxH = Math.max(...spatial.map((c) => c.height));
    const rows = Math.ceil(spatial.length / cols);
    return {
      el, tag, children, spatial,
      cols, gap, rows, maxW, maxH,
      width: cols * maxW + (cols - 1) * gap,
      height: rows * maxH + (rows - 1) * gap,
    };
  }

  if (tag === 'row') {
    const gap = Number(el.getAttribute('gap') || 30);
    return {
      el, tag, children, spatial, gap,
      width: spatial.reduce((s, c) => s + c.width, 0) + (spatial.length - 1) * gap,
      height: Math.max(...spatial.map((c) => c.height)),
    };
  }

  if (tag === 'stack') {
    const gap = Number(el.getAttribute('gap') || 30);
    return {
      el, tag, children, spatial, gap,
      width: Math.max(...spatial.map((c) => c.width)),
      height: spatial.reduce((s, c) => s + c.height, 0) + (spatial.length - 1) * gap,
    };
  }

  if (tag === 'frame') {
    const layoutChild = children.find((c) => LAYOUT_TAGS.has(c.tag));
    return {
      el, tag, children, layoutChild,
      width: (layoutChild ? layoutChild.width : 0) + FRAME_PADDING.left + FRAME_PADDING.right,
      height: (layoutChild ? layoutChild.height : 0) + FRAME_PADDING.top + FRAME_PADDING.bottom,
    };
  }

  // Unknown wrapper — treat as single child passthrough
  if (children.length > 0) return measure(children[0]);
  return { el, tag, width: 0, height: 0 };
}

// ---------- Pass 2: Layout (top-down) ----------

function layout(node, tlx, tly, results, connectors) {
  const { tag } = node;

  if (tag === 'connector') {
    connectors.push({
      type: 'connector',
      fromKey: node.el.getAttribute('from'),
      toKey: node.el.getAttribute('to'),
      style: node.el.getAttribute('style') || 'arrow',
      color: node.el.getAttribute('color') || '#000',
    });
    return;
  }

  if (LEAF_TAGS.has(tag)) {
    const spec = {
      type: TYPE_MAP[tag] || tag,
      x: tlx + node.width / 2,
      y: tly + node.height / 2,
      width: node.width,
      height: node.height,
      text: node.el.textContent || '',
    };
    const color = node.el.getAttribute('color');
    if (color) spec.color = color;
    const key = node.el.getAttribute('key');
    if (key) spec.key = key;
    if (tag === 'text') {
      const size = node.el.getAttribute('size');
      if (size) spec.fontSize = Number(size);
    }
    results.push(spec);
    return;
  }

  if (tag === 'frame') {
    results.push({
      type: 'frame',
      x: tlx + node.width / 2,
      y: tly + node.height / 2,
      width: node.width,
      height: node.height,
      title: node.el.getAttribute('title') || '',
    });
    const innerX = tlx + FRAME_PADDING.left;
    const innerY = tly + FRAME_PADDING.top;
    if (node.layoutChild) layout(node.layoutChild, innerX, innerY, results, connectors);
    // Collect connectors that are direct children of the frame
    for (const c of (node.children || [])) {
      if (c.tag === 'connector') layout(c, 0, 0, results, connectors);
    }
    return;
  }

  if (tag === 'grid') {
    let idx = 0;
    for (const child of node.spatial) {
      const col = idx % node.cols;
      const row = Math.floor(idx / node.cols);
      const cx = tlx + col * (node.maxW + node.gap);
      const cy = tly + row * (node.maxH + node.gap);
      layout(child, cx, cy, results, connectors);
      idx++;
    }
    // Connectors inside grid
    for (const c of (node.children || [])) {
      if (c.tag === 'connector') layout(c, 0, 0, results, connectors);
    }
    return;
  }

  if (tag === 'row') {
    let x = tlx;
    for (const child of node.spatial) {
      layout(child, x, tly, results, connectors);
      x += child.width + node.gap;
    }
    for (const c of (node.children || [])) {
      if (c.tag === 'connector') layout(c, 0, 0, results, connectors);
    }
    return;
  }

  if (tag === 'stack') {
    let y = tly;
    for (const child of node.spatial) {
      layout(child, tlx, y, results, connectors);
      y += child.height + node.gap;
    }
    for (const c of (node.children || [])) {
      if (c.tag === 'connector') layout(c, 0, 0, results, connectors);
    }
    return;
  }
}

// ---------- fillSlots ----------

export const fillSlots = (doc, slots) => {
  const root = doc.documentElement;
  let container;
  if (root.tagName === 'frame') {
    container = spatialChildren(root).find((c) => LAYOUT_TAGS.has(c.tagName));
  } else if (LAYOUT_TAGS.has(root.tagName)) {
    container = root;
  } else {
    return;
  }
  if (!container) return;

  const groups = spatialChildren(container);

  for (let i = 0; i < slots.length && i < groups.length; i++) {
    const group = groups[i];
    const values = slots[i];

    if (LEAF_TAGS.has(group.tagName)) {
      group.textContent = values[0];
    } else if (LAYOUT_TAGS.has(group.tagName)) {
      const leaves = [];
      const walk = (el) => {
        for (const child of Array.from(el.childNodes)) {
          if (!isElement(child)) continue;
          if (LEAF_TAGS.has(child.tagName)) leaves.push(child);
          else if (LAYOUT_TAGS.has(child.tagName)) walk(child);
        }
      };
      walk(group);

      for (let j = 0; j < values.length; j++) {
        if (j < leaves.length) {
          leaves[j].textContent = values[j];
        } else {
          const last = leaves[leaves.length - 1];
          const clone = last.cloneNode(true);
          clone.textContent = values[j];
          last.parentNode.appendChild(clone);
          leaves.push(clone);
        }
      }
    }
  }
};

// ---------- layoutTemplate ----------

export const layoutTemplate = (doc, originX, originY) => {
  const root = doc.documentElement;
  const measured = measure(root);
  const tlx = originX - measured.width / 2;
  const tly = originY - measured.height / 2;
  const results = [];
  const connectors = [];
  layout(measured, tlx, tly, results, connectors);
  return [...results, ...connectors];
};
