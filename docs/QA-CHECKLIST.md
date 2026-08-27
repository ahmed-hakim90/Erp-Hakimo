# Product QA Checklist — 🏭 HAKIMO — نظام إدارة الإنتاج

## Functional/regression

- [ ] Primary journey works with realistic data and permission levels.
- [ ] Business rules, APIs, integrations, and side effects are preserved.
- [ ] Loading, empty, error, partial, stale, disabled, read-only, validation, success, and permission states are covered.
- [ ] Tests pass and all consumers of shared changes are checked.

## Visual/responsive/RTL

- [ ] Rendered QA completed at 320–375, 390–430, tablet, laptop, and large desktop.
- [ ] No overflow, clipping, layout jump, awkward density, or duplicate actions.
- [ ] RTL/LTR structure, icons, and directional controls are correct.
- [ ] Tokens, spacing, type, radii, color, elevation, and iconography are coherent.
- [ ] No generic AI slop, decorative clutter, or blind reference cloning.

## Accessibility/performance/completion

- [ ] Semantics, headings, labels, names, keyboard flow, focus, contrast, touch targets, and reduced motion pass.
- [ ] Dependency, bundle, render, query, caching, asset, and interaction costs are justified.
- [ ] Root cause and durable decisions are documented.
- [ ] A real rendered flow was inspected; compile/lint alone is not completion.
- [ ] Regression review follows: Foundation → Shared primitives → Shared patterns → Representative screens → Remaining screens → Responsive/RTL QA → Regression review.
