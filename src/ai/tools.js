// Anthropic tool-use definitions — consolidated to 4 tools for minimal token usage.

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
        fromId: { type: 'string' },
        toId: { type: 'string' },
        style: { type: 'string', enum: ['line', 'arrow'] },
        zIndex: { type: 'number', description: 'Stack order. Higher = in front. Auto-assigned if omitted.' },
      },
      required: ['type'],
    },
  },
  {
    name: 'updateObject',
    description: 'Update any properties of an existing object by ID.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        x: { type: 'number', description: 'Center x coordinate' },
        y: { type: 'number', description: 'Center y coordinate' },
        width: { type: 'number' },
        height: { type: 'number' },
        text: { type: 'string' },
        color: { type: 'string' },
        title: { type: 'string' },
        zIndex: { type: 'number', description: 'Stack order. Higher = in front.' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'deleteObject',
    description: 'Delete an object by ID.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'getBoardState',
    description: 'Get all objects currently on the board.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);
