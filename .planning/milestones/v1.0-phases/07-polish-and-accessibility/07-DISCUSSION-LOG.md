# Phase 7: Polish and Accessibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 07-polish-and-accessibility
**Areas discussed:** Mobile layout strategy, Accessibility depth, Edge case hardening

---

## Mobile Layout Strategy

### Mobile Navigation
| Option | Description | Selected |
|--------|-------------|----------|
| Bottom tab bar | Fixed bottom bar with 3-4 icons, thumb-friendly, standard mobile pattern | ✓ |
| Hamburger menu | Collapse sidebar nav into hamburger icon, hides navigation behind a tap | |
| Keep current top nav | Shrink horizontal nav to fit mobile, minimal code change | |

**User's choice:** Bottom tab bar
**Notes:** None

### Card Grid Reflow
| Option | Description | Selected |
|--------|-------------|----------|
| Single column stack | Full-width on mobile, 2-col tablet, 3-col desktop | ✓ |
| Horizontal scroll cards | Keep cards compact, scroll horizontally per section | |
| Compact list view | Dense list on mobile, one line per plant | |

**User's choice:** Single column stack
**Notes:** None

### Touch Target Sizing
| Option | Description | Selected |
|--------|-------------|----------|
| 44px minimum everywhere | Systematic audit of all interactive elements, enforce 44x44px minimum | ✓ |
| Focus on key actions only | Only water button, snooze pills, and nav items | |

**User's choice:** 44px minimum everywhere
**Notes:** None

### Dialog Behavior on Mobile
| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen sheets on mobile | Bottom-up full-screen sheets for forms on mobile | ✓ |
| Keep centered modals | Same centered dialog on all screens | |

**User's choice:** Full-screen sheets on mobile
**Notes:** None

---

## Accessibility Depth

### Keyboard Navigation Depth
| Option | Description | Selected |
|--------|-------------|----------|
| Full keyboard flow | Tab, Enter/Space, Escape, visible focus rings, skip-to-content link | ✓ |
| Basic tab order only | Logical tab order and focus rings, no skip nav | |
| Keyboard + shortcuts | Full flow plus app-specific shortcuts (W to water, N for new plant) | |

**User's choice:** Full keyboard flow
**Notes:** None

### Live Regions for Screen Readers
| Option | Description | Selected |
|--------|-------------|----------|
| Key actions only | Aria-live for: watering logged, reminder snoozed, plant added/deleted, errors | ✓ |
| Comprehensive live regions | Announce all meaningful state changes including filter results | |
| Toast only | Rely on Sonner toast system (already has aria-live) | |

**User's choice:** Key actions only
**Notes:** None

### Color-Only Status Indicators
| Option | Description | Selected |
|--------|-------------|----------|
| Icons + text labels | Every status gets icon AND text label alongside color | ✓ |
| Icons alongside color | Add distinct icons per status but keep existing text | |
| Patterns/shapes + color | Different shapes or patterns alongside color | |

**User's choice:** Icons + text labels
**Notes:** None

### Reduced Motion
| Option | Description | Selected |
|--------|-------------|----------|
| Respect prefers-reduced-motion | Check OS setting, disable/simplify animations | |
| Skip for v1 | Keep animations as-is, address later | ✓ |

**User's choice:** Skip for v1
**Notes:** None

### Form Accessibility
| Option | Description | Selected |
|--------|-------------|----------|
| Full form audit | Review all forms for labels, errors, required indicators, fieldset/legend | |
| Labels and errors only | Ensure every input has label and aria-describedby errors | |
| Trust shadcn defaults | Only fix gaps found during manual testing | ✓ |

**User's choice:** Trust shadcn defaults
**Notes:** None

### Contrast Audit
| Option | Description | Selected |
|--------|-------------|----------|
| Audit and fix all custom colors | Check every custom color against WCAG AA 4.5:1 ratio | ✓ |
| Spot check key areas | Check most visible custom colors only | |

**User's choice:** Audit and fix all custom colors
**Notes:** None

### Heading Hierarchy
| Option | Description | Selected |
|--------|-------------|----------|
| Standardize headings | Each page gets one h1, sections h2, subsections h3 | ✓ |
| Fix only obvious issues | Only fix skipped heading levels or missing h1 | |

**User's choice:** Standardize headings
**Notes:** None

### Route Focus Management
| Option | Description | Selected |
|--------|-------------|----------|
| Focus heading on navigation | Move focus to h1 after client-side navigation | ✓ |
| Focus main content area | Move focus to <main> element on navigation | |
| No route focus management | Let the browser handle it | |

**User's choice:** Focus heading on navigation
**Notes:** None

### Landmark Roles
| Option | Description | Selected |
|--------|-------------|----------|
| Verify and add landmarks | Ensure semantic elements correct, add aria-label for multiple navs | ✓ |
| Skip — trust HTML structure | Only fix if screen reader audit reveals gaps | |

**User's choice:** Verify and add landmarks
**Notes:** None

---

## Edge Case Hardening

### Text Overflow Handling
| Option | Description | Selected |
|--------|-------------|----------|
| Truncate with tooltip | Ellipsis on cards, full name on hover and detail page | |
| Wrap and grow | Let long names wrap, cards grow taller | |
| Character limit on input | Enforce max character limit on nicknames and room names | ✓ |

**User's choice:** Character limit on input
**Notes:** None

### Large Collection Handling
| Option | Description | Selected |
|--------|-------------|----------|
| Pagination + loading | Server-side pagination (20-30 per page), dashboard stays unpaginated | ✓ |
| Virtual scrolling | @tanstack/react-virtual for plant grid | |
| Defer to v2 | Target audience is 1-30 plants, performance testing can wait | |

**User's choice:** Pagination + loading
**Notes:** None

### Network Error Handling
| Option | Description | Selected |
|--------|-------------|----------|
| Graceful error states | Inline errors, retry option, loading skeletons | ✓ |
| Toast errors + retry | All errors as toast with retry button | |
| Minimal — rely on optimistic UI | Only generic error fallback for failed requests | |

**User's choice:** Graceful error states
**Notes:** None

### Timezone Handling
| Option | Description | Selected |
|--------|-------------|----------|
| Display in user's local timezone | All dates in browser timezone, due today from local midnight, mismatch warning | ✓ |
| UTC everywhere with note | Display UTC with label | |
| Already handled — skip | Trust Phase 4 implementation | |

**User's choice:** Display in user's local timezone
**Notes:** None

---

## Claude's Discretion

- Empty state polish (shared component, illustrations, consistency) — user did not select this area for discussion
- Bottom tab bar icon selection and visual treatment
- Exact character limits for plant nicknames and room names
- Pagination UI design
- Loading skeleton design
- Status indicator icon choices
- Focus ring styling
- Skip-to-content link styling

## Deferred Ideas

- Reduced motion / prefers-reduced-motion support — deferred to post-v1
