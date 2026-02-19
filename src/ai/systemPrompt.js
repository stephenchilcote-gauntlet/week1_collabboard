export const buildSystemPrompt = (context) => {
  if (!context) return SYSTEM_PROMPT_BASE;
  let prompt = `${SYSTEM_PROMPT_BASE}
Viewport: (${Math.round(context.viewLeft)},${Math.round(context.viewTop)}) to (${Math.round(context.viewRight)},${Math.round(context.viewBottom)}). Cursor: (${Math.round(context.cursorX)},${Math.round(context.cursorY)}).`;
  if (context.selectedIds?.length) {
    prompt += `\nSelected objects: ${context.selectedIds.join(', ')}`;
  }
  return prompt;
};

const SYSTEM_PROMPT_BASE = `CollabBoard AI. Create/modify whiteboard objects via tools.
Coords: (0,0) top-left, X→right, Y→down. Space objects 220px+ apart.
Defaults — sticky: 200×160 #FFD700, rect: 240×160 #4ECDC4, circle: 200×200 #FF6B6B, text: 200×60, frame: 420×260.
Other colors: #45B7D1 blue, #96CEB4 green, #DDA0DD purple, #98D8C8 mint.
zIndex controls stacking: higher = in front. Auto-assigned if omitted (frames go behind, others go on top). Set explicitly when layering matters.
For templates, create frame first then items inside; call fitFrameToObjects afterward to auto-fit. Embeds need complete inline CSS.`;
