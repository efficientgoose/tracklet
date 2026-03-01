# UI Revamp: Match Figma Design Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the production app visually match the Figma design exactly, with two modifications: (1) "Connect Jira" paths redirect to browser OAuth, (2) Settings modal has no Jira tab.

**Architecture:** Single-file App.tsx + styles.css architecture is preserved. Add `motion/react`, `recharts`, and `date-fns` as dependencies. All Tauri backend integration (`api.ts`, `state.ts`) stays unchanged. New visual features (session type pill, accent colors, charts, animations) are layered on top of existing state management.

**Tech Stack:** React 19 + TypeScript, esbuild bundler, `motion/react` (Framer Motion v12), `recharts`, `date-fns`, `lucide-react`, Tauri v2

---

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install motion, recharts, date-fns**

Run: `cd "/Users/macbook/Desktop/Personal Projects/Tracklet" && npm install motion recharts date-fns`

**Step 2: Verify build still works**

Run: `npm run build:ui`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add motion, recharts, date-fns for UI revamp"
```

---

### Task 2: Update styles.css — global and layout changes

**Files:**
- Modify: `src/ui/styles.css`

Changes to make (all in styles.css):

1. **Body background** (line 33): Change `radial-gradient(...)` → `#f2f2f7`
2. **Widget shell** (line 44-51): Add `box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.10);`
3. **Content shell** (line 188-191): Change `min-height: 400px` → `min-height: 360px`
4. **Timer panel gap** (line 193-197): Change `gap: 12px` → `gap: 20px` (Figma uses `gap-5` = 20px)
5. **Button sizes** — `.reset-btn, .start-btn` (line 299-307): Change `height: 38px` → `height: 36px`
6. **Reset button** (line 309-313): Change `width: 38px` → `width: 36px`
7. **Start button shadow** (line 315-321): Change `box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25)` → removed (will be inline with dynamic accent color)
8. **Stat card** (line 507-513): Change `border-radius: 12px` → `border-radius: 14px`
9. **Stat label** (line 515-521): Change `font-size: 11px` → `font-size: 10px`
10. **Stat value** (line 523-529): Change `font-size: 18px; font-weight: 600; color: var(--text)` → `font-size: 22px; font-weight: 700; color: var(--brand); letter-spacing: -0.02em`
11. **Add `@keyframes pulse`**: `opacity 1→0.4→1, 1.5s infinite`
12. **Add `@keyframes spin`**: `rotate 0→360deg, 1s linear infinite`
13. **Remove** `.duration-wrap`, `.duration-adjust`, `.duration-box`, `.duration-colon` (no longer on timer page)
14. **Remove** `.sync-message` and `.sync-message.warning` (not in design)
15. **Add** `.session-pill` styles: session type label above ring
16. **Add** `.ticket-trigger.is-open` styles: blue border + light bg when dropdown open
17. **Add** `.ticket-footer` styles: footer bar in ticket dropdown
18. **Update** `.chevron` to use SVG icon rotation
19. **Add** `.ticket-clear-btn` styles: clear button in ticket trigger

**Step 1: Make all CSS changes**

Replace body background:
```css
body {
  background: #f2f2f7;
}
```

Add to widget-shell:
```css
.widget-shell {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.10);
}
```

Add keyframes at the bottom:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

Remove all duration-related and sync-message CSS classes.

**Step 2: Verify build**

Run: `npm run build:ui`
Expected: PASS

**Step 3: Commit**

```bash
git add src/ui/styles.css
git commit -m "style: update CSS to match Figma design tokens"
```

---

### Task 3: Update App.tsx — imports and new state

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: Add imports**

At the top of App.tsx, add:
```typescript
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, ChevronDown, Search, X, Trash2, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, startOfDay, subDays, isWithinInterval } from 'date-fns';
```

**Step 2: Add timerType state**

Add to state declarations:
```typescript
const [timerType, setTimerType] = useState<'focus' | 'break'>('focus');
```

Add accent color computation:
```typescript
const accentColor = timerType === 'focus' ? '#007AFF' : '#34c759';
```

**Step 3: Update auto-stop effect to switch timer type**

In the effect that handles `remainingSeconds === 0` (around line 339-358), after stopping the timer, switch type:
```typescript
const nextType = timerType === 'focus' ? 'break' : 'focus';
setTimerType(nextType);
const nextDuration = nextType === 'focus' ? focusDurationMinutes : breakDurationMinutes;
setDurationMinutes(formatMinutesValue(nextDuration));
setDurationSeconds('00');
```

**Step 4: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: add motion/recharts imports and timerType state"
```

---

### Task 4: Update App.tsx — Timer panel UI

**Files:**
- Modify: `src/ui/App.tsx`

Replace the entire timer panel section (lines 650-810 approximately) with the Figma design's layout:

**Step 1: Add session type pill above ring**

```jsx
<AnimatePresence mode="wait">
  <motion.div
    key={timerType}
    className="session-pill"
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    transition={{ duration: 0.2 }}
    style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: accentColor,
      background: `${accentColor}12`, borderRadius: 20, padding: '4px 12px',
    }}
  >
    {timerType === 'focus' ? 'Focus Session' : 'Break Time'}
  </motion.div>
</AnimatePresence>
```

**Step 2: Update ring progress to use motion.circle and accent color**

Replace static `<circle>` progress with:
```jsx
<motion.circle
  cx="90" cy="90" r={RING_RADIUS}
  className="ring-progress"
  stroke={accentColor}
  strokeDasharray={RING_CIRCUMFERENCE}
  animate={{ strokeDashoffset: strokeOffset }}
  transition={{ duration: 0.5, ease: 'easeOut' }}
/>
```

Update ring subtitle to show duration based on timerType:
```jsx
<span className="ring-subtitle">
  {active ? 'Active session' : `${normalizedMinutes} min ${timerType}`}
</span>
```

**Step 3: Remove duration-wrap (MM:SS inputs)**

Delete the entire `<div className="duration-wrap">` block (lines 669-713).

**Step 4: Replace timer action buttons with icons**

Reset button — replace `↺` with:
```jsx
<button className="reset-btn" type="button" onClick={handleResetDuration}
  disabled={Boolean(active)} title="Reset">
  <RotateCcw size={14} />
</button>
```

Start/Stop button — replace text with icon + text, use accent color:
```jsx
<button
  className="start-btn" type="button"
  onClick={handlePrimaryTimerAction}
  disabled={!active && !canStart}
  style={{
    background: accentColor,
    boxShadow: `0 2px 8px ${accentColor}40`,
    display: 'flex', alignItems: 'center', gap: 7,
  }}
>
  {active
    ? <Pause size={13} fill="white" strokeWidth={0} />
    : <Play size={13} fill="white" strokeWidth={0} />}
  {active ? 'Pause' : 'Start'}
</button>
```

**Step 5: Remove sync-message paragraph**

Delete: `<p className="sync-message ...">...</p>`

**Step 6: Update tracking card with AnimatePresence and accent color**

Wrap tracking card in `<AnimatePresence>` with `<motion.div>` for height animation:
```jsx
<AnimatePresence>
  {active && selectedIssue ? (
    <motion.div
      initial={{ opacity: 0, y: 4, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: 4, height: 0 }}
      style={{ width: '100%' }}
    >
      <div className="tracking-card" style={{
        background: `${accentColor}0d`,
        border: `1px solid ${accentColor}22`,
      }}>
        <span className="tracking-dot" style={{
          background: accentColor,
          animation: isCountdownRunning ? 'pulse 1.5s infinite' : 'none',
        }} />
        <div>
          <p className="tracking-title" style={{ color: accentColor }}>Tracking</p>
          <p className="tracking-text">{selectedIssue.issueKey} · {selectedIssue.summary}</p>
        </div>
      </div>
    </motion.div>
  ) : null}
</AnimatePresence>
```

**Step 7: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: update timer panel to match Figma design"
```

---

### Task 5: Update App.tsx — Ticket dropdown

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: Update disconnected state trigger**

"Connect Jira to track tickets" button should call `handleAuthorize` (browser OAuth):
```jsx
<button
  className="ticket-trigger connect-ticket-btn"
  type="button"
  onClick={handleAuthorize}
  disabled={authInProgress}
>
  <span style={{ fontSize: 12, color: '#aeaeb2' }}>
    Connect Jira to track tickets
  </span>
  <ChevronDown size={13} color="#aeaeb2" />
</button>
```

**Step 2: Update trigger with type badge, clear button, chevron rotation**

When connected and ticket selected, show type-colored badge + clear X + rotating chevron:
```jsx
<button className={`ticket-trigger ${isTicketDropdownOpen ? 'is-open' : ''}`} ...>
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, overflow: 'hidden' }}>
    {selectedIssue ? (
      <>
        <span className="ticket-key">{selectedIssue.issueKey}</span>
        <span className="ticket-trigger-text">{selectedIssue.summary}</span>
      </>
    ) : (
      <span style={{ fontSize: 12, color: '#aeaeb2' }}>Select a ticket to track...</span>
    )}
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    {selectedIssue && (
      <span className="ticket-clear-btn" onClick={(e) => { e.stopPropagation(); setSelectedIssueId(''); }}>
        <X size={9} color="#636366" />
      </span>
    )}
    <ChevronDown size={13} color="#8e8e93"
      style={{ transform: isTicketDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    />
  </div>
</button>
```

**Step 3: Wrap dropdown in AnimatePresence**

```jsx
<AnimatePresence>
  {isTicketDropdownOpen ? (
    <motion.div
      className="ticket-dropdown"
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      {/* search + list + footer */}
    </motion.div>
  ) : null}
</AnimatePresence>
```

**Step 4: Replace search icon Unicode with Lucide**

Replace `<span className="search-icon">⌕</span>` with `<Search size={12} color="#aeaeb2" />`

**Step 5: Add ticket row status/priority sub-text**

Each ticket option shows: type badge + summary + status/priority row:
```jsx
<button className={`ticket-option ${selected ? 'is-selected' : ''}`} ...>
  <span className="ticket-key">{issue.issueKey}</span>
  <div style={{ flex: 1, minWidth: 0 }}>
    <p className="ticket-summary">{issue.summary}</p>
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ fontSize: 10, color: '#8e8e93' }}>{issue.statusCategory}</span>
    </div>
  </div>
  {selected && <span style={{ fontSize: 14, color: '#007AFF' }}>✓</span>}
</button>
```

**Step 6: Add footer**

After the ticket-options div, add:
```jsx
<div className="ticket-footer">
  <span>{filteredIssues.length} ticket{filteredIssues.length !== 1 ? 's' : ''}</span>
</div>
```

**Step 7: Commit**

```bash
git add src/ui/App.tsx src/ui/styles.css
git commit -m "feat: update ticket dropdown to match Figma design"
```

---

### Task 6: Update App.tsx — Settings modal

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: Wrap modal in AnimatePresence with spring animation**

Replace conditional render with:
```jsx
<AnimatePresence>
  {isSettingsOpen && (
    <>
      <motion.div className="settings-backdrop-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => setIsSettingsOpen(false)}
      />
      <motion.div className="settings-overlay"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', stiffness: 450, damping: 34 }}
      >
        <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
          {/* content */}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

**Step 2: Remove Jira tab bar**

Remove the entire Timer/Jira tab bar. Settings modal only shows timer settings.

**Step 3: Replace close button Unicode with Lucide X**

```jsx
<button className="settings-close" type="button" onClick={() => setIsSettingsOpen(false)}>
  <X size={12} strokeWidth={2.5} />
</button>
```

**Step 4: Replace number inputs with NumberStepper-style controls**

Replace `<input type="number">` fields with ± button steppers:
```jsx
<label className="settings-card">
  <span>Focus</span>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <button className="stepper-btn" onClick={() => setFocusDurationMinutes(v => Math.max(1, v - 1))}>−</button>
    <div>
      <span className="stepper-value">{focusDurationMinutes}</span>
      <span className="stepper-unit">min</span>
    </div>
    <button className="stepper-btn" onClick={() => setFocusDurationMinutes(v => Math.min(120, v + 1))}>+</button>
  </div>
</label>
```

**Step 5: Replace toggle pill CSS pseudo-element with motion.div**

Replace `<span className="toggle-pill">` (CSS ::after) with:
```jsx
<div className="toggle-track" style={{ background: checked ? '#34c759' : '#e5e5ea' }}>
  <motion.div
    className="toggle-thumb"
    animate={{ x: checked ? 17 : 1 }}
    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
  />
</div>
```

Add CSS for `.toggle-track` and `.toggle-thumb` (replacing `.toggle-pill` + `::after`).

**Step 6: Commit**

```bash
git add src/ui/App.tsx src/ui/styles.css
git commit -m "feat: update settings modal — remove Jira tab, add animations"
```

---

### Task 7: Update App.tsx — Analytics panel

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/state.ts` (add helper for daily chart data)

**Step 1: Add analytics state**

```typescript
const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
```

**Step 2: Compute chart data from snapshot**

Add computation that transforms snapshot sessions into daily bar chart data and focus/break distribution, using `date-fns` for date grouping.

**Step 3: Replace analytics-panel content**

Replace the flat issue list with:
1. **Range picker** (7 Days / 30 Days segmented control) + Trash button
2. **Stat cards** with blue-colored values (22px/700)
3. **Bar chart** using Recharts `<BarChart>` with Focus (blue) + Break (green) bars
4. **Distribution** panel with legend + `<PieChart>` donut
5. **Empty state** when no sessions

**Step 4: Add handleClearSessions function**

```typescript
function handleClearSessions() {
  // Clear completed sessions — may need Tauri command or just local state
  setSnapshot(prev => ({ ...prev, completedSessions: [] }));
}
```

**Step 5: Commit**

```bash
git add src/ui/App.tsx src/ui/state.ts src/ui/styles.css
git commit -m "feat: add Recharts analytics with bar + pie charts"
```

---

### Task 8: Update App.tsx — Tab control animation

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: Replace CSS tab indicator with motion.div**

Replace `<span className="tab-indicator">` with:
```jsx
<motion.span
  className="tab-indicator"
  initial={false}
  animate={{
    transform: activeTab === 'analytics' ? 'translateX(100%)' : 'translateX(0%)',
  }}
  transition={{ type: 'spring', stiffness: 400, damping: 36 }}
  aria-hidden="true"
/>
```

**Step 2: Remove CSS transition from .tab-indicator**

In styles.css, remove: `transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);`
Also remove: `.tab-strip[data-active="analytics"] .tab-indicator { transform: ... }`

**Step 3: Commit**

```bash
git add src/ui/App.tsx src/ui/styles.css
git commit -m "feat: spring-animated tab indicator with motion"
```

---

### Task 9: Final build verification and cleanup

**Step 1: Run full build**

Run: `npm run build:ui`
Expected: PASS with no errors

**Step 2: Run tests**

Run: `npm test`
Expected: All existing tests pass (some UI tests may need adjustment)

**Step 3: Visual verification**

Run: `npm run tauri:dev` or open `src/ui-dist/index.html` in browser

Check:
- [ ] Widget has two-layer shadow on flat #f2f2f7 background
- [ ] Session type pill shows "FOCUS SESSION" with blue accent
- [ ] Ring uses motion.circle with smooth arc animation
- [ ] Play/Pause icons show correctly on start button
- [ ] RotateCcw icon on reset button
- [ ] Start button shadow uses accent color
- [ ] Tracking card animates in/out with pulse dot
- [ ] Ticket dropdown has animated open/close
- [ ] Ticket trigger shows blue border when open
- [ ] Clear (X) button appears on selected ticket
- [ ] Chevron rotates on dropdown open
- [ ] Ticket footer shows count
- [ ] Settings modal has spring entrance animation
- [ ] No Jira tab in settings
- [ ] NumberStepper ± buttons for duration
- [ ] Toggle thumb uses spring animation
- [ ] Tab indicator uses spring animation
- [ ] Analytics shows bar chart + pie chart
- [ ] Range picker (7d/30d) works
- [ ] Stat values are 22px/700/blue
- [ ] "Connect Jira" → opens browser for OAuth
- [ ] "Connect Jira to track tickets" → opens browser for OAuth
- [ ] Empty analytics state shows emoji + message

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete UI revamp to match Figma design"
```
