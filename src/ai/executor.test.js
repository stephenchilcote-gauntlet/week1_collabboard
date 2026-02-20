import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from './executor.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const makeOperations = (objects = {}) => {
  const store = { ...objects };
  return {
    createObject: vi.fn(async (obj) => {
      store[obj.id] = obj;
      return obj;
    }),
    updateObject: vi.fn(async (id, updates) => {
      store[id] = { ...store[id], ...updates };
    }),
    deleteObject: vi.fn(async (id) => {
      delete store[id];
    }),
    getObjects: () => store,
  };
};

describe('executeTool', () => {
  describe('createObject', () => {
    it('creates a sticky note with defaults', async () => {
      const ops = makeOperations();
      const result = await executeTool('createObject', {
        type: 'sticky', text: 'Hello', x: 100, y: 200,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.type).toBe('sticky');
      const created = ops.createObject.mock.calls[0][0];
      expect(created.type).toBe('sticky');
      expect(created.text).toBe('Hello');
      expect(created.x).toBe(0);
      expect(created.y).toBe(120);
      expect(created.color).toBe('#FFD700');
      expect(created.width).toBe(200);
      expect(created.height).toBe(160);
    });

    it('creates a sticky note with custom color', async () => {
      const ops = makeOperations();
      await executeTool('createObject', {
        type: 'sticky', text: 'Test', x: 0, y: 0, color: '#FF0000',
      }, ops);
      expect(ops.createObject.mock.calls[0][0].color).toBe('#FF0000');
    });

    it('creates a rectangle with defaults', async () => {
      const ops = makeOperations();
      const result = await executeTool('createObject', {
        type: 'rectangle', x: 50, y: 50, width: 300, height: 200,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.type).toBe('rectangle');
      const created = ops.createObject.mock.calls[0][0];
      expect(created.width).toBe(300);
      expect(created.color).toBe('#4ECDC4');
    });

    it('creates a circle with default color', async () => {
      const ops = makeOperations();
      const result = await executeTool('createObject', {
        type: 'circle', x: 50, y: 50, width: 200, height: 200,
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.createObject.mock.calls[0][0].color).toBe('#FF6B6B');
    });

    it('creates a text element with defaults', async () => {
      const ops = makeOperations();
      const result = await executeTool('createObject', {
        type: 'text', text: 'Title', x: 100, y: 50,
      }, ops);
      expect(result.ok).toBe(true);
      const created = ops.createObject.mock.calls[0][0];
      expect(created.text).toBe('Title');
      expect(created.fontSize).toBe(16);
    });

    it('creates a text element with custom fontSize', async () => {
      const ops = makeOperations();
      await executeTool('createObject', {
        type: 'text', text: 'Big', x: 0, y: 0, fontSize: 24,
      }, ops);
      expect(ops.createObject.mock.calls[0][0].fontSize).toBe(24);
    });

    it('creates a frame with title', async () => {
      const ops = makeOperations();
      const result = await executeTool('createObject', {
        type: 'frame', title: 'Sprint', x: 0, y: 0, width: 500, height: 400,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.type).toBe('frame');
      expect(ops.createObject.mock.calls[0][0].title).toBe('Sprint');
    });

    it('creates a connector between two objects', async () => {
      const ops = makeOperations({ a: { id: 'a' }, b: { id: 'b' } });
      const result = await executeTool('createObject', {
        type: 'connector', fromId: 'a', toId: 'b',
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.type).toBe('connector');
    });

    it('fails if connector source missing', async () => {
      const ops = makeOperations({ b: { id: 'b' } });
      const result = await executeTool('createObject', {
        type: 'connector', fromId: 'missing', toId: 'b',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('missing');
    });

    it('fails if connector target missing', async () => {
      const ops = makeOperations({ a: { id: 'a' } });
      const result = await executeTool('createObject', {
        type: 'connector', fromId: 'a', toId: 'missing',
      }, ops);
      expect(result.ok).toBe(false);
    });

    it('creates an embed with HTML', async () => {
      const ops = makeOperations();
      const html = '<table><tr><td>Cell</td></tr></table>';
      const result = await executeTool('createObject', {
        type: 'embed', html, x: 0, y: 0, width: 400, height: 300,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.type).toBe('embed');
      expect(ops.createObject.mock.calls[0][0].html).toBe(html);
    });
  });

  describe('updateObject', () => {
    it('moves an object', async () => {
      const ops = makeOperations({ obj1: { id: 'obj1', x: 0, y: 0 } });
      const result = await executeTool('updateObject', {
        objectId: 'obj1', x: 500, y: 300,
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('obj1', { x: 500, y: 300 });
    });

    it('resizes an object', async () => {
      const ops = makeOperations({ obj1: { id: 'obj1', width: 100, height: 100 } });
      const result = await executeTool('updateObject', {
        objectId: 'obj1', width: 300, height: 200,
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('obj1', { width: 300, height: 200 });
    });

    it('changes text', async () => {
      const ops = makeOperations({ s1: { id: 's1', type: 'sticky', text: 'Old' } });
      const result = await executeTool('updateObject', {
        objectId: 's1', text: 'New',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { text: 'New' });
    });

    it('changes color', async () => {
      const ops = makeOperations({ s1: { id: 's1', color: '#FFD700' } });
      const result = await executeTool('updateObject', {
        objectId: 's1', color: '#FF0000',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { color: '#FF0000' });
    });

    it('can update multiple properties at once', async () => {
      const ops = makeOperations({ s1: { id: 's1', x: 0, y: 0, color: '#FFD700' } });
      const result = await executeTool('updateObject', {
        objectId: 's1', x: 100, y: 200, color: '#FF0000',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { x: 100, y: 200, color: '#FF0000' });
    });

    it('fails for non-existent object', async () => {
      const ops = makeOperations();
      const result = await executeTool('updateObject', {
        objectId: 'ghost', x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ghost');
    });

    it('fails when no updates provided', async () => {
      const ops = makeOperations({ s1: { id: 's1' } });
      const result = await executeTool('updateObject', { objectId: 's1' }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No updates');
    });
  });

  describe('deleteObject', () => {
    it('deletes an existing object', async () => {
      const ops = makeOperations({ d1: { id: 'd1' } });
      const result = await executeTool('deleteObject', { objectId: 'd1' }, ops);
      expect(result.ok).toBe(true);
      expect(ops.deleteObject).toHaveBeenCalledWith('d1');
    });

    it('fails for non-existent object', async () => {
      const ops = makeOperations();
      const result = await executeTool('deleteObject', { objectId: 'ghost' }, ops);
      expect(result.ok).toBe(false);
    });
  });

  describe('getBoardState', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('sends query to sub-agent and returns extracted result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"stickies":[{"label":"a b c","text":"Hello"}]}' }],
        }),
      });
      const ops = makeOperations({
        s1: { id: 's1', type: 'sticky', x: 10, y: 20, text: 'Hello', color: '#FFD700' },
        r1: { id: 'r1', type: 'rectangle', x: 50, y: 60, width: 100, height: 80 },
      });
      const result = await executeTool('getBoardState', { query: 'list all sticky notes' }, ops);
      expect(result.ok).toBe(true);
      expect(result.result).toContain('Hello');
      // Verify the sub-agent was called with board data and query
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.messages[0].content).toContain('list all sticky notes');
      expect(fetchBody.messages[0].content).toContain('s1');
    });

    it('falls back to raw data on sub-agent failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      const ops = makeOperations({
        s1: { id: 's1', type: 'sticky', x: 10, y: 20, text: 'Hello' },
      });
      const result = await executeTool('getBoardState', { query: 'list all objects' }, ops);
      expect(result.ok).toBe(true);
      expect(result.objects).toHaveLength(1);
      expect(result.count).toBe(1);
    });
  });

  describe('label resolution', () => {
    it('creates objects with labels and returns them', async () => {
      const ops = makeOperations();
      const result = await executeTool('createObject', {
        type: 'sticky', text: 'Test', x: 100, y: 100,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.label).toBeDefined();
      expect(result.label).toMatch(/^[a-z]+ [a-z]+ [a-z]+$/);
    });

    it('resolves objects by label in updateObject', async () => {
      const ops = makeOperations();
      const createResult = await executeTool('createObject', {
        type: 'sticky', text: 'Hello', x: 0, y: 0,
      }, ops);
      const result = await executeTool('updateObject', {
        objectId: createResult.label, text: 'Updated',
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.label).toBe(createResult.label);
    });

    it('resolves objects by label in deleteObject', async () => {
      const ops = makeOperations();
      const createResult = await executeTool('createObject', {
        type: 'rectangle', x: 0, y: 0,
      }, ops);
      const result = await executeTool('deleteObject', {
        objectId: createResult.label,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.label).toBe(createResult.label);
    });

    it('resolves connector fromId/toId by labels', async () => {
      const ops = makeOperations();
      const a = await executeTool('createObject', { type: 'circle', x: 0, y: 0 }, ops);
      const b = await executeTool('createObject', { type: 'circle', x: 300, y: 0 }, ops);
      const conn = await executeTool('createObject', {
        type: 'connector', fromId: a.label, toId: b.label,
      }, ops);
      expect(conn.ok).toBe(true);
      expect(conn.label).toBeDefined();
    });

    it('returns error with matches on label collision', async () => {
      const ops = makeOperations({
        x1: { id: 'x1', label: 'dup-label', type: 'sticky' },
        x2: { id: 'x2', label: 'dup-label', type: 'rectangle' },
      });
      const result = await executeTool('updateObject', {
        objectId: 'dup-label', text: 'test',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Multiple');
      expect(result.matches).toHaveLength(2);
    });

    it('still accepts raw UUIDs', async () => {
      const ops = makeOperations({
        'abc-123': { id: 'abc-123', label: 'some-word-label', type: 'sticky', text: 'Old' },
      });
      const result = await executeTool('updateObject', {
        objectId: 'abc-123', text: 'New',
      }, ops);
      expect(result.ok).toBe(true);
    });

    it('getBoardState sub-agent receives objects with labels', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"found":true}' }],
        }),
      });
      const ops = makeOperations();
      await executeTool('createObject', { type: 'sticky', text: 'Hi', x: 0, y: 0 }, ops);
      await executeTool('getBoardState', { query: 'find sticky notes' }, ops);
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const boardData = fetchBody.messages[0].content;
      // The board data sent to the sub-agent should contain a label
      expect(boardData).toMatch(/[a-z]+ [a-z]+ [a-z]+/);
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const ops = makeOperations();
      const result = await executeTool('nonExistent', {}, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });
});
