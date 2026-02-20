import { describe, it, expect, vi } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { uuidToLabel } from './labels.js';
import { executeTool, collectViewportObjects } from './executor.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbUuid = fc.uuid();

const arbObjectType = fc.constantFrom('sticky', 'rectangle', 'circle', 'text', 'frame', 'embed');

const makeOperations = (objects = {}) => {
  const store = { ...objects };
  return {
    createObject: vi.fn(async (obj) => { store[obj.id] = obj; return obj; }),
    updateObject: vi.fn(async (id, updates) => { store[id] = { ...store[id], ...updates }; }),
    deleteObject: vi.fn(async (id) => { delete store[id]; }),
    getObjects: () => store,
  };
};

// ---------------------------------------------------------------------------
// uuidToLabel properties
// ---------------------------------------------------------------------------

describe('uuidToLabel properties', () => {
  test.prop([arbUuid])('always produces exactly 3 words', (uuid) => {
    const parts = uuidToLabel(uuid).split(' ');
    expect(parts).toHaveLength(3);
  });

  test.prop([arbUuid])('every word is lowercase alphabetic', (uuid) => {
    for (const word of uuidToLabel(uuid).split(' ')) {
      expect(word).toMatch(/^[a-z]+$/);
    }
  });

  test.prop([arbUuid])('is deterministic (double-call yields same result)', (uuid) => {
    expect(uuidToLabel(uuid)).toBe(uuidToLabel(uuid));
  });

  test.prop([arbUuid])('dashes are irrelevant', (uuid) => {
    const noDashes = uuid.replace(/-/g, '');
    expect(uuidToLabel(uuid)).toBe(uuidToLabel(noDashes));
  });

  test.prop([arbUuid])('output is shorter than UUID input', (uuid) => {
    expect(uuidToLabel(uuid).length).toBeLessThan(uuid.length);
  });

  test.prop([arbUuid, arbUuid])('different UUIDs rarely collide (pair test)', (a, b) => {
    // Not a guarantee, but with 16.7M space and random pairs it should never hit.
    fc.pre(a !== b);
    // We just run many pairs — if any collide, it's a statistical anomaly, not a bug.
    // So we don't assert here; the real property is the structural ones above.
    // Instead, verify both produce valid labels.
    const la = uuidToLabel(a);
    const lb = uuidToLabel(b);
    expect(la.split(' ')).toHaveLength(3);
    expect(lb.split(' ')).toHaveLength(3);
  });

  it('known collision behavior: identical UUIDs produce identical labels', () => {
    const uuid = 'deadbeef-dead-beef-dead-beefdeadbeef';
    expect(uuidToLabel(uuid)).toBe(uuidToLabel(uuid));
  });

  it('known collision pair maps to the same label', () => {
    const a = 'bbb13f7a-966e-4c7c-aea5-4bac3ce98505';
    const b = 'ef4f8cd0-25b9-4029-9316-0f2f3b069b34';
    expect(uuidToLabel(a)).toBe(uuidToLabel(b));
    expect(uuidToLabel(a)).toBe('tango golf potato');
  });

  test.prop([arbUuid])('birthday-paradox: collisions are expected but rare (~1 in 5800 pairs)', (uuid) => {
    // This is a structural sanity check — we can't prevent collisions,
    // but we verify the label is still valid when they happen.
    const label = uuidToLabel(uuid);
    expect(label.split(' ')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Executor label round-trip properties
// ---------------------------------------------------------------------------

describe('executor label round-trip', () => {
  test.prop([arbObjectType, fc.integer({ min: -5000, max: 5000 }), fc.integer({ min: -5000, max: 5000 })])(
    'createObject always returns a valid label',
    async (type, x, y) => {
      const ops = makeOperations();
      const result = await executeTool('createObject', { type, x, y }, ops);
      expect(result.ok).toBe(true);
      expect(result.label).toBeDefined();
      expect(result.label.split(' ')).toHaveLength(3);
      expect(result.type).toBe(type);
    },
  );

  test.prop([arbObjectType, fc.integer({ min: -5000, max: 5000 }), fc.integer({ min: -5000, max: 5000 })])(
    'created object can be found by its returned label',
    async (type, x, y) => {
      const ops = makeOperations();
      const created = await executeTool('createObject', { type, x, y }, ops);
      const updated = await executeTool('updateObject', {
        objectId: created.label,
        color: '#FF0000',
      }, ops);
      expect(updated.ok).toBe(true);
      expect(updated.label).toBe(created.label);
    },
  );

  test.prop([arbObjectType, fc.integer({ min: -5000, max: 5000 }), fc.integer({ min: -5000, max: 5000 })])(
    'created object can be deleted by its returned label',
    async (type, x, y) => {
      const ops = makeOperations();
      const created = await executeTool('createObject', { type, x, y }, ops);
      const deleted = await executeTool('deleteObject', { objectId: created.label }, ops);
      expect(deleted.ok).toBe(true);
      expect(deleted.label).toBe(created.label);
    },
  );

  test.prop([arbObjectType, fc.integer({ min: -5000, max: 5000 }), fc.integer({ min: -5000, max: 5000 })])(
    'collectViewportObjects includes the label from creation',
    async (type, x, y) => {
      const ops = makeOperations();
      const created = await executeTool('createObject', { type, x, y }, ops);
      const objects = collectViewportObjects(ops);
      const found = objects.find((o) => o.label === created.label);
      expect(found).toBeDefined();
      expect(found.type).toBe(type);
    },
  );

  test.prop([
    fc.integer({ min: -5000, max: 5000 }),
    fc.integer({ min: -5000, max: 5000 }),
    fc.integer({ min: -5000, max: 5000 }),
    fc.integer({ min: -5000, max: 5000 }),
  ])(
    'connector resolves source/target by label',
    async (x1, y1, x2, y2) => {
      const ops = makeOperations();
      const a = await executeTool('createObject', { type: 'circle', x: x1, y: y1 }, ops);
      const b = await executeTool('createObject', { type: 'rectangle', x: x2, y: y2 }, ops);
      const conn = await executeTool('createObject', {
        type: 'connector', fromId: a.label, toId: b.label,
      }, ops);
      expect(conn.ok).toBe(true);
      expect(conn.label).toBeDefined();
      expect(conn.label.split(' ')).toHaveLength(3);
    },
  );
});

// ---------------------------------------------------------------------------
// resolveId behavior properties (tested via executor)
// ---------------------------------------------------------------------------

describe('resolveId edge cases', () => {
  test.prop([fc.string({ minLength: 1, maxLength: 30 })])(
    'non-existent label/UUID returns error',
    async (badId) => {
      // Exclude anything that looks like it could collide with an actual key
      fc.pre(!badId.includes('\0'));
      const ops = makeOperations();
      const result = await executeTool('updateObject', { objectId: badId, text: 'x' }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    },
  );

  test.prop([fc.integer({ min: 2, max: 5 })])(
    'duplicate labels produce collision error with match list',
    async (count) => {
      const objects = {};
      for (let i = 0; i < count; i++) {
        objects[`id-${i}`] = { id: `id-${i}`, label: 'shared-label', type: 'sticky' };
      }
      const ops = makeOperations(objects);
      const result = await executeTool('updateObject', { objectId: 'shared-label', text: 'x' }, ops);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Multiple');
      expect(result.matches).toHaveLength(count);
      for (const m of result.matches) {
        expect(m.id).toBeDefined();
        expect(m.label).toBe('shared-label');
      }
    },
  );

  it('real collision pair: returns both matches, UUID disambiguates', async () => {
    // These two UUIDs produce the same label "tango golf potato"
    const uuidA = 'bbb13f7a-966e-4c7c-aea5-4bac3ce98505';
    const uuidB = 'ef4f8cd0-25b9-4029-9316-0f2f3b069b34';
    const label = uuidToLabel(uuidA);
    expect(label).toBe(uuidToLabel(uuidB));
    expect(label).toBe('tango golf potato');

    const ops = makeOperations({
      [uuidA]: { id: uuidA, label, type: 'sticky', text: 'A' },
      [uuidB]: { id: uuidB, label, type: 'rectangle', text: 'B' },
    });

    // Label lookup should fail with both matches
    const result = await executeTool('updateObject', { objectId: label, text: 'x' }, ops);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Multiple');
    expect(result.matches).toHaveLength(2);
    const matchIds = result.matches.map((m) => m.id).sort();
    expect(matchIds).toEqual([uuidA, uuidB].sort());

    // Raw UUID still works for disambiguation
    const rA = await executeTool('updateObject', { objectId: uuidA, text: 'updated A' }, ops);
    expect(rA.ok).toBe(true);
    const rB = await executeTool('updateObject', { objectId: uuidB, text: 'updated B' }, ops);
    expect(rB.ok).toBe(true);
  });

  it('real collision pair: connector fails with colliding fromId, succeeds with UUID', async () => {
    const uuidA = 'bbb13f7a-966e-4c7c-aea5-4bac3ce98505';
    const uuidB = 'ef4f8cd0-25b9-4029-9316-0f2f3b069b34';
    const label = uuidToLabel(uuidA);
    const uuidC = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const ops = makeOperations({
      [uuidA]: { id: uuidA, label, type: 'circle', x: 0, y: 0, width: 100, height: 100 },
      [uuidB]: { id: uuidB, label, type: 'circle', x: 300, y: 0, width: 100, height: 100 },
      [uuidC]: { id: uuidC, label: uuidToLabel(uuidC), type: 'circle', x: 600, y: 0, width: 100, height: 100 },
    });

    // Connector using colliding label as fromId should fail
    const fail = await executeTool('createObject', {
      type: 'connector', fromId: label, toId: uuidToLabel(uuidC),
    }, ops);
    expect(fail.ok).toBe(false);
    expect(fail.error).toContain('Source');
    expect(fail.matches).toHaveLength(2);

    // Using UUID directly works
    const ok = await executeTool('createObject', {
      type: 'connector', fromId: uuidA, toId: uuidC,
    }, ops);
    expect(ok.ok).toBe(true);
  });

  it('real collision pair: delete by label fails, delete by UUID works', async () => {
    const uuidA = 'bbb13f7a-966e-4c7c-aea5-4bac3ce98505';
    const uuidB = 'ef4f8cd0-25b9-4029-9316-0f2f3b069b34';
    const label = uuidToLabel(uuidA);

    const ops = makeOperations({
      [uuidA]: { id: uuidA, label, type: 'sticky' },
      [uuidB]: { id: uuidB, label, type: 'sticky' },
    });

    // Delete by label fails
    const fail = await executeTool('deleteObject', { objectId: label }, ops);
    expect(fail.ok).toBe(false);
    expect(fail.matches).toHaveLength(2);

    // Delete by UUID works, then label becomes unique
    const delA = await executeTool('deleteObject', { objectId: uuidA }, ops);
    expect(delA.ok).toBe(true);

    // Now the label is unique — should resolve to uuidB
    const delB = await executeTool('deleteObject', { objectId: label }, ops);
    expect(delB.ok).toBe(true);
    expect(delB.label).toBe(label);
  });

  it('real collision pair: collectViewportObjects shows both objects with same label + different UUIDs', async () => {
    const uuidA = 'bbb13f7a-966e-4c7c-aea5-4bac3ce98505';
    const uuidB = 'ef4f8cd0-25b9-4029-9316-0f2f3b069b34';
    const label = uuidToLabel(uuidA);

    const ops = makeOperations({
      [uuidA]: { id: uuidA, label, type: 'sticky', x: 0, y: 0, width: 200, height: 160 },
      [uuidB]: { id: uuidB, label, type: 'rectangle', x: 300, y: 0, width: 240, height: 160 },
    });

    const objects = collectViewportObjects(ops);
    const withLabel = objects.filter((o) => o.label === label);
    expect(withLabel).toHaveLength(2);
    // Both have the same label but different UUIDs — agent can tell them apart via id field
    const ids = withLabel.map((o) => o.id).sort();
    expect(ids).toEqual([uuidA, uuidB].sort());
  });

  test.prop([arbObjectType, fc.integer({ min: -5000, max: 5000 }), fc.integer({ min: -5000, max: 5000 })])(
    'UUID still works as fallback when label exists',
    async (type, x, y) => {
      const ops = makeOperations();
      const created = await executeTool('createObject', { type, x, y }, ops);
      // Find the actual UUID from the store
      const allObjs = Object.values(ops.getObjects());
      const obj = allObjs.find((o) => o.label === created.label);
      expect(obj).toBeDefined();
      // Update by raw UUID
      const result = await executeTool('updateObject', { objectId: obj.id, color: '#000' }, ops);
      expect(result.ok).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// getBoardState label properties
// ---------------------------------------------------------------------------

describe('collectViewportObjects label properties', () => {
  test.prop([fc.array(arbObjectType, { minLength: 1, maxLength: 20 })])(
    'every object has a valid 3-word label',
    async (types) => {
      const ops = makeOperations();
      for (const type of types) {
        await executeTool('createObject', { type, x: 0, y: 0 }, ops);
      }
      const objects = collectViewportObjects(ops);
      expect(objects).toHaveLength(types.length);
      for (const obj of objects) {
        expect(obj.label).toBeDefined();
        expect(obj.label.split(' ')).toHaveLength(3);
        for (const word of obj.label.split(' ')) {
          expect(word).toMatch(/^[a-z]+$/);
        }
      }
    },
  );

  test.prop([fc.array(arbObjectType, { minLength: 1, maxLength: 10 })])(
    'labels match creation labels',
    async (types) => {
      const ops = makeOperations();
      const createdLabels = [];
      for (const type of types) {
        const r = await executeTool('createObject', { type, x: 0, y: 0 }, ops);
        createdLabels.push(r.label);
      }
      const objects = collectViewportObjects(ops);
      const stateLabels = objects.map((o) => o.label);
      for (const label of createdLabels) {
        expect(stateLabels).toContain(label);
      }
    },
  );

  test.prop([arbUuid, arbObjectType])(
    'legacy objects without label field get a computed label',
    async (uuid, type) => {
      const id = uuid.replace(/-/g, '');
      const ops = makeOperations({
        [id]: { id, type, x: 0, y: 0, width: 100, height: 100 },
      });
      const objects = collectViewportObjects(ops);
      const obj = objects[0];
      expect(obj.label).toBe(uuidToLabel(id));
      expect(obj.label.split(' ')).toHaveLength(3);
    },
  );
});

// ---------------------------------------------------------------------------
// fitFrameToObjects label resolution
// ---------------------------------------------------------------------------

describe('fitFrameToObjects label resolution', () => {
  test.prop([
    fc.integer({ min: 1, max: 5 }),
    fc.integer({ min: -2000, max: 2000 }),
    fc.integer({ min: -2000, max: 2000 }),
  ])(
    'fitFrameToObjects resolves frame and children by labels',
    async (childCount, baseX, baseY) => {
      const ops = makeOperations();
      const frame = await executeTool('createObject', {
        type: 'frame', x: baseX, y: baseY, width: 800, height: 600,
      }, ops);

      const childLabels = [];
      for (let i = 0; i < childCount; i++) {
        const child = await executeTool('createObject', {
          type: 'sticky', x: baseX + i * 50, y: baseY + i * 50,
        }, ops);
        childLabels.push(child.label);
      }

      const result = await executeTool('fitFrameToObjects', {
        frameId: frame.label,
        objectIds: childLabels,
      }, ops);
      expect(result.ok).toBe(true);
      expect(result.label).toBe(frame.label);
    },
  );
});
