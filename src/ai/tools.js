// Anthropic tool-use definitions — consolidated to 5 tools for minimal token usage.

export const TOOLS = [
  {
    name: 'createObject',
    description: 'Create a board object. Types: sticky, rectangle, circle, text, frame, connector, embed.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['sticky', 'rectangle', 'circle', 'text', 'frame', 'connector', 'embed'] },
        x: { type: 'number', description: 'Center x coordinate' },
        y: { type: 'number', description: 'Center y coordinate' },
        width: { type: 'number' },
        height: { type: 'number' },
        text: { type: 'string' },
        title: { type: 'string' },
        color: { type: 'string' },
        fontSize: { type: 'number' },
        html: { type: 'string' },
        fromId: { type: 'string', description: 'Label or UUID of source object (for connectors)' },
        toId: { type: 'string', description: 'Label or UUID of target object (for connectors)' },
        style: { type: 'string', enum: ['line', 'arrow'] },
        zIndex: { type: 'number', description: 'Stack order. Higher = in front. Auto-assigned if omitted.' },
      },
      required: ['type'],
    },
  },
  {
    name: 'updateObject',
    description: 'Update one or many objects. Pass objectId + properties for a single update, or pass a "updates" array for batch updates.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'Label or UUID of the object to update (single mode)' },
        x: { type: 'number', description: 'Center x coordinate' },
        y: { type: 'number', description: 'Center y coordinate' },
        width: { type: 'number' },
        height: { type: 'number' },
        text: { type: 'string' },
        color: { type: 'string' },
        title: { type: 'string' },
        zIndex: { type: 'number', description: 'Stack order. Higher = in front.' },
        updates: {
          type: 'array',
          description: 'Batch mode: array of updates, each with objectId and properties to change.',
          items: {
            type: 'object',
            properties: {
              objectId: { type: 'string', description: 'Label or UUID of the object to update' },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              text: { type: 'string' },
              color: { type: 'string' },
              title: { type: 'string' },
              zIndex: { type: 'number' },
            },
            required: ['objectId'],
          },
        },
      },
    },
  },
  {
    name: 'deleteObject',
    description: 'Delete an object by label or ID.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'Label or UUID' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'getBoardState',
    description: 'Query the board state. Use "query" for natural language (sub-agent), or "filter"/"fields" for fast structured queries that bypass the LLM. Text filter uses case-insensitive substring match.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Freeform natural language subquery for the board analysis sub-agent.' },
        filter: {
          type: 'object',
          description: 'Structured filter — match objects by property values (e.g., {"type":"sticky","color":"#FFD700"}). Text filter uses substring match.',
          properties: {
            type: { type: 'string' },
            color: { type: 'string' },
            text: { type: 'string', description: 'Substring match (case-insensitive)' },
            label: { type: 'string' },
          },
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Select specific fields to return (e.g., ["label","x","y","color"]). Omit to return all fields.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'fitFrameToObjects',
    description: 'Resize and reposition a frame to fit the bounding box of the given objects, plus 15% padding.',
    input_schema: {
      type: 'object',
      properties: {
        frameId: { type: 'string', description: 'Label or UUID of the frame to resize.' },
        objectIds: { type: 'array', items: { type: 'string' }, description: 'Labels or UUIDs of objects the frame should enclose.' },
      },
      required: ['frameId', 'objectIds'],
    },
  },
  {
    name: 'layoutObjects',
    description: 'Arrange objects using layout algorithms. Modes: "grid" (arrange in rows/columns), "distributeH"/"distributeV" (equal spacing), "align" (align edges/centers).',
    input_schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['grid', 'distributeH', 'distributeV', 'align'], description: 'Layout algorithm to apply.' },
        objectIds: { type: 'array', items: { type: 'string' }, description: 'Labels or UUIDs of objects to arrange.' },
        columns: { type: 'number', description: 'Grid mode: number of columns (default: sqrt of count).' },
        spacing: { type: 'number', description: 'Grid mode: gap between objects in pixels (default: 30).' },
        startX: { type: 'number', description: 'Grid mode: top-left x of the grid (default: first object x).' },
        startY: { type: 'number', description: 'Grid mode: top-left y of the grid (default: first object y).' },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'], description: 'Align mode: edge or center to align to.' },
      },
      required: ['mode', 'objectIds'],
    },
  },
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);
