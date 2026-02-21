/**
 * Custom path evaluator for surgical template updates.
 * Uses manual element traversal on a Document object (from DOMParser).
 *
 * Path syntax:
 *   - Segments separated by '/'
 *   - Each segment: tagName or tagName[N] (1-indexed)
 *   - Final segment can be /@attrName to target an attribute
 *   - First segment uses descendant search (getElementsByTagName)
 *   - Subsequent segments search direct children only
 *   - If no index, defaults to [1]
 */

export const applyPatches = (doc, patches) => {
  for (const { path, value } of patches) {
    applyOne(doc, path, value);
  }
  return doc;
};

function applyOne(doc, path, value) {
  // Check for trailing /@attr
  let attrName = null;
  let elemPath = path;
  const attrMatch = path.match(/\/@([^/]+)$/);
  if (attrMatch) {
    attrName = attrMatch[1];
    elemPath = path.slice(0, path.length - attrMatch[0].length);
  }

  const segments = elemPath.split('/');
  let current = null;

  for (let i = 0; i < segments.length; i++) {
    const { tag, index } = parseSegment(segments[i]);
    if (i === 0) {
      // Descendant search from document element
      const found = doc.getElementsByTagName(tag);
      if (index > found.length) return;
      current = found[index - 1];
    } else {
      // Direct children only
      if (!current) return;
      const children = Array.from(current.children).filter((c) => c.tagName === tag);
      if (index > children.length) return;
      current = children[index - 1];
    }
    if (!current) return;
  }

  if (attrName) {
    current.setAttribute(attrName, value);
  } else {
    current.textContent = value;
  }
}

function parseSegment(seg) {
  const match = seg.match(/^([^[]+)(?:\[(\d+)])?$/);
  if (!match) return { tag: seg, index: 1 };
  return { tag: match[1], index: match[2] ? parseInt(match[2], 10) : 1 };
}
