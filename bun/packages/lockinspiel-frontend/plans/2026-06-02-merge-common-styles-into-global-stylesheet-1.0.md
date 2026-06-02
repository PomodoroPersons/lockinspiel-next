# Merge Common Styles into Unified `src/styles.css`

## Objective

Consolidate duplicated CSS patterns from 7 component-scoped stylesheets into a single global `src/styles.css` file, using CSS custom properties and shared utility classes. This will reduce ~120+ lines of duplicated styles, establish a single source of truth for the design system, and simplify future theme changes.

## Current State Analysis

### File Inventory

| File | Lines | Scope |
|------|-------|-------|
| `src/styles.css` | 16 | Global (reset, html/body, app-root) |
| `src/app/main-page/main-page.css` | 203 | Layout shell |
| `src/app/friend-list/friend-list.css` | 218 | Friend list & invites |
| `src/app/set-timer/set-timer.css` | 186 | Timer creation (has duplicate `.friends-panel`) |
| `src/app/user-profile/user-profile.css` | 149 | Profile modal |
| `src/app/saved-list/saved-list.css` | 136 | Saved timer list |
| `src/app/login/login.css` | 103 | Login page |
| `src/app/timer/timer.css` | 72 | Active timer display |

All components use Angular's default `ViewEncapsulation.Emulated`, meaning component CSS is scoped via `_ngcontent-*` attributes and does not leak between components. Global `src/styles.css` applies everywhere unscoped.

### Identified Duplications (Priority Order)

1. **Primary gradient** (`linear-gradient(135deg, #a78bfa, #60a5fa)`) — used in 6 files across 12+ selectors
2. **Input field styling** (background, border, border-radius, color, focus state) — 4 files with near-identical rules
3. **Glass card pattern** (semi-transparent background + backdrop-filter + border) — 5 files
4. **Color tokens** (white, rgba(255,255,255,0.5), rgba(255,255,255,0.3), #a78bfa, #60a5fa, error red) — all files
5. **Back button** — identical in `saved-list.css:41-55` and `friend-list.css:42-56`
6. **Empty state** — identical in `saved-list.css:131-136` and `friend-list.css:201-206`
7. **List container** — identical in `saved-list.css:58-63` and `friend-list.css:59-64`
8. **Top bar** — nearly identical in `saved-list.css:10-16` and `friend-list.css:10-16`
9. **Section title/label** — 4 files with same font-size, text-transform, letter-spacing, color
10. **Play button** — 2 files with same gradient + circular shape (different sizes)
11. **Duplicate reset** — `main-page.css:1-5` duplicates `styles.css:2-6`
12. **Self-duplication bug** — `set-timer.css` defines `.friends-panel` twice (lines 11-23 and 125-138)

## Implementation Plan

### Phase 1: CSS Custom Properties (Design Tokens)

- [x] **Task 1.1**: Add CSS custom properties to `src/styles.css` for all recurring design tokens. Define a `:root` block with variables for:
  - Colors: `--color-white`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-accent-purple` (#a78bfa), `--color-accent-blue` (#60a5fa), `--color-error` (rgb(239,68,68))
  - Gradients: `--gradient-primary` (135deg, #a78bfa, #60a5fa), `--gradient-page-bg` (the page background gradient)
  - Glass effect: `--glass-bg-subtle` (rgba(255,255,255,0.05)), `--glass-bg-medium` (rgba(255,255,255,0.07)), `--glass-bg-strong` (rgba(255,255,255,0.15)), `--glass-border` (rgba(255,255,255,0.12)), `--glass-blur` (blur(10px))
  - Spacing/radius: `--radius-sm` (0.5rem), `--radius-md` (0.75rem), `--radius-lg` (1.5rem), `--radius-full` (50%)
  - Transitions: `--transition-fast` (0.2s ease)
  - Focus border: `--input-focus-border` (rgba(167,139,250,0.6))

  Rationale: Establishes a single source of truth for the design system. Changing any color or spacing value will propagate globally from one location.

### Phase 2: Shared Utility Classes in Global Stylesheet

- [x] **Task 2.1**: Add shared utility classes to `src/styles.css` for patterns that appear identically in 2+ components. These will be global, unscoped classes available to all components:

  - `.glass-card` — glass background + backdrop-filter + border + border-radius (covers `.center-box`, `.sidebar-panel`, `.login-box`, `.modal`, `.friends-panel` base styles)
  - `.input-field` — the shared input styling (background, border, border-radius, color, outline, transition, focus state, placeholder color) — covers `.input-group input`, `.time-input-group input`, `.username-input`, `.edit-input`
  - `.section-label` — uppercase label style (font-size, text-transform, letter-spacing, color) — covers `.input-group label`, `.time-input-group label`, `.list-title`, `.view-title`, `.friends-title`
  - `.btn-back` — back button styles — covers `.back-btn` in saved-list and friend-list
  - `.btn-primary` — primary gradient button — covers `.login-btn`, `.enter-btn`, `.apply-btn`
  - `.btn-ghost` — transparent ghost button — covers `.settings-btn`, `.delete-mode-btn`
  - `.list-container` — flex column list — covers `.list` in saved-list and friend-list
  - `.empty-state` — empty state text — covers `.empty` in saved-list and friend-list
  - `.avatar-circle` — circular avatar with gradient — covers `.avatar`, `.avatar-large`, `.profile-btn`
  - `.play-button` — circular gradient play button (base styles, size via CSS variable or inline) — covers `.play-btn` in set-timer and saved-list
  - `.top-bar` — shared top bar — covers `.top-bar` in saved-list and friend-list

  Rationale: These patterns are repeated verbatim across components. Moving them to global CSS eliminates duplication while keeping component files focused on component-specific layout.

- [x] **Task 2.2**: Keep component-scoped CSS files in place but strip them of the duplicated rules, replacing with the global utility classes. Each component CSS file retains only its unique, component-specific styles. The component HTML templates will need corresponding class additions (e.g., adding `input-field` alongside or instead of existing input selectors).

  Rationale: Angular's `ViewEncapsulation.Emulated` means global classes will still apply within component templates. Component files keep their unique layout rules while delegating shared patterns to the global stylesheet.

### Phase 3: Component-Specific Cleanup

- [x] **Task 3.1**: Update `src/app/main-page/main-page.css`:
  - Remove the duplicate `* { margin: 0; padding: 0; box-sizing: border-box; }` reset at lines 1-5 (already in `styles.css`)
  - Replace hardcoded color values with `var()` references to custom properties
  - Replace `.center-box` and `.sidebar-panel` glass patterns with `.glass-card` class usage
  - Replace gradient in `.logo` and `.profile-btn` with `var(--gradient-primary)`

- [x] **Task 3.2**: Update `src/app/login/login.css`:
  - Replace `.login-box` glass pattern with `.glass-card` class
  - Replace `.input-group label` with `.section-label` class
  - Replace `.input-group input` with `.input-field` class
  - Replace gradient in `.login-logo` and `.login-btn` with `var(--gradient-primary)`
  - Replace hardcoded colors with `var()` references

- [x] **Task 3.3**: Update `src/app/set-timer/set-timer.css`:
  - **Fix the duplicate `.friends-panel` bug** — the file defines `.friends-panel` twice (lines 11-23 with `position: sticky; left: 123.5%` and lines 125-138 with `position: absolute; right: 0`). Determine which positioning is correct based on the component's actual layout behavior, and remove the dead definition. The second definition (absolute positioning) appears to be the intended one based on the comment "NEEDS WORK" on line 10.
  - Replace `.time-input-group label` with `.section-label` class
  - Replace `.time-input-group input` with `.input-field` class
  - Replace gradient in `.play-btn` with `var(--gradient-primary)`
  - Replace `.friends-panel` glass pattern with `.glass-card` class
  - Replace hardcoded colors with `var()` references

- [x] **Task 3.4**: Update `src/app/friend-list/friend-list.css`:
  - Replace `.back-btn` with `.btn-back` class
  - Replace `.list` with `.list-container` class
  - Replace `.empty` with `.empty-state` class
  - Replace `.top-bar` with global `.top-bar` class
  - Replace `.view-title` with `.section-label` class
  - Replace `.username-input` with `.input-field` class
  - Replace gradient in `.avatar` and `.enter-btn` with `var(--gradient-primary)`
  - Replace hardcoded colors with `var()` references

- [x] **Task 3.5**: Update `src/app/saved-list/saved-list.css`:
  - Replace `.back-btn` with `.btn-back` class
  - Replace `.list` with `.list-container` class
  - Replace `.empty` with `.empty-state` class
  - Replace `.top-bar` with global `.top-bar` class
  - Replace `.list-title` with `.section-label` class
  - Replace gradient in `.play-btn` with `var(--gradient-primary)`
  - Replace hardcoded colors with `var()` references

- [x] **Task 3.6**: Update `src/app/user-profile/user-profile.css`:
  - Replace `.edit-input` with `.input-field` class
  - Replace gradient in `.avatar-large` and `.apply-btn` with `var(--gradient-primary)`
  - Replace hardcoded colors with `var()` references

- [x] **Task 3.7**: Update `src/app/timer/timer.css`:
  - Replace gradient in `.ctrl-btn.active` with `var(--gradient-primary)`
  - Replace hardcoded colors with `var()` references

### Phase 4: HTML Template Updates

- [x] **Task 4.1**: Update all component HTML templates to use the new global utility class names alongside existing component-specific classes. For each component:
  - Add global utility classes (e.g., `glass-card`, `input-field`, `section-label`, `btn-back`, `list-container`, `empty-state`, `btn-primary`) to the appropriate HTML elements
  - Keep any component-specific classes that still have unique CSS rules
  - Ensure no visual regression by verifying that global class specificity is sufficient (global classes have no Angular scoping attribute, so they will match elements without `_ngcontent-*` restrictions)

  Templates to update:
  - `src/app/main-page/main-page.html` — add `glass-card` to center-box, sidebar-panel, modal elements
  - `src/app/login/login.html` — add `glass-card`, `section-label`, `input-field`, `btn-primary`
  - `src/app/set-timer/set-timer.html` — add `section-label`, `input-field`, `glass-card`
  - `src/app/friend-list/friend-list.html` — add `btn-back`, `list-container`, `empty-state`, `section-label`, `input-field`, `btn-primary`
  - `src/app/saved-list/saved-list.html` — add `btn-back`, `list-container`, `empty-state`, `section-label`
  - `src/app/user-profile/user-profile.html` — add `input-field`, `btn-primary`

  Rationale: Global utility classes must be referenced in templates to take effect. Since Angular's emulated encapsulation adds `_ngcontent-*` attributes to component elements, global styles (which lack these attributes) will still match because CSS selectors in `styles.css` apply universally.

### Phase 5: Housekeeping

- [x] **Task 5.1**: Create the missing `src/app/app.css` file (referenced by `src/app/app.ts:8` as `styleUrl: './app.css'` but does not exist on disk). Create it as an empty file or remove the `styleUrl` reference from `app.ts` to prevent potential build warnings.

- [x] **Task 5.2**: Verify that the `angular.json` `styles` array at line 28-30 still correctly references `src/styles.css` as the sole global stylesheet (no changes needed, just confirmation).

## Verification Criteria

- [x] All component CSS files use `var()` for design tokens instead of hardcoded color/spacing values
- [x] No duplicated CSS rules remain across component files (back-btn, empty-state, list-container, input styling, etc.)
- [x] The duplicate `* { margin: 0; ... }` reset in `main-page.css` is removed
- [x] The duplicate `.friends-panel` definitions in `set-timer.css` are resolved (only one definition remains)
- [x] `src/styles.css` contains the `:root` custom properties block and all shared utility classes
- [x] All component HTML templates reference the new global utility classes
- [x] The application builds without errors (`bun run build` or equivalent)
- [x] No visual regressions — all components render identically to before the refactor
- [x] Angular component style budgets (`anyComponentStyle: 4kB warning / 8kB error` in `angular.json:49-51`) are not exceeded (should actually improve since styles move to global)

## Potential Risks and Mitigations

1. **Specificity conflicts between global and component-scoped styles**
   Angular's emulated encapsulation adds attribute selectors (e.g., `[_ngcontent-xyz]`) to component styles, increasing their specificity. Global utility classes lack these attributes and have lower specificity.
   Mitigation: Test each component after migration. If a component-scoped rule overrides a global utility class, either (a) keep that specific rule in the component CSS, or (b) use `!important` on the global utility (last resort). In most cases, both selectors will apply to the same elements without conflict since they target different properties.

2. **Global class name collisions with third-party libraries**
   Generic class names like `.top-bar` or `.list` could conflict with third-party CSS if any is added later.
   Mitigation: Use a consistent prefix for global utility classes (e.g., `.ls-glass-card`, `.ls-input-field`, `.ls-btn-primary`) to namespace them. This is optional but recommended for long-term maintainability.

3. **The duplicate `.friends-panel` in `set-timer.css` may indicate an in-progress feature**
   The comment `/* ----- NEEDS WORK ----- */` at `set-timer.css:10` suggests the first definition (sticky positioning) may be a WIP replacement for the second (absolute positioning).
   Mitigation: Before removing either definition, verify which positioning strategy the component actually uses at runtime. Check the component's TypeScript logic for how `.friends-panel` is toggled (likely via an `.open` class).

4. **Template changes may break Angular change detection or bindings**
   Adding CSS classes to template elements is a non-breaking change, but care must be taken not to accidentally modify structural directives, event bindings, or `@for`/`@if` blocks.
   Mitigation: Only add class attributes; do not modify any other template attributes or bindings.

5. **Missing `app.css` file may cause build warnings**
   `src/app/app.ts:8` references `styleUrl: './app.css'` but the file does not exist.
   Mitigation: Create an empty `src/app/app.css` file as part of this plan.

## Alternative Approaches

1. **CSS-only approach (no template changes)**: Instead of adding global utility classes to templates, use CSS `@import` or `@use` within each component's CSS file to reference shared variables. This avoids template changes but still requires component CSS files to define their own selectors (just using `var()` instead of hardcoded values). Less reduction in total lines but simpler migration.
   Trade-off: Lower risk, less code reduction, still have duplicated selector structures.

2. **Angular `styleUrls` array approach**: Keep shared styles in a separate file (e.g., `src/shared-styles.css`) and add it to each component's `styleUrls` array. This preserves Angular encapsulation while sharing styles.
   Trade-off: Styles are duplicated in the output per component (defeating the budget goal), but encapsulation is maintained natively.

3. **CSS `@layer` approach**: Use CSS `@layer` to organize global utility classes separately from component styles, controlling cascade order explicitly.
   Trade-off: Modern CSS feature with good browser support, but adds conceptual complexity. Best for larger projects with many style sources.

4. **Tailwind CSS migration**: Replace all custom CSS with Tailwind utility classes.
   Trade-off: Major architectural change, high effort, but would eliminate all CSS duplication by design. Overkill for this project size.
