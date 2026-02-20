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
    description: 'Query the board state using freeform natural language. A sub-agent reads the viewport and extracts only what your query asks for. Send a detailed subquery that includes all relevant context — object types, labels, colors, spatial relationships, or any other details needed for the sub-agent to answer it correctly.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Freeform natural language subquery for the board analysis sub-agent (e.g., "list all sticky notes with their text and colors", "find objects near coordinates (200,300)", "count the frames and their titles"). Be specific about what you need extracted.' },
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
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);
