import { describe, it, expect } from 'vitest';
import { TOOLS, TOOL_NAMES } from './tools.js';

describe('TOOLS', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(TOOLS)).toBe(true);
    expect(TOOLS.length).toBeGreaterThan(0);
  });

  it('has exactly 6 consolidated tools', () => {
    expect(TOOL_NAMES).toEqual(['createObject', 'updateObject', 'deleteObject', 'getBoardState', 'fitFrameToObjects', 'layoutObjects']);
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

  it('createObject supports all board object types', () => {
    const createTool = TOOLS.find((t) => t.name === 'createObject');
    const typeEnum = createTool.input_schema.properties.type.enum;
    expect(typeEnum).toContain('sticky');
    expect(typeEnum).toContain('rectangle');
    expect(typeEnum).toContain('circle');
    expect(typeEnum).toContain('text');
    expect(typeEnum).toContain('frame');
    expect(typeEnum).toContain('connector');
    expect(typeEnum).toContain('embed');
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
