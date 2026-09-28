# Clean Code Baseline — Phase 0

Captured 2026-04-30, prior to systematic clean-code review.

## Codebase shape

| Area | Files | Lines |
|---|---|---|
| convex/ | 62 | 11,876 |
| src/app/ | 65 | 10,368 |
| src/components/ | 86 | 12,714 |
| src/lib/ | 56 | 14,270 |
| **Total** | **~273** | **~49,000** |

## Files over 500 lines (god-object suspects)

| LOC | File |
|---|---|
| 3,807 | `src/lib/openui/components.tsx` |
| 1,278 | `src/components/workspace/chat-panel.tsx` |
| 981 | `src/app/api/chat/route.ts` |
| 827 | `convex/recommend/index.ts` |
| 804 | `src/lib/chat-utils.ts` |
| 799 | `src/app/r/[slug]/tour-artifact.tsx` |
| 719 | `src/lib/openui/influence-graph.tsx` |
| 701 | `convex/recommend/perplexityRecommend.ts` |
| 684 | `convex/recommend/mutations.ts` |
| 647 | `convex/influence.ts` |
| 627 | `convex/schema.ts` |
| 598 | `convex/wiki.ts` |
| 543 | `src/components/onboarding/quick-start-wizard.tsx` |
| 515 | `src/lib/web-tools/tumblr.ts` |

## Tooling state

- **TypeScript:** clean (`tsc --noEmit` passes).
- **ESLint:** configured (`eslint.config.mjs`), uses `eslint-config-next`. **168 problems** at baseline (83 errors, 85 warnings).
- **Vitest:** configured. ~14 test files concentrated in `convex/recommend/__tests__/` and `src/lib/__tests__/`.
- **Prettier:** not configured. Formatting is implicit.
- **Pre-commit hooks:** none.

## Lint findings — by rule

| Count | Rule |
|---|---|
| 54 | `@typescript-eslint/no-unused-vars` |
| 31 | `@typescript-eslint/no-explicit-any` |
| 24 | `react-hooks/rules-of-hooks` |
| 23 | `@next/next/no-img-element` |
| 5 | `react/no-unescaped-entities` |
| 2 | `prefer-const` |
| 2 | `react-hooks/exhaustive-deps` |
| 1 | `import/no-anonymous-default-export` |
| Others | misc small counts |

## Lint findings — by file (top 10)

| Count | File |
|---|---|
| 46 | `src/lib/openui/components.tsx` |
| 18 | `docs/crate-recommend-feature/pipeline.ts` |
| 10 | `src/components/onboarding/quick-start-wizard.tsx` |
| 10 | `convex/influence.ts` |
| 5 | `docs/crate-recommend-feature/pitchfork.ts` |
| 5 | `convex/recommend/index.ts` |
| 4 | `src/components/workspace/artifact-provider.tsx` |
| 4 | `src/components/tumblr/tumblr-feed.tsx` |
| 4 | `src/components/player/player-bar.tsx` |
| 3 | `src/providers/convex-provider.tsx` |

## Smell counts

| Count | Smell |
|---|---|
| 9 | `console.log` outside test files |
| 56 | `console.error` outside test files |
| 0 | `debugger` statements |
| 0 | `.only(` in tests |
| 0 | `.skip(` in tests |
| 2 | TODO / FIXME / HACK / XXX markers |
| 30 | runs of 3+ consecutive comment lines (potential commented-out code) |

## What this baseline tells us

### False-positive lint noise (will be filtered out)
- **24 of 24 `react-hooks/rules-of-hooks` errors** are in `src/lib/openui/components.tsx` and come from OpenUI Lang's `defineComponent({ component: ({ props }) => ... })` factory pattern. The arrow function IS a React component but ESLint cannot tell because it is not declared as `function ComponentName()`. Real fix is either rename the inner functions or scope-disable the rule for this file with a comment explaining the pattern.
- **23 lint violations in `docs/crate-recommend-feature/*.ts`** are planning docs being linted as production code. They should be excluded from lint scope.
- **~10 of 54 `no-unused-vars`** are underscore-prefixed args (`_extra`, `_args`, `_convexUrl`) that are intentional. Standard fix is to configure the rule to allow `_`-prefixed names.

After filtering: real lint debt is ~110 problems, not 168.

### Real lint debt (needs human judgment)
- **31 `no-explicit-any`** — type tightening, case-by-case during Phase 1 hot-path reviews.
- **23 `no-img-element`** — `<img>` instead of Next `<Image>`. Many are intentional (branding logos, `alt=""` decorative). Defer to Phase 1.
- **5 `no-unescaped-entities`** — quick fix, replace `'` with `&apos;` etc.
- **2 `prefer-const`** — trivial.
- **Remaining `no-unused-vars` (~44)** — actual unused symbols, defer to Phase 1 as part of file-by-file cleanup.

### Structural smells
- **`src/lib/openui/components.tsx` at 3,807 lines** is the single biggest cleanup opportunity. Likely 8-12 component files in a trench coat. This file alone holds 27% of all lint violations.
- **`docs/crate-recommend-feature/*` should not be in lint scope.** Old planning docs that the linter is treating as code.
- **30 runs of commented-out code** (heuristic). Many are in `convex/schema.ts` (legitimate field-level comments per row), but `convex/recommend/perplexityRecommend.ts` has 11 such blocks worth investigating during Phase 1.

## Phase 0 actions (this commit)

Mechanical fixes only — no structural refactors:

1. **ESLint config:** ignore `_`-prefixed unused args.
2. **ESLint config:** exclude `docs/**` from lint scope.
3. **ESLint config:** scope-disable `react-hooks/rules-of-hooks` in `src/lib/openui/components.tsx` with an explanatory comment.
4. **Fix `prefer-const`** violations (2 trivial).
5. **Fix `react/no-unescaped-entities`** (5 quick).
6. **Remove unused imports** flagged by `no-unused-vars` where the symbol is genuinely unreferenced (not underscore-prefixed).

After Phase 0: lint should drop from 168 → ~80 problems. Remaining debt becomes the input to Phase 1 hot-path reviews.

## Phase 0 results (this commit)

| Metric | Before | After | Delta |
|---|---|---|---|
| Total lint problems | 168 | 97 | **−71 (−42%)** |
| Errors | 83 | 37 | −46 |
| Warnings | 85 | 60 | −25 |
| TypeScript | clean | clean | — |
| Build | passes | passes | — |

What got eliminated:
- 24 `react-hooks/rules-of-hooks` false positives in `src/lib/openui/components.tsx` (config-scoped, the rule cannot recognize OpenUI Lang's `defineComponent` factory pattern).
- 23 lint violations in `docs/crate-recommend-feature/*.ts` (excluded from lint scope — they are planning docs, not production code).
- ~10 `no-unused-vars` warnings on underscore-prefixed args (now respected by config — matches TypeScript convention).
- 5 `no-unescaped-entities` errors fixed in `commands-reference.tsx` and `video-influence-chain.tsx`.
- 1 unused `ClerkProvider` import removed from `src/providers/convex-provider.tsx`.
- 3 now-redundant `// eslint-disable-next-line` comments removed from `src/lib/openui/components.tsx`.

What remains (input to Phase 1):
- 31 `@typescript-eslint/no-explicit-any` — type tightening, case-by-case during hot-path review.
- 23 `@next/next/no-img-element` — many are intentional branding cases; per-case judgment.
- ~44 real `@typescript-eslint/no-unused-vars` — actual dead symbols, defer to file-by-file Phase 1 cleanup.
- A handful of misc rules (exhaustive-deps, anonymous-default-export, etc.) — investigate per case.

## Phase 1 priority order (unchanged)

1. `convex/recommend/index.ts` — pipeline core, recently touched
2. `src/components/workspace/chat-panel.tsx` — chat is the product
3. `src/lib/openui/components.tsx` — the 3,800-line file
4. `src/app/api/chat/route.ts` — server entry point
5. `convex/wiki.ts` — touched this session
6. `convex/influence.ts` — Receipt is the wedge under sprint
