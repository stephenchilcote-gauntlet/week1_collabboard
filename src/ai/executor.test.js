import { describe, it, expect, vi, beforeEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { executeTool, collectViewportObjects } from './executor.js';
import { TEMPLATES } from './templates.js';

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

    it('batch updates multiple objects', async () => {
      const ops = makeOperations({
        a: { id: 'a', color: '#000', x: 0, y: 0 },
        b: { id: 'b', color: '#000', x: 10, y: 10 },
      });
      const result = await executeTool('updateObject', {
        updates: [
          { objectId: 'a', color: '#FF0000' },
          { objectId: 'b', color: '#00FF00' },
        ],
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(ops.updateObject).toHaveBeenCalledWith('a', { color: '#FF0000' });
      expect(ops.updateObject).toHaveBeenCalledWith('b', { color: '#00FF00' });
    });

    it('batch reports partial failures', async () => {
      const ops = makeOperations({
        a: { id: 'a', color: '#000' },
      });
      const result = await executeTool('updateObject', {
        updates: [
          { objectId: 'a', color: '#FF0000' },
          { objectId: 'ghost', color: '#00FF00' },
        ],
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('1/2');
      expect(result.results[0].ok).toBe(true);
      expect(result.results[1].ok).toBe(false);
    });

    it('batch with single entry works like single mode', async () => {
      const ops = makeOperations({ a: { id: 'a', text: 'Old' } });
      const result = await executeTool('updateObject', {
        updates: [{ objectId: 'a', text: 'New' }],
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(1);
      expect(ops.updateObject).toHaveBeenCalledWith('a', { text: 'New' });
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

    it('filters objects before sending to sub-agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"found":1}' }],
        }),
      });
      const ops = makeOperations({
        s1: { id: 's1', type: 'sticky', x: 10, y: 20, width: 200, height: 160, text: 'Hello', color: '#FFD700' },
        s2: { id: 's2', type: 'sticky', x: 50, y: 60, width: 200, height: 160, text: 'World', color: '#FF0000' },
        r1: { id: 'r1', type: 'rectangle', x: 100, y: 100, width: 240, height: 160, color: '#FFD700' },
      });
      const result = await executeTool('getBoardState', {
        query: 'list matching stickies',
        filter: { type: 'sticky', color: '#FFD700' },
      }, ops);
      expect(result.ok).toBe(true);
      // Sub-agent should only receive the filtered object
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const boardData = fetchBody.messages[0].content;
      expect(boardData).toContain('Hello');
      expect(boardData).not.toContain('World');
      expect(boardData).not.toContain('rectangle');
    });

    it('selects fields before sending to sub-agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"ok":true}' }],
        }),
      });
      const ops = makeOperations({
        s1: { id: 's1', type: 'sticky', x: 10, y: 20, width: 200, height: 160, text: 'Hi', color: '#FFD700' },
      });
      const result = await executeTool('getBoardState', {
        query: 'summarize',
        filter: { type: 'sticky' },
        fields: ['label', 'color'],
      }, ops);
      expect(result.ok).toBe(true);
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const boardData = fetchBody.messages[0].content;
      expect(boardData).toContain('color');
      expect(boardData).not.toContain('"x"');
    });

    it('text filter uses case-insensitive substring match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"count":1}' }],
        }),
      });
      const ops = makeOperations({
        s1: { id: 's1', type: 'sticky', x: 0, y: 0, width: 200, height: 160, text: 'Hello World' },
        s2: { id: 's2', type: 'sticky', x: 300, y: 0, width: 200, height: 160, text: 'Goodbye' },
      });
      const result = await executeTool('getBoardState', {
        query: 'list them',
        filter: { text: 'hello' },
      }, ops);
      expect(result.ok).toBe(true);
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const boardData = fetchBody.messages[0].content;
      expect(boardData).toContain('Hello World');
      expect(boardData).not.toContain('Goodbye');
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

  describe('collectViewportObjects connectors', () => {
    it('includes connectors between visible objects with from/to labels', () => {
      const ops = makeOperations({
        a: { id: 'a', label: 'node-a', type: 'circle', x: 100, y: 100, width: 50, height: 50 },
        b: { id: 'b', label: 'node-b', type: 'circle', x: 300, y: 100, width: 50, height: 50 },
        c1: { id: 'c1', type: 'connector', fromId: 'a', toId: 'b', style: 'arrow', color: '#000' },
      });
      const result = collectViewportObjects(ops);
      const conn = result.find((o) => o.type === 'connector');
      expect(conn).toBeDefined();
      expect(conn.from).toBe('node-a');
      expect(conn.to).toBe('node-b');
      expect(conn.style).toBe('arrow');
    });

    it('excludes connectors when both endpoints are outside viewport', () => {
      const ops = {
        getObjects: () => ({
          a: { id: 'a', type: 'circle', x: 5000, y: 5000, width: 50, height: 50 },
          b: { id: 'b', type: 'circle', x: 6000, y: 5000, width: 50, height: 50 },
          c1: { id: 'c1', type: 'connector', fromId: 'a', toId: 'b' },
        }),
        viewportContext: { viewLeft: 0, viewTop: 0, viewRight: 800, viewBottom: 600 },
      };
      const result = collectViewportObjects(ops);
      expect(result.find((o) => o.type === 'connector')).toBeUndefined();
    });

    it('includes connector when one endpoint is in viewport', () => {
      const ops = {
        getObjects: () => ({
          a: { id: 'a', type: 'circle', x: 100, y: 100, width: 50, height: 50 },
          b: { id: 'b', type: 'circle', x: 5000, y: 5000, width: 50, height: 50 },
          c1: { id: 'c1', type: 'connector', fromId: 'a', toId: 'b', style: 'line' },
        }),
        viewportContext: { viewLeft: 0, viewTop: 0, viewRight: 800, viewBottom: 600 },
      };
      const result = collectViewportObjects(ops);
      const conn = result.find((o) => o.type === 'connector');
      expect(conn).toBeDefined();
      expect(conn.style).toBe('line');
    });
  });

  describe('layoutObjects', () => {
    it('arranges objects in a grid', async () => {
      const ops = makeOperations({
        a: { id: 'a', x: 0, y: 0, width: 200, height: 160 },
        b: { id: 'b', x: 0, y: 0, width: 200, height: 160 },
        c: { id: 'c', x: 0, y: 0, width: 200, height: 160 },
        d: { id: 'd', x: 0, y: 0, width: 200, height: 160 },
      });
      const result = await executeTool('layoutObjects', {
        mode: 'grid', objectIds: ['a', 'b', 'c', 'd'], columns: 2, spacing: 20, startX: 100, startY: 100,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.arranged).toBe(4);
      expect(result.columns).toBe(2);
      expect(ops.updateObject).toHaveBeenCalledWith('a', { x: 100, y: 100 });
      expect(ops.updateObject).toHaveBeenCalledWith('b', { x: 320, y: 100 });
      expect(ops.updateObject).toHaveBeenCalledWith('c', { x: 100, y: 280 });
      expect(ops.updateObject).toHaveBeenCalledWith('d', { x: 320, y: 280 });
    });

    it('grid defaults columns to sqrt of count', async () => {
      const ops = makeOperations({
        a: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
        b: { id: 'b', x: 0, y: 0, width: 100, height: 100 },
        c: { id: 'c', x: 0, y: 0, width: 100, height: 100 },
        d: { id: 'd', x: 0, y: 0, width: 100, height: 100 },
      });
      const result = await executeTool('layoutObjects', {
        mode: 'grid', objectIds: ['a', 'b', 'c', 'd'], startX: 0, startY: 0,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.columns).toBe(2); // sqrt(4) = 2
    });

    it('aligns objects left', async () => {
      const ops = makeOperations({
        a: { id: 'a', x: 50, y: 0, width: 200, height: 100 },
        b: { id: 'b', x: 100, y: 200, width: 200, height: 100 },
        c: { id: 'c', x: 30, y: 400, width: 200, height: 100 },
      });
      const result = await executeTool('layoutObjects', {
        mode: 'align', objectIds: ['a', 'b', 'c'], alignment: 'left',
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.arranged).toBe(3);
      expect(result.alignment).toBe('left');
      // All should align to x=30 (the minimum)
      expect(ops.updateObject).toHaveBeenCalledWith('a', { x: 30 });
      expect(ops.updateObject).toHaveBeenCalledWith('b', { x: 30 });
      expect(ops.updateObject).toHaveBeenCalledWith('c', { x: 30 });
    });

    it('aligns objects center horizontally', async () => {
      const ops = makeOperations({
        a: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
        b: { id: 'b', x: 200, y: 200, width: 200, height: 100 },
      });
      const result = await executeTool('layoutObjects', {
        mode: 'align', objectIds: ['a', 'b'], alignment: 'center',
      }, ops);
      expect(result.ok).toBe(true);
      // center = (0 + 400) / 2 = 200
      expect(ops.updateObject).toHaveBeenCalledWith('a', { x: 150 }); // 200 - 100/2
      expect(ops.updateObject).toHaveBeenCalledWith('b', { x: 100 }); // 200 - 200/2
    });

    it('distributes objects horizontally', async () => {
      const ops = makeOperations({
        a: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
        b: { id: 'b', x: 500, y: 0, width: 100, height: 100 },
        c: { id: 'c', x: 200, y: 0, width: 100, height: 100 },
      });
      const result = await executeTool('layoutObjects', {
        mode: 'distributeH', objectIds: ['a', 'b', 'c'],
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.arranged).toBe(3);
      expect(result.mode).toBe('distributeH');
    });

    it('distributes objects vertically', async () => {
      const ops = makeOperations({
        a: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
        b: { id: 'b', x: 0, y: 400, width: 100, height: 100 },
      });
      const result = await executeTool('layoutObjects', {
        mode: 'distributeV', objectIds: ['a', 'b'],
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.arranged).toBe(2);
    });

    it('fails with no objectIds', async () => {
      const ops = makeOperations();
      const result = await executeTool('layoutObjects', { mode: 'grid', objectIds: [] }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No objectIds');
    });

    it('fails with no mode', async () => {
      const ops = makeOperations({ a: { id: 'a' } });
      const result = await executeTool('layoutObjects', { objectIds: ['a'] }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('mode');
    });

    it('fails with unknown mode', async () => {
      const ops = makeOperations({ a: { id: 'a' } });
      const result = await executeTool('layoutObjects', { mode: 'spiral', objectIds: ['a'] }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('spiral');
    });

    it('fails with non-existent objectId', async () => {
      const ops = makeOperations({ a: { id: 'a' } });
      const result = await executeTool('layoutObjects', { mode: 'grid', objectIds: ['a', 'ghost'] }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ghost');
    });

    it('distribute fails with fewer than 2 objects', async () => {
      const ops = makeOperations({
        a: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      });
      const result = await executeTool('layoutObjects', {
        mode: 'distributeH', objectIds: ['a'],
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('2 objects');
    });

    it('resolves objects by label', async () => {
      const ops = makeOperations();
      const a = await executeTool('createObject', { type: 'sticky', x: 0, y: 0 }, ops);
      const b = await executeTool('createObject', { type: 'sticky', x: 300, y: 0 }, ops);
      const result = await executeTool('layoutObjects', {
        mode: 'align', objectIds: [a.label, b.label], alignment: 'top',
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.arranged).toBe(2);
    });
  });

  describe('error messages', () => {
    it('not-found error includes board object count and types', async () => {
      const ops = makeOperations({
        s1: { id: 's1', type: 'sticky' },
        r1: { id: 'r1', type: 'rectangle' },
      });
      const result = await executeTool('updateObject', { objectId: 'missing', text: 'x' }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('2 object(s)');
      expect(result.error).toContain('sticky');
      expect(result.error).toContain('rectangle');
    });

    it('not-found on empty board shows 0 objects', async () => {
      const ops = makeOperations();
      const result = await executeTool('deleteObject', { objectId: 'ghost' }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('0 object(s)');
    });
  });

  describe('applyTemplate', () => {
    it('applies a named template via DSL', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        dsl: 'swot "Q1 Review" ; Strength ; Weakness ; Opportunity ; Threat',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBeGreaterThanOrEqual(5); // frame + 4 stickies
      const createdObjs = Object.values(ops.getObjects());
      const frame = createdObjs.find((o) => o.type === 'frame');
      expect(frame).toBeDefined();
      expect(frame.title).toBe('Q1 Review');
      const stickies = createdObjs.filter((o) => o.type === 'sticky');
      expect(stickies.length).toBe(4);
      const texts = stickies.map((s) => s.text).sort();
      expect(texts).toEqual(['Opportunity', 'Strength', 'Threat', 'Weakness']);
    });

    it('applies raw XML to create objects', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<sticky color="#FF0000">Hello</sticky>',
        x: 100, y: 200,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBe(1);
      const created = Object.values(ops.getObjects())[0];
      expect(created.type).toBe('sticky');
      expect(created.text).toBe('Hello');
      expect(created.color).toBe('#FF0000');
    });

    it('creates connectors with key resolution', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<frame title="Flow"><row gap="20"><sticky key="a" color="#FFD700">Start</sticky><sticky key="b" color="#FF6B6B">End</sticky><connector from="a" to="b" style="arrow"/></row></frame>',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      const createdObjs = Object.values(ops.getObjects());
      const conn = createdObjs.find((o) => o.type === 'connector');
      expect(conn).toBeDefined();
      expect(conn.style).toBe('arrow');
      const stickies = createdObjs.filter((o) => o.type === 'sticky');
      expect(conn.fromId).toBe(stickies.find((s) => s.text === 'Start').id);
      expect(conn.toId).toBe(stickies.find((s) => s.text === 'End').id);
    });

    it('creates connectors to existing board objects', async () => {
      const existing = { id: 'existing-1', label: 'my label', type: 'sticky', x: 0, y: 0 };
      const ops = makeOperations({ 'existing-1': existing });
      const result = await executeTool('applyTemplate', {
        xml: '<sticky key="new1" color="#FFD700">New</sticky>',
        x: 300, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      // Now create a connector to the existing object via another applyTemplate call
      const result2 = await executeTool('applyTemplate', {
        xml: '<connector from="my label" to="new1" style="line"/>',
      }, ops);
      // The connector from key "new1" won't resolve since it was a template key, not a label
      // But "my label" resolves via resolveId
      // This tests the fallback to resolveId for connector endpoints
      expect(result2.ok).toBe(true);
    });

    it('fails with unknown template name', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        dsl: 'nonexistent-template',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('nonexistent-template');
    });

    it('fails with no dsl or xml', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {}, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('dsl');
    });

    it('applies DSL patches', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        dsl: 'swot\n@grid/sticky[1]/@color #FF0000',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      const stickies = Object.values(ops.getObjects()).filter((o) => o.type === 'sticky');
      const redSticky = stickies.find((s) => s.color === '#FF0000');
      expect(redSticky).toBeDefined();
    });

    it('frame gets lower zIndex than children', async () => {
      const ops = makeOperations();
      await executeTool('applyTemplate', {
        dsl: 'swot',
        x: 0, y: 0,
      }, ops);
      const createdObjs = Object.values(ops.getObjects());
      const frame = createdObjs.find((o) => o.type === 'frame');
      const stickies = createdObjs.filter((o) => o.type === 'sticky');
      for (const sticky of stickies) {
        expect(sticky.zIndex).toBeGreaterThan(frame.zIndex);
      }
    });

    it('returns error with parsererror for invalid XML', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<sticky color="red">unclosed',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid XML');
    });

    it('errors when DSL has only patches and no template name', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        dsl: '@grid/sticky[1]/@color #FF0000',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('template name');
    });

    it('creates a single object from template with no frame', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<sticky color="#FFD700">Just one</sticky>',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBe(1);
      const objs = Object.values(ops.getObjects());
      expect(objs.length).toBe(1);
      expect(objs[0].type).toBe('sticky');
      expect(objs[0].text).toBe('Just one');
    });

    it('creates multiple stickies via XML row', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<row gap="20"><sticky color="#FFD700">A</sticky><sticky color="#FF6B6B">B</sticky><sticky color="#96CEB4">C</sticky></row>',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBe(3);
      const objs = Object.values(ops.getObjects());
      const texts = objs.map((o) => o.text).sort();
      expect(texts).toEqual(['A', 'B', 'C']);
      // Ensure they have different x positions (laid out in a row)
      const xs = objs.map((o) => o.x);
      const uniqueXs = new Set(xs);
      expect(uniqueXs.size).toBe(3);
    });

    it('places template at specific x,y coordinates', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<sticky color="#FFD700">Placed</sticky>',
        x: 500, y: 300,
      }, ops);
      expect(result.ok).toBe(true);
      const obj = Object.values(ops.getObjects())[0];
      // Object is centered at (500, 300), so x = 500 - width/2, y = 300 - height/2
      const cx = obj.x + obj.width / 2;
      const cy = obj.y + obj.height / 2;
      expect(cx).toBe(500);
      expect(cy).toBe(300);
    });

    it('reports error entry for connector with unresolvable keys but ok is still true', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<frame title="Test"><sticky key="a" color="#FFD700">A</sticky><connector from="nonexistent1" to="nonexistent2" style="arrow"/></frame>',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      const connEntry = result.objects.find((o) => o.type === 'connector' && o.error);
      expect(connEntry).toBeDefined();
      expect(connEntry.error).toContain('Could not resolve');
    });

    it('fills template slots via DSL', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        dsl: 'swot ; MyStrength ; MyWeakness ; MyOpp ; MyThreat',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      const stickies = Object.values(ops.getObjects()).filter((o) => o.type === 'sticky');
      const texts = stickies.map((s) => s.text).sort();
      expect(texts).toEqual(['MyOpp', 'MyStrength', 'MyThreat', 'MyWeakness']);
    });

    it('applies DSL with title AND patches together', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        dsl: 'swot "Patched Title"\n@grid/sticky[1]/@color #0000FF',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      const objs = Object.values(ops.getObjects());
      const frame = objs.find((o) => o.type === 'frame');
      expect(frame.title).toBe('Patched Title');
      const blueSticky = objs.find((o) => o.type === 'sticky' && o.color === '#0000FF');
      expect(blueSticky).toBeDefined();
    });

    it('handles nested frame > grid > sticky layout via XML', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<frame title="Nested"><grid cols="2" gap="10"><sticky color="#FFD700">A</sticky><sticky color="#FF6B6B">B</sticky><sticky color="#96CEB4">C</sticky><sticky color="#45B7D1">D</sticky></grid></frame>',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      const objs = Object.values(ops.getObjects());
      expect(objs.find((o) => o.type === 'frame')).toBeDefined();
      const stickies = objs.filter((o) => o.type === 'sticky');
      expect(stickies.length).toBe(4);
    });

    it('returns parsererror for empty xml string', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', { xml: '' }, ops);
      expect(result.ok).toBe(false);
    });

    it('assigns labels to template objects', async () => {
      const ops = makeOperations();
      await executeTool('applyTemplate', {
        xml: '<sticky color="#FFD700">Labeled</sticky>',
        x: 0, y: 0,
      }, ops);
      const obj = Object.values(ops.getObjects())[0];
      expect(obj.label).toBeDefined();
      expect(typeof obj.label).toBe('string');
      expect(obj.label.length).toBeGreaterThan(0);
    });

    it('creates objects with correct types (frame, sticky, text)', async () => {
      const ops = makeOperations();
      await executeTool('applyTemplate', {
        xml: '<frame title="Types"><row gap="10"><sticky color="#FFD700">S</sticky><text size="16">T</text></row></frame>',
        x: 0, y: 0,
      }, ops);
      const objs = Object.values(ops.getObjects());
      const types = objs.map((o) => o.type);
      expect(types).toContain('frame');
      expect(types).toContain('sticky');
      expect(types).toContain('text');
    });

    it('value-prop template has double-escaped &amp;amp; bug', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        dsl: 'value-prop',
        x: 0, y: 0,
      }, ops);
      expect(result.ok).toBe(true);
      const stickies = Object.values(ops.getObjects()).filter((o) => o.type === 'sticky');
      // The template source uses s('Products &amp; Services', GN)
      // esc() double-escapes &amp; → &amp;amp; in XML, which DOMParser parses back to &amp;
      const ampSticky = stickies.find((s) => s.text && s.text.includes('&'));
      expect(ampSticky).toBeDefined();
      expect(ampSticky.text).toContain('&amp;');
    });

    test.prop([fc.constantFrom(...Object.keys(TEMPLATES))])('every template in TEMPLATES succeeds with ok:true', async (name) => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', { dsl: name, x: 0, y: 0 }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBeGreaterThanOrEqual(1);
    });
  });

  describe('searchTemplates', () => {
    beforeEach(() => { mockFetch.mockReset(); });

    it('returns search results on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'swot|Strengths; Weaknesses|strategic grid' }],
        }),
      });
      const ops = makeOperations();
      const result = await executeTool('searchTemplates', { query: 'strategic analysis' }, ops);
      expect(result.ok).toBe(true);
      expect(result.result).toContain('swot');
    });

    it('returns ok:false with error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      const ops = makeOperations();
      const result = await executeTool('searchTemplates', { query: 'anything' }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('500');
    });

    it('supports streaming mode with onStream callback', async () => {
      const chunks = [];
      const onStream = (chunk) => chunks.push(chunk);
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
              'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"swot|grid"}}\n\n' +
              'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
            ),
          })
          .mockResolvedValueOnce({ done: true }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });
      const ops = makeOperations();
      const result = await executeTool('searchTemplates', { query: 'strategy' }, ops, null, onStream);
      expect(result.ok).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.type === 'subAgentText')).toBe(true);
    });
  });

  describe('XML update via applyTemplate', () => {
    it('updates text of existing object', async () => {
      const ops = makeOperations({ s1: { id: 's1', label: 'snake early india', type: 'sticky', text: 'Old', x: 0, y: 0, width: 200, height: 160 } });
      const result = await executeTool('applyTemplate', {
        xml: '<update ref="snake early india" text="New text"/>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { text: 'New text' });
    });

    it('updates color of existing object', async () => {
      const ops = makeOperations({ s1: { id: 's1', label: 'snake early india', type: 'sticky', color: '#FFD700', x: 0, y: 0, width: 200, height: 160 } });
      const result = await executeTool('applyTemplate', {
        xml: '<update ref="snake early india" color="#FF0000"/>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { color: '#FF0000' });
    });

    it('updates position (center coords)', async () => {
      const ops = makeOperations({ s1: { id: 's1', label: 'snake early india', type: 'sticky', x: 0, y: 0, width: 200, height: 160 } });
      const result = await executeTool('applyTemplate', {
        xml: '<update ref="snake early india" x="500" y="300"/>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { x: 400, y: 220 });
    });

    it('updates size', async () => {
      const ops = makeOperations({ s1: { id: 's1', label: 'snake early india', type: 'sticky', x: 0, y: 0, width: 200, height: 160 } });
      const result = await executeTool('applyTemplate', {
        xml: '<update ref="snake early india" width="300" height="200"/>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { width: 300, height: 200 });
    });

    it('updates frame title', async () => {
      const ops = makeOperations({ f1: { id: 'f1', label: 'delta echo foxtrot', type: 'frame', title: 'Old', x: 0, y: 0, width: 500, height: 400 } });
      const result = await executeTool('applyTemplate', {
        xml: '<update ref="delta echo foxtrot" title="Sprint 42"/>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('f1', { title: 'Sprint 42' });
    });

    it('updates zIndex', async () => {
      const ops = makeOperations({ s1: { id: 's1', label: 'snake early india', type: 'sticky', x: 0, y: 0, width: 200, height: 160 } });
      const result = await executeTool('applyTemplate', {
        xml: '<update ref="snake early india" zIndex="100"/>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { zIndex: 100 });
    });

    it('fails for non-existent object', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<update ref="ghost label here" text="Nope"/>',
      }, ops);
      expect(result.ok).toBe(false);
    });

    it('fails with no ref attribute', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<update text="No ref"/>',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.results[0].error).toContain('No ref');
    });
  });

  describe('XML delete via applyTemplate', () => {
    it('deletes an existing object', async () => {
      const ops = makeOperations({ s1: { id: 's1', label: 'snake early india', type: 'sticky' } });
      const result = await executeTool('applyTemplate', {
        xml: '<delete ref="snake early india"/>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.deleteObject).toHaveBeenCalledWith('s1');
    });

    it('fails for non-existent object', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<delete ref="ghost label here"/>',
      }, ops);
      expect(result.ok).toBe(false);
    });

    it('fails with no ref attribute', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<delete/>',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.results[0].error).toContain('No ref');
    });
  });

  describe('XML layout via applyTemplate', () => {
    it('grid layout', async () => {
      const ops = makeOperations({
        a: { id: 'a', label: 'alpha bravo charlie', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
        b: { id: 'b', label: 'delta echo foxtrot', type: 'sticky', x: 10, y: 10, width: 200, height: 160 },
        c: { id: 'c', label: 'golf hotel india', type: 'sticky', x: 20, y: 20, width: 200, height: 160 },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<layout mode="grid" cols="3" gap="30"><ref>alpha bravo charlie</ref><ref>delta echo foxtrot</ref><ref>golf hotel india</ref></layout>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledTimes(3);
    });

    it('align left', async () => {
      const ops = makeOperations({
        a: { id: 'a', label: 'alpha bravo charlie', type: 'sticky', x: 100, y: 0, width: 200, height: 160 },
        b: { id: 'b', label: 'delta echo foxtrot', type: 'sticky', x: 200, y: 100, width: 200, height: 160 },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<layout mode="align" alignment="left"><ref>alpha bravo charlie</ref><ref>delta echo foxtrot</ref></layout>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('a', { x: 100 });
      expect(ops.updateObject).toHaveBeenCalledWith('b', { x: 100 });
    });

    it('distributeH', async () => {
      const ops = makeOperations({
        a: { id: 'a', label: 'alpha bravo charlie', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
        b: { id: 'b', label: 'delta echo foxtrot', type: 'sticky', x: 500, y: 0, width: 200, height: 160 },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<layout mode="distributeH"><ref>alpha bravo charlie</ref><ref>delta echo foxtrot</ref></layout>',
      }, ops);
      expect(result.ok).toBe(true);
    });

    it('fails with no mode', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<layout><ref>abc</ref></layout>',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.results[0].error).toContain('No mode');
    });

    it('fails with no refs', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<layout mode="grid"/>',
      }, ops);
      expect(result.ok).toBe(false);
      expect(result.results[0].error).toContain('No <ref>');
    });
  });

  describe('XML batch via applyTemplate', () => {
    it('batch update + delete', async () => {
      const ops = makeOperations({
        s1: { id: 's1', label: 'snake early india', type: 'sticky', text: 'Old', x: 0, y: 0, width: 200, height: 160 },
        s2: { id: 's2', label: 'bacon cold florida', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<batch><update ref="snake early india" text="Updated"/><delete ref="bacon cold florida"/></batch>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { text: 'Updated' });
      expect(ops.deleteObject).toHaveBeenCalledWith('s2');
    });

    it('batch create + update', async () => {
      const ops = makeOperations({
        s1: { id: 's1', label: 'snake early india', type: 'sticky', x: 0, y: 0, width: 200, height: 160, color: '#FFD700' },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<batch><sticky color="#FF6B6B">New Note</sticky><update ref="snake early india" color="#DDA0DD"/></batch>',
        x: 500, y: 300,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBe(1);
      expect(ops.createObject).toHaveBeenCalledTimes(1);
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { color: '#DDA0DD' });
    });

    it('batch create + delete + update', async () => {
      const ops = makeOperations({
        s1: { id: 's1', label: 'snake early india', type: 'sticky', text: 'Old', x: 0, y: 0, width: 200, height: 160 },
        s2: { id: 's2', label: 'happy cat delaware', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<batch><sticky color="#FF0000">Urgent Fix</sticky><delete ref="happy cat delaware"/><update ref="snake early india" text="Started"/></batch>',
        x: 600, y: 700,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBe(1);
      expect(ops.createObject).toHaveBeenCalledTimes(1);
      expect(ops.deleteObject).toHaveBeenCalledWith('s2');
      expect(ops.updateObject).toHaveBeenCalledWith('s1', { text: 'Started' });
    });

    it('batch with multiple creates using individual positions', async () => {
      const ops = makeOperations();
      const result = await executeTool('applyTemplate', {
        xml: '<batch><sticky color="#FFD700" x="200" y="100">A</sticky><sticky color="#FF6B6B" x="500" y="100">B</sticky></batch>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBe(2);
      const calls = ops.createObject.mock.calls;
      const objA = calls.find((c) => c[0].text === 'A')[0];
      const objB = calls.find((c) => c[0].text === 'B')[0];
      const cxA = objA.x + objA.width / 2;
      const cxB = objB.x + objB.width / 2;
      expect(cxA).toBe(200);
      expect(cxB).toBe(500);
    });

    it('batch with only operations (no spatial)', async () => {
      const ops = makeOperations({
        s1: { id: 's1', label: 'snake early india', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
        s2: { id: 's2', label: 'bacon cold florida', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
        s3: { id: 's3', label: 'happy cat delaware', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<batch><update ref="snake early india" color="#45B7D1"/><update ref="bacon cold florida" color="#45B7D1"/><update ref="happy cat delaware" color="#45B7D1"/></batch>',
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.created).toBe(0);
      expect(ops.updateObject).toHaveBeenCalledTimes(3);
    });

    it('batch with layout operation', async () => {
      const ops = makeOperations({
        a: { id: 'a', label: 'alpha bravo charlie', type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
        b: { id: 'b', label: 'delta echo foxtrot', type: 'sticky', x: 10, y: 10, width: 200, height: 160 },
      });
      const result = await executeTool('applyTemplate', {
        xml: '<batch><update ref="alpha bravo charlie" color="#FF0000"/><layout mode="grid" cols="2"><ref>alpha bravo charlie</ref><ref>delta echo foxtrot</ref></layout></batch>',
      }, ops);
      expect(result.ok).toBe(true);
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
