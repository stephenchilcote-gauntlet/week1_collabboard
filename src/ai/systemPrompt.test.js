import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './systemPrompt.js';

describe('buildSystemPrompt', () => {
  it('returns base prompt when context is null', () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toContain('CollabBoard');
    expect(prompt).toContain('applyTemplate');
    expect(prompt).toContain('DSL');
    expect(prompt).not.toContain('Viewport');
  });

  it('appends viewport and cursor when context provided', () => {
    const prompt = buildSystemPrompt({
      viewLeft: -200, viewTop: -100, viewRight: 1400, viewBottom: 900,
      cursorX: 500, cursorY: 350,
    });
    expect(prompt).toContain('(-200,-100)');
    expect(prompt).toContain('(1400,900)');
    expect(prompt).toContain('(500,350)');
  });

  it('rounds coordinates to integers', () => {
    const prompt = buildSystemPrompt({
      viewLeft: -199.7, viewTop: -100.3, viewRight: 1400.5, viewBottom: 899.9,
      cursorX: 500.4, cursorY: 350.6,
    });
    expect(prompt).toContain('(-200,-100)');
    expect(prompt).toContain('(1401,900)');
    expect(prompt).toContain('(500,351)');
  });

  it('includes selected object IDs when present', () => {
    const prompt = buildSystemPrompt({
      viewLeft: 0, viewTop: 0, viewRight: 1000, viewBottom: 800,
      cursorX: 500, cursorY: 400,
      selectedIds: ['abc123', 'def456'],
    });
    expect(prompt).toContain('Selected objects: abc123, def456');
  });

  it('omits selected objects line when none selected', () => {
    const prompt = buildSystemPrompt({
      viewLeft: 0, viewTop: 0, viewRight: 1000, viewBottom: 800,
      cursorX: 500, cursorY: 400,
      selectedIds: [],
    });
    expect(prompt).not.toContain('Selected');
  });
});
