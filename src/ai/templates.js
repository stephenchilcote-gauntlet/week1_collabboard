// Template library — 77 pre-defined XML templates for the AI agent.
// Built with compact helper functions that generate valid XML strings.

const G = '#FFD700', R = '#FF6B6B', GN = '#96CEB4', B = '#45B7D1', P = '#DDA0DD', M = '#98D8C8';

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = (v) => esc(v).replace(/"/g, '&quot;');
const s = (txt, color = G) => `<sticky color="${color}">${esc(txt)}</sticky>`;
const t = (txt, size = 20) => `<text size="${size}">${esc(txt)}</text>`;
const fr = (title, inner) => `<frame title="${escA(title)}">${inner}</frame>`;
const rw = (items, gap = 30) => `<row gap="${gap}">${items.join('')}</row>`;
const gr = (items, cols = 2, gap = 30) => `<grid cols="${cols}" gap="${gap}">${items.join('')}</grid>`;
const sk = (items, gap = 10) => `<stack gap="${gap}">${items.join('')}</stack>`;
const cl = (header, items) => sk([t(header), ...items]);
const ucl = (header, n, color) => cl(header, Array.from({ length: n }, () => s('Item', color)));

export const TEMPLATES = {};
const T = TEMPLATES;

// --- Archetype 1: 2×2 Grid (12) ---
T.swot = fr('SWOT Analysis', gr([s('Strengths', G), s('Weaknesses', R), s('Opportunities', GN), s('Threats', B)]));
T.pest = fr('PEST Analysis', gr([s('Political', R), s('Economic', G), s('Social', GN), s('Technological', B)]));
T['bcg-matrix'] = fr('BCG Growth-Share Matrix', gr([s('Stars', G), s('Cash Cows', GN), s('Question Marks', B), s('Dogs', R)]));
T.ansoff = fr('Ansoff Growth Matrix', gr([s('Market Penetration', GN), s('Product Development', B), s('Market Development', G), s('Diversification', P)]));
T['priority-matrix'] = fr('Priority Matrix', gr([s('Urgent + Important', R), s('Not Urgent + Important', G), s('Urgent + Not Important', B), s('Not Urgent + Not Important', GN)]));
T.stakeholder = fr('Stakeholder Map', gr([s('High Power / High Interest', R), s('High Power / Low Interest', G), s('Low Power / High Interest', B), s('Low Power / Low Interest', GN)]));
T['impact-effort'] = fr('Impact / Effort Matrix', gr([s('High Impact / Low Effort', GN), s('High Impact / High Effort', G), s('Low Impact / Low Effort', B), s('Low Impact / High Effort', R)]));
T['risk-matrix'] = fr('Risk Assessment Matrix', gr([s('High Likelihood / High Impact', R), s('High Likelihood / Low Impact', G), s('Low Likelihood / High Impact', B), s('Low Likelihood / Low Impact', GN)]));
T['feedback-grid'] = fr('Feedback Grid', gr([s('Liked', GN), s('Criticism', R), s('Questions', B), s('Ideas', G)]));
T['marketing-4p'] = fr('Marketing Mix (4P)', gr([s('Product', B), s('Price', G), s('Place', GN), s('Promotion', P)]));
T['balanced-scorecard'] = fr('Balanced Scorecard', gr([s('Financial', G), s('Customer', B), s('Internal Process', GN), s('Learning & Growth', P)]));
T['team-health'] = fr('Team Health Check', gr([s('Going Well', GN), s('Needs Attention', G), s('At Risk', R), s('Blocked', P)]));

// --- Archetype 2: N-Column (17) ---
T.kanban = fr('Kanban Board', rw([ucl('To Do', 2, R), ucl('In Progress', 2, G), ucl('Done', 2, GN)]));
T['kanban-5'] = fr('Kanban Pipeline', rw([ucl('Backlog', 2, P), ucl('To Do', 2, R), ucl('In Progress', 2, G), ucl('Review', 2, B), ucl('Done', 2, GN)]));
T.proscons = fr('Pros and Cons', rw([ucl('Pros', 3, GN), ucl('Cons', 3, R)]));
T.retro = fr('Retrospective', rw([ucl('What Went Well', 2, GN), ucl('What To Improve', 2, R), ucl('Action Items', 2, G)]));
T['retro-4l'] = fr('4Ls Retrospective', rw([ucl('Liked', 2, GN), ucl('Learned', 2, B), ucl('Lacked', 2, R), ucl('Longed For', 2, G)]));
T['start-stop-continue'] = fr('Start / Stop / Continue', rw([ucl('Start', 2, GN), ucl('Stop', 2, R), ucl('Continue', 2, B)]));
T['rose-bud-thorn'] = fr('Rose / Bud / Thorn', rw([ucl('Rose', 2, GN), ucl('Bud', 2, G), ucl('Thorn', 2, R)]));
T['feature-compare'] = fr('Feature Comparison', rw([ucl('Option A', 3, B), ucl('Option B', 3, G)]));
T['competitive-analysis'] = fr('Competitive Analysis', rw([ucl('Your Product', 3, GN), ucl('Competitor A', 3, B), ucl('Competitor B', 3, R)]));
T.standup = fr('Daily Standup', rw([ucl('Yesterday', 2, B), ucl('Today', 2, GN), ucl('Blockers', 2, R)]));
T.kwl = fr('KWL Chart', rw([ucl('Know', 2, B), ucl('Want to Know', 2, G), ucl('Learned', 2, GN)]));
T['cost-benefit'] = fr('Cost-Benefit Analysis', rw([ucl('Costs', 3, R), ucl('Benefits', 3, GN)]));
T['force-field'] = fr('Force Field Analysis', rw([ucl('Driving Forces', 3, GN), ucl('Restraining Forces', 3, R)]));
T.moscow = fr('MoSCoW Prioritization', rw([ucl('Must Have', 2, R), ucl('Should Have', 2, G), ucl('Could Have', 2, B), ucl('Won\'t Have', 2, GN)]));
T.daci = fr('DACI Framework', rw([ucl('Driver', 2, R), ucl('Approver', 2, G), ucl('Contributors', 2, B), ucl('Informed', 2, GN)]));
T['six-hats'] = fr('Six Thinking Hats', rw([ucl('White (Facts)', 2, M), ucl('Red (Feelings)', 2, R), ucl('Black (Caution)', 2, P), ucl('Yellow (Benefits)', 2, G), ucl('Green (Creativity)', 2, GN), ucl('Blue (Process)', 2, B)]));
T['weekly-checkin'] = fr('Weekly Check-in', rw([ucl('Wins', 2, GN), ucl('Challenges', 2, R), ucl('Priorities', 2, B), ucl('Needs', 2, G)]));

// --- Archetype 3: Horizontal Row (6) ---
T.timeline = fr('Timeline', rw([s('Phase 1', B), s('Phase 2', G), s('Phase 3', GN), s('Phase 4', R), s('Phase 5', P)], 20));
T['process-flow'] = fr('Process Flow', rw([s('Step 1', B), s('Step 2', G), s('Step 3', GN), s('Step 4', R), s('Step 5', P)], 20));
T['sales-funnel'] = fr('Sales Funnel', rw([s('Awareness', B), s('Interest', G), s('Decision', GN), s('Action', R), s('Retention', P)], 20));
T['design-thinking'] = fr('Design Thinking', rw([s('Empathize', B), s('Define', R), s('Ideate', G), s('Prototype', GN), s('Test', P)], 20));
T.pdca = fr('PDCA Cycle', rw([s('Plan', B), s('Do', GN), s('Check', G), s('Act', R)], 20));
T['customer-lifecycle'] = fr('Customer Lifecycle', rw([s('Acquisition', B), s('Activation', G), s('Retention', GN), s('Revenue', R), s('Advocacy', P)], 20));

// --- Archetype 4: Row of Stacks with Sub-Items (4) ---
T['user-journey'] = fr('User Journey', rw([
  cl('Awareness', [s('Touchpoint', B), s('Feeling', G)]),
  cl('Consideration', [s('Touchpoint', B), s('Feeling', G)]),
  cl('Decision', [s('Touchpoint', B), s('Feeling', G)]),
  cl('Retention', [s('Touchpoint', B), s('Feeling', G)]),
], 20));
T['service-blueprint'] = fr('Service Blueprint', rw([
  cl('Stage 1', [s('User Action', B), s('Frontstage', G), s('Backstage', R)]),
  cl('Stage 2', [s('User Action', B), s('Frontstage', G), s('Backstage', R)]),
  cl('Stage 3', [s('User Action', B), s('Frontstage', G), s('Backstage', R)]),
  cl('Stage 4', [s('User Action', B), s('Frontstage', G), s('Backstage', R)]),
], 20));
T['story-map'] = fr('User Story Map', rw([
  cl('Epic 1', [s('Story 1', B), s('Story 2', B)]),
  cl('Epic 2', [s('Story 1', G), s('Story 2', G)]),
  cl('Epic 3', [s('Story 1', GN), s('Story 2', GN)]),
  cl('Epic 4', [s('Story 1', R), s('Story 2', R)]),
], 20));
T['release-plan'] = fr('Release Plan', rw([
  cl('Release 1', [s('Feature 1', B), s('Feature 2', B), s('Feature 3', B)]),
  cl('Release 2', [s('Feature 1', G), s('Feature 2', G), s('Feature 3', G)]),
  cl('Release 3', [s('Feature 1', GN), s('Feature 2', GN), s('Feature 3', GN)]),
], 20));

// --- Archetype 5: Grid NxM (4) ---
T.brainstorm = fr('Brainstorm', gr([s('Idea 1', G), s('Idea 2', B), s('Idea 3', GN), s('Idea 4', R), s('Idea 5', P), s('Idea 6', M)], 3, 20));
T['brainstorm-large'] = fr('Large Brainstorm', gr([s('Idea 1', G), s('Idea 2', B), s('Idea 3', GN), s('Idea 4', R), s('Idea 5', P), s('Idea 6', M), s('Idea 7', G), s('Idea 8', B), s('Idea 9', GN), s('Idea 10', R), s('Idea 11', P), s('Idea 12', M)], 4, 20));
T['lotus-blossom'] = fr('Lotus Blossom', gr([s('Center Theme', R), s('Expansion 1', G), s('Expansion 2', B), s('Expansion 3', GN), s('Expansion 4', P), s('Expansion 5', M), s('Expansion 6', G), s('Expansion 7', B), s('Expansion 8', GN)], 3, 20));
T['idea-matrix'] = fr('Idea Matrix', gr([s('Idea 1', G), s('Idea 2', B), s('Idea 3', GN), s('Idea 4', R), s('Idea 5', P), s('Idea 6', M), s('Idea 7', G), s('Idea 8', B), s('Idea 9', GN)], 3, 20));

// --- Archetype 6: Vertical Stack (7) ---
T['five-whys'] = fr('5 Whys', sk([s('Why 1?', R), s('Why 2?', R), s('Why 3?', G), s('Why 4?', G), s('Why 5?', GN)]));
T.scamper = fr('SCAMPER', sk([s('Substitute', B), s('Combine', G), s('Adapt', GN), s('Modify', R), s('Put to Other Use', P), s('Eliminate', M), s('Reverse', B)]));
T['smart-goals'] = fr('SMART Goals', sk([s('Specific', B), s('Measurable', GN), s('Achievable', G), s('Relevant', R), s('Time-bound', P)]));
T['meeting-agenda'] = fr('Meeting Agenda', sk([s('Item 1', B), s('Item 2', B), s('Item 3', B), s('Item 4', B), s('Item 5', B)]));
T['action-items'] = fr('Action Items', sk([s('Action 1', G), s('Action 2', G), s('Action 3', G), s('Action 4', G)]));
T.okr = fr('OKR Framework', sk([s('Objective', R), s('Key Result 1', B), s('Key Result 2', B), s('Key Result 3', B)]));
T['decision-log'] = fr('Decision Log', sk([s('Decision 1', G), s('Decision 2', G), s('Decision 3', G)]));

// --- Archetype 7: Complex (12) ---
T.sipoc = fr('SIPOC Diagram', rw([ucl('Supplier', 2, B), ucl('Input', 2, G), ucl('Process', 2, GN), ucl('Output', 2, R), ucl('Customer', 2, P)]));
T['wardley-map'] = fr('Wardley Map', rw([ucl('Genesis', 2, B), ucl('Custom Built', 2, G), ucl('Product', 2, GN), ucl('Commodity', 2, R)]));
T['sprint-retro-detailed'] = fr('Sprint Retro', rw([ucl('Went Well', 3, GN), ucl('Improve', 3, R), ucl('Questions', 3, B), ucl('Action Items', 3, G)]));
T['customer-journey-detailed'] = fr('Detailed Customer Journey', rw([
  cl('Awareness', [s('Action', B), s('Thinking', G), s('Feeling', R), s('Touchpoint', GN)]),
  cl('Research', [s('Action', B), s('Thinking', G), s('Feeling', R), s('Touchpoint', GN)]),
  cl('Comparison', [s('Action', B), s('Thinking', G), s('Feeling', R), s('Touchpoint', GN)]),
  cl('Purchase', [s('Action', B), s('Thinking', G), s('Feeling', R), s('Touchpoint', GN)]),
  cl('Post-Purchase', [s('Action', B), s('Thinking', G), s('Feeling', R), s('Touchpoint', GN)]),
], 20));
T.bmc = fr('Business Model Canvas', sk([
  rw([
    cl('Key Partners', [s('Item', B)]),
    sk([cl('Key Activities', [s('Item', G)]), cl('Key Resources', [s('Item', GN)])], 5),
    cl('Value Proposition', [s('Item', R)]),
    sk([cl('Customer Relationships', [s('Item', P)]), cl('Channels', [s('Item', M)])], 5),
    cl('Customer Segments', [s('Item', G)]),
  ], 10),
  rw([cl('Cost Structure', [s('Item', R)]), cl('Revenue Streams', [s('Item', GN)])], 10),
], 10));
T['lean-canvas'] = fr('Lean Canvas', sk([
  rw([
    cl('Problem', [s('Item', R)]),
    sk([cl('Solution', [s('Item', GN)]), cl('Key Metrics', [s('Item', B)])], 5),
    cl('Unique Value Prop', [s('Item', G)]),
    sk([cl('Unfair Advantage', [s('Item', P)]), cl('Channels', [s('Item', M)])], 5),
    cl('Customer Segments', [s('Item', B)]),
  ], 10),
  rw([cl('Cost Structure', [s('Item', R)]), cl('Revenue Streams', [s('Item', GN)])], 10),
], 10));
T['value-prop'] = fr('Value Proposition Canvas', rw([
  sk([t('Customer'), s('Customer Jobs', B), s('Pains', R), s('Gains', G)]),
  sk([t('Value Proposition'), s('Products &amp; Services', GN), s('Pain Relievers', M), s('Gain Creators', G)]),
]));
T.persona = fr('User Persona', sk([t('Persona Name', 22), s('Demographics', B), s('Goals', GN), s('Pain Points', R), s('Behaviors', G)]));
T['empathy-map'] = fr('Empathy Map', sk([t('User'), gr([s('Says', B), s('Thinks', G), s('Does', GN), s('Feels', R)])]));
T['project-charter'] = fr('Project Charter', sk([t('Project Name', 22), s('Objective', G), s('Scope', B), s('Stakeholders', GN), s('Timeline', R), s('Budget', P), s('Risks', M), s('Success Criteria', G)]));
T['business-plan-1page'] = fr('One-Page Business Plan', sk([t('Business Name', 22), s('Problem', G), s('Solution', GN), s('Target Market', B), s('Revenue Model', R), s('Key Metrics', P), s('Competitive Advantage', M), s('Next Steps', G)]));
T['team-charter'] = fr('Team Charter', sk([t('Team Name', 22), s('Mission', G), s('Members', B), s('Norms', GN), s('Goals', R), s('Communication', P)]));

// --- Scaffolding (15) ---
T['grid-2x2'] = fr('2x2 Grid', gr([s('', G), s('', G), s('', G), s('', G)]));
T['grid-3x3'] = fr('3x3 Grid', gr([s('', G), s('', G), s('', G), s('', G), s('', G), s('', G), s('', G), s('', G), s('', G)], 3));
T['columns-2'] = fr('Two Columns', rw([ucl('Column 1', 3, B), ucl('Column 2', 3, G)]));
T['columns-3'] = fr('Three Columns', rw([ucl('Column 1', 3, B), ucl('Column 2', 3, G), ucl('Column 3', 3, GN)]));
T['columns-4'] = fr('Four Columns', rw([ucl('Column 1', 2, B), ucl('Column 2', 2, G), ucl('Column 3', 2, GN), ucl('Column 4', 2, R)]));
T['columns-5'] = fr('Five Columns', rw([ucl('Column 1', 2, B), ucl('Column 2', 2, G), ucl('Column 3', 2, GN), ucl('Column 4', 2, R), ucl('Column 5', 2, P)]));
T['hierarchy-3'] = fr('Three-Tier Hierarchy', sk([rw([s('Top', G)], 0), rw([s('Mid 1', B), s('Mid 2', B)]), rw([s('Base 1', GN), s('Base 2', GN), s('Base 3', GN), s('Base 4', GN)])]));
T['sequence-4'] = fr('Four-Step Sequence', rw([s('Step 1', B), s('Step 2', G), s('Step 3', GN), s('Step 4', R)], 20));
T['sequence-6'] = fr('Six-Step Sequence', rw([s('Step 1', B), s('Step 2', G), s('Step 3', GN), s('Step 4', R), s('Step 5', P), s('Step 6', M)], 20));
T['hub-spoke'] = fr('Hub and Spoke', gr([s('Spoke', G), s('Spoke', G), s('Spoke', G), s('Spoke', G), s('Hub', R), s('Spoke', G), s('Spoke', G), s('Spoke', G), s('Spoke', G)], 3, 20));
T['comparison-table'] = fr('Comparison Table', gr([s('Header 1', B), s('Header 2', B), s('Header 3', B), s('Item', G), s('Item', G), s('Item', G), s('Item', G), s('Item', G), s('Item', G), s('Item', G), s('Item', G), s('Item', G)], 3));
T['tier-list'] = fr('Tier List', sk([rw([t('S Tier', 16), s('Item', R), s('Item', R)]), rw([t('A Tier', 16), s('Item', G), s('Item', G)]), rw([t('B Tier', 16), s('Item', B), s('Item', B)]), rw([t('C Tier', 16), s('Item', GN), s('Item', GN)])]));
T['before-after'] = fr('Before / After', rw([ucl('Before', 3, R), ucl('After', 3, GN)]));
T['input-output'] = fr('Input / Process / Output', rw([ucl('Input', 2, B), ucl('Process', 2, G), ucl('Output', 2, GN)]));
T['nested-grid'] = fr('Nested Categories', rw([
  sk([cl('Category A', [s('Sub 1', B), s('Sub 2', B)])]),
  sk([cl('Category B', [s('Sub 1', G), s('Sub 2', G)])]),
  sk([cl('Category C', [s('Sub 1', GN), s('Sub 2', GN)])]),
]));

export const TEMPLATE_CATALOG = `=== Strategic ===
swot: SWOT Analysis (Strengths; Weaknesses; Opportunities; Threats)
pest: PEST Analysis (Political; Economic; Social; Technological)
bcg-matrix: BCG Matrix (Stars; Cash Cows; Question Marks; Dogs)
ansoff: Ansoff Matrix (Market Penetration; Product Dev; Market Dev; Diversification)
balanced-scorecard: Balanced Scorecard (Financial; Customer; Internal Process; Learning)
=== Prioritization ===
priority-matrix: Priority/Eisenhower Matrix (4 urgency×importance quadrants)
impact-effort: Impact/Effort Matrix (4 quadrants)
risk-matrix: Risk Assessment (4 likelihood×impact quadrants)
moscow: MoSCoW (Must Have; Should Have; Could Have; Won't Have)
cost-benefit: Cost-Benefit (Costs; Benefits, 3 items each)
decision-log: Decision Log (3 entries)
=== Stakeholder & Team ===
stakeholder: Stakeholder Map (4 power×interest quadrants)
team-health: Team Health (Going Well; Needs Attention; At Risk; Blocked)
team-charter: Team Charter (Mission; Members; Norms; Goals; Communication)
daci: DACI Framework (Driver; Approver; Contributors; Informed)
=== Planning ===
kanban: Kanban Board (3 cols: To Do, In Progress, Done)
kanban-5: Kanban Pipeline (5 cols: Backlog→Done)
timeline: Timeline (5 phases)
process-flow: Process Flow (5 steps)
pdca: PDCA Cycle (Plan; Do; Check; Act)
meeting-agenda: Meeting Agenda (5 items)
action-items: Action Items (4 items)
release-plan: Release Plan (3 releases × 3 features)
sprint-retro-detailed: Sprint Retro (4 cols × 3 items)
project-charter: Project Charter (Objective; Scope; Stakeholders; Timeline; Budget; Risks)
=== Retrospective ===
retro: Retrospective (Went Well; Improve; Actions)
retro-4l: 4Ls Retro (Liked; Learned; Lacked; Longed For)
start-stop-continue: Start/Stop/Continue (3 cols)
rose-bud-thorn: Rose/Bud/Thorn (3 cols)
weekly-checkin: Weekly Check-in (Wins; Challenges; Priorities; Needs)
feedback-grid: Feedback Grid (Liked; Criticism; Questions; Ideas)
=== Ideation ===
brainstorm: Brainstorm (6 ideas, 3×2 grid)
brainstorm-large: Large Brainstorm (12 ideas, 4×3)
lotus-blossom: Lotus Blossom (center + 8 expansions)
idea-matrix: Idea Matrix (9 ideas, 3×3)
scamper: SCAMPER (7 prompts: Substitute, Combine, Adapt, Modify, Put to use, Eliminate, Reverse)
six-hats: Six Thinking Hats (6 cols: Facts, Feelings, Caution, Benefits, Creativity, Process)
design-thinking: Design Thinking (Empathize; Define; Ideate; Prototype; Test)
five-whys: 5 Whys (5 sequential questions)
=== Comparison ===
proscons: Pros and Cons (2 cols × 3 items)
feature-compare: Feature Comparison (Option A; Option B)
competitive-analysis: Competitive Analysis (Your Product; Competitor A; Competitor B)
force-field: Force Field (Driving; Restraining forces)
marketing-4p: Marketing Mix (Product; Price; Place; Promotion)
=== Business ===
bmc: Business Model Canvas (9 sections: Partners, Activities, Resources, Value Prop, Relationships, Channels, Segments; Costs, Revenue)
lean-canvas: Lean Canvas (9 sections: Problem, Solution, Metrics, Value Prop, Advantage, Channels, Segments; Costs, Revenue)
value-prop: Value Proposition Canvas (Customer: Jobs/Pains/Gains; Value: Products/Relievers/Creators)
business-plan-1page: One-Page Business Plan (Problem; Solution; Market; Revenue; Metrics; Advantage)
okr: OKR Framework (1 objective + 3 key results)
smart-goals: SMART Goals (Specific; Measurable; Achievable; Relevant; Time-bound)
=== User & Customer ===
persona: User Persona (Demographics; Goals; Pain Points; Behaviors)
user-journey: User Journey (4 stages × Touchpoint + Feeling)
customer-journey-detailed: Detailed Journey (5 stages × Action/Thinking/Feeling/Touchpoint)
customer-lifecycle: Customer Lifecycle (Acquisition; Activation; Retention; Revenue; Advocacy)
empathy-map: Empathy Map (Says; Thinks; Does; Feels)
service-blueprint: Service Blueprint (4 stages × User Action/Frontstage/Backstage)
story-map: User Story Map (4 epics × 2 stories)
sales-funnel: Sales Funnel (Awareness; Interest; Decision; Action; Retention)
=== Agile ===
standup: Daily Standup (Yesterday; Today; Blockers)
kwl: KWL Chart (Know; Want to Know; Learned)
sipoc: SIPOC (Supplier; Input; Process; Output; Customer)
wardley-map: Wardley Map (Genesis; Custom; Product; Commodity)
=== Scaffolding ===
grid-2x2: Blank 2×2 Grid (4 slots)
grid-3x3: Blank 3×3 Grid (9 slots)
columns-2: Two-Column Layout (2 cols × 3)
columns-3: Three-Column Layout (3 cols × 3)
columns-4: Four-Column Layout (4 cols × 2)
columns-5: Five-Column Layout (5 cols × 2)
hierarchy-3: Three-Tier Hierarchy (1-2-4)
sequence-4: Four-Step Sequence
sequence-6: Six-Step Sequence
hub-spoke: Hub and Spoke (center + 8)
comparison-table: Comparison Table (3×4 grid)
tier-list: Tier List (S/A/B/C × 2 items)
before-after: Before/After (2 cols × 3)
input-output: Input/Process/Output (3 cols × 2)
nested-grid: Nested Categories (3 cats × 2 subs)`;
