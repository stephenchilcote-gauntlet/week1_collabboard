import { describe, it, expect } from 'vitest';
import { TOOLS, TOOL_NAMES } from './tools.js';

describe('TOOLS', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(TOOLS)).toBe(true);
    expect(TOOLS.length).toBeGreaterThan(0);
  });

  it('has exactly 3 consolidated tools', () => {
    expect(TOOL_NAMES).toEqual(['applyTemplate', 'searchTemplates', 'getBoardState']);
  });

  it('every tool has name, description, and input_schema', () => {
    for (const tool of TOOLS) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');
      expect(tool.input_schema.type).toBe('object');
    }
  });

  it('has no duplicate tool names', () => {
    expect(new Set(TOOL_NAMES).size).toBe(TOOL_NAMES.length);
  });

  it('applyTemplate accepts dsl or xml', () => {
    const tool = TOOLS.find((t) => t.name === 'applyTemplate');
    expect(tool.input_schema.properties).toHaveProperty('dsl');
    expect(tool.input_schema.properties).toHaveProperty('xml');
    expect(tool.input_schema.properties).toHaveProperty('x');
    expect(tool.input_schema.properties).toHaveProperty('y');
  });

  it('searchTemplates requires query', () => {
    const tool = TOOLS.find((t) => t.name === 'searchTemplates');
    expect(tool.input_schema.required).toContain('query');
  });

  it('every required field is listed in the schema', () => {
    for (const tool of TOOLS) {
      const { required = [], properties = {} } = tool.input_schema;
      for (const field of required) {
        expect(properties).toHaveProperty(field);
      }
    }
  });
});
