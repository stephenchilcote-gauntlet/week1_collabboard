// Anthropic tool-use definitions — consolidated tools for minimal token usage.

export const TOOLS = [
  {
    name: 'applyTemplate',
    description: 'Create, update, delete, and layout board objects. Use dsl for named templates, xml for everything else.\n' +
      'Create: <sticky color="#FFD700">text</sticky>, <frame title="T"><row gap="30">...</row></frame>\n' +
      'Update: <update ref="label" text="new" color="#FF0000" x="500" y="300"/>\n' +
      'Delete: <delete ref="label"/>\n' +
      'Layout: <layout mode="grid" cols="3"><ref>label1</ref><ref>label2</ref></layout> (modes: grid, distributeH, distributeV, align)\n' +
      'Batch: <batch><sticky>New</sticky><update ref="label" color="#FF0000"/><delete ref="old"/></batch>\n' +
      'DSL: templateName "Title" ; slot1 ; slot2. Patches: @path value. Pipes: slot1|sub1|sub2.\n' +
      'Connector: <connector from="key" to="key" style="arrow"/>. Use key= on elements for refs.',
    input_schema: {
      type: 'object',
      properties: {
        dsl: { type: 'string', description: 'DSL program: template name + slots/patches. Example: swot "Q1 Review" ; Strengths ; Weaknesses ; Opportunities ; Threats' },
        xml: { type: 'string', description: 'XML for create/update/delete/layout. Elements: sticky, text, rect, circle, frame, embed, connector, update, delete, layout, batch.' },
        x: { type: 'number', description: 'Center x for placement (default: cursor or 0)' },
        y: { type: 'number', description: 'Center y for placement (default: cursor or 0)' },
      },
    },
  },
  {
    name: 'searchTemplates',
    description: 'Search the template catalog. Returns matching template IDs with slot info. Call before applyTemplate if unsure which template to use.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query, e.g. "kanban board" or "strategic analysis grid"' },
      },
      required: ['query'],
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

];

export const TOOL_NAMES = TOOLS.map((t) => t.name);
