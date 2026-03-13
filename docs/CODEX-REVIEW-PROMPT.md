# Codex Full Review Prompt — EMBRYO

Paste this into a Codex task. It will review the entire codebase.

---

## Prompt

You are reviewing EMBRYO, a React 19 + Vite 7 music history visualization app that renders 31,069 musicians on a MapLibre GL map with a Canvas 2D overlay. The app is deployed to Cloudflare Pages at embryo.wiki.

**Stack**: React 19, Vite 7, MapLibre GL JS via react-map-gl/maplibre, Supercluster for geographic clustering, Canvas 2D for all visualization (nodes, labels, arcs, clusters), Fuse.js for search. No TypeScript. No Tailwind (imported but unused). Inline styles throughout.

**Your job**: Review ABSOLUTELY EVERYTHING. Read every file. Report every issue you find. Organize findings by severity (Critical > Major > Minor > Nitpick). For each finding, include:

1. **File and line number(s)**
2. **What's wrong** (specific, not vague)
3. **Why it matters** (user impact, performance, security, accessibility)
4. **Suggested fix** (concrete code change, not just "fix it")

### Categories to audit:

**BUGS & LOGIC ERRORS**
- State management: race conditions, stale closures, missing dependencies in useEffect/useCallback/useMemo
- Data integrity: name collisions in Maps, off-by-one errors, null/undefined access
- Event handling: missing cleanup, memory leaks, zombie listeners
- Render correctness: components not updating when they should, or updating too often

**PERFORMANCE**
- Per-frame work in the canvas render loop (CanvasOverlay.jsx) — anything O(n²) or avoidable allocation
- Unnecessary re-renders in React components
- Bundle size: unused imports, dead code, missing tree-shaking opportunities
- Data loading: the JSON files total ~20MB — are they loaded efficiently?
- Memory: Maps/Sets that grow unbounded, refs that hold stale objects

**ACCESSIBILITY (WCAG 2.2 AA)**
- Calculate actual contrast ratios for every text/background combination using WCAG relative luminance formula. Report exact ratios.
- Check every interactive element for: keyboard reachability, visible focus indicator, aria attributes, touch target size (44px minimum)
- Check every dynamic content change for: aria-live announcements, focus management, screen reader coherence
- Check prefers-reduced-motion coverage: every CSS transition, every canvas animation, every JS-driven animation
- Check focus traps in modals/panels, focus restoration on close

**SECURITY**
- XSS vectors in dynamic content rendering (artist names, city names — do they go through dangerouslySetInnerHTML anywhere?)
- External URL handling (Wikipedia links, image URLs — are they sanitized?)
- Content Security Policy readiness

**CODE QUALITY**
- Dead code, unused variables, unreachable branches
- Inconsistent patterns (same thing done differently in different files)
- Magic numbers without named constants
- Error handling: silent catches, missing error boundaries, unhandled promise rejections
- Component boundaries: are any files doing too much? (CanvasOverlay.jsx is ~1100 lines — is it justified or should it be split?)

**DATA INTEGRITY**
- Read the JSON data files in /public/data/ and check: field consistency, null rates, duplicate detection, referential integrity between artists and connections
- Are artist IDs actually unique? Are connection source_id/target_id all valid artist IDs?
- Genre categorization: does getGenreBucket correctly bucket all genre strings?

**DEPLOYMENT & BUILD**
- Vite config: is it optimized? Are source maps disabled for production?
- Bundle analysis: what's in the 1MB+ chunks? Can they be split?
- SPA routing: does the _redirects file handle all cases?
- Meta tags: are OG/Twitter tags complete?

### Output format

```
## CRITICAL (must fix before launch)
### C1. [title]
- **File**: path:line
- **Issue**: ...
- **Impact**: ...
- **Fix**: ...

## MAJOR (should fix soon)
### M1. [title]
...

## MINOR (nice to fix)
### N1. [title]
...

## NITPICK (optional polish)
### P1. [title]
...

## SUMMARY
- Total findings: X
- Critical: X | Major: X | Minor: X | Nitpick: X
- Files reviewed: [list]
- Estimated fix effort: X hours
```

### Rules
- Read EVERY source file in src/ and every config file in the project root
- Read the data JSON files (at least sample them — they're large)
- Do NOT make code changes. Report only.
- Do NOT skip files because they're long. CanvasOverlay.jsx is 1100+ lines — read all of it.
- Be specific. "The code could be better" is not a finding. "Line 247 creates a new Map() inside useCallback without deps, causing a new allocation every render" is.
- If you're unsure about something, say so. Don't invent issues.
- Cross-reference with the existing audit at docs/AUDIT-REPORT.md — note which issues are already documented vs new.
