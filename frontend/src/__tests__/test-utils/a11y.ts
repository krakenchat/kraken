import { axe } from 'vitest-axe';
import type { AxeResults, Result, RunOptions } from 'axe-core';
import { expect } from 'vitest';

/**
 * axe-core wrapper for component-level a11y assertions.
 *
 * Two rules are disabled, both because these are component/fragment unit
 * tests, not full-page checks:
 * - `color-contrast`: jsdom performs no real layout/paint, so axe can't
 *   compute an accurate contrast ratio there — any result would be noise
 *   unrelated to the markup/ARIA semantics these tests actually care about.
 *   Real contrast is out of scope for unit tests; it belongs in a
 *   browser-based visual/e2e check if ever needed.
 * - `region`: fires when scanning `document.body` (needed for components
 *   that render via a portal, e.g. MUI Popover/Menu, since portaled content
 *   lands outside RTL's `container`) and flags that the rendered fragment
 *   isn't wrapped in a page landmark (header/nav/main) — true, but a
 *   property of the (nonexistent, in a unit test) surrounding page chrome,
 *   not of the component under test.
 */
export async function runAxe(
  container: Element,
  options?: RunOptions,
): Promise<AxeResults> {
  return axe(container, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
    },
    ...options,
  });
}

function formatViolation(violation: Result): string {
  const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ');
  return `${violation.id} (${violation.impact ?? 'unknown impact'}): ${violation.help}\n  targets: ${targets}\n  ${violation.helpUrl}`;
}

/**
 * Asserts an axe run found zero violations, with a readable failure message.
 *
 * We don't use vitest-axe's own `toHaveNoViolations` matcher: that package
 * (last published for vitest 0.x) is broken two different ways against this
 * project's vitest/TypeScript versions — its `vitest-axe/extend-expect`
 * entrypoint ships an empty `dist/extend-expect.js` (registers nothing at
 * runtime), and its `vitest-axe/matchers` entrypoint's .d.ts re-exports the
 * function via `export type *`, so TypeScript refuses to let it be used as a
 * value (`cannot be used as a value because it was exported using 'export
 * type'`). A plain assertion function sidesteps both issues.
 */
export function expectNoAxeViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const message = [
    `Expected no axe violations, found ${results.violations.length}:`,
    ...results.violations.map(formatViolation),
  ].join('\n\n');
  expect.fail(message);
}
