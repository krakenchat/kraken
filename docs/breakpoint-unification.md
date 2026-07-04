# Breakpoint mismatch: `DEVICE_BREAKPOINTS` vs MUI theme defaults

Status: **documented, NOT changed.** After auditing the actual consumers, the
mismatch is benign and unifying is *not* clearly safe. Err on the side of not
changing (see decision below).

## The mismatch

Two breakpoint systems coexist:

- **`frontend/src/utils/breakpoints.ts`** — the app's own device model.
  `DEVICE_BREAKPOINTS.PHONE_LANDSCAPE = 768` is the mobile/tablet cutoff:
  `< 768px` is treated as mobile (single-column), `768–1199px` as tablet. This
  is what `useResponsive()` uses to derive `isMobile`, `isTablet`, and crucially
  **`shouldUseTouchUI`**, the gate for the whole mobile UX (incl. this phase's
  gesture layer).
- **The MUI theme** in `frontend/src/theme/themeConfig.ts` uses `createTheme`
  **without a `breakpoints` override**, so MUI's defaults apply:
  `xs=0, sm=600, md=900, lg=1200, xl=1536`. Note `md=900`, not `768`.

So "medium" means 768 in the device model and 900 in the MUI theme.

## Why it's benign today (the audit)

`theme.breakpoints` is consumed in exactly **one** place:
`frontend/src/hooks/useResponsive.ts`, which computes the back-compat exports
`isXs / isSm / isMd / isLg / isXl` via `theme.breakpoints.only(...)`.

Grepping the codebase (`src/**`, excluding tests):

- **No component reads `isXs / isSm / isMd / isLg / isXl`** from `useResponsive()`.
  They are dead back-compat surface. Changing where they flip would affect nobody.
- The **responsive-critical** decisions (`isMobile`, `isTablet`,
  `shouldUseTouchUI`, `useMobileBreakpoint`, `useCompactLayout`) are all driven by
  `DEVICE_BREAKPOINTS` **directly**, not by the MUI theme. They already agree on
  768. The mobile layout and gesture gating are unaffected by the theme's `md`.
- The only real consumers of MUI's default breakpoints are **`Grid size={{ xs,
  sm, md }}`** props in cosmetic/admin layouts:
  - `frontend/src/components/Profile/ClipLibrary.tsx`
  - `frontend/src/pages/admin/AdminDashboard.tsx`
  These grids were laid out around `md=900` (e.g. 3-up at `md`).

## Decision: do not change

Setting `breakpoints: { values: { ..., md: 768, ... } }` in `themeConfig.ts`
would be *mechanically* trivial, but it is **not visually safe**:

- It would silently change where the `ClipLibrary` and `AdminDashboard` grids
  reflow (3-up kicks in at 768 instead of 900), plus any future `sx={{ md: ... }}`
  responsive prop — a class of change that's easy to miss in review and only
  shows up visually at 768–900px widths.
- The upside is nil: the only thing that would "unify" is the set of dead
  `isMd/isSm` exports that nothing consumes.

Since the responsive-critical paths already agree on 768 and the theme's `md`
only affects unrelated grid cosmetics, the safe and correct move is to **leave
the theme defaults alone**.

## Migration path (if unification is ever wanted)

1. Add a custom `breakpoints.values` block to `generateTheme()` in
   `themeConfig.ts` mirroring `BREAKPOINTS` from `breakpoints.ts`
   (`sm=600, md=768, lg=1024, xl=1200`), so there is one source of truth.
2. Audit every `Grid size={{ ... }}` and `sx={{ sm/md/lg: ... }}` responsive
   object (currently `ClipLibrary`, `AdminDashboard`) and re-tune the column
   counts for the new `md=768` so they don't reflow too early.
3. Update the `isSm/isMd/...` comments in `useResponsive.ts` (they document the
   old `600–899 / 900–1199` ranges) or delete the dead exports outright.
4. Verify visually at the 768–900px band (tablet portrait), which is the only
   range whose behavior changes.

Until there's a concrete need, keeping the two systems separate — device model
at 768 for layout/touch, MUI defaults for incidental grid cosmetics — is the
lower-risk state.
