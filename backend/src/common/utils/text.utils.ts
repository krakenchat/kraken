/**
 * Flattens message spans into a single searchable text string.
 * Extracts text from all spans and joins them with spaces.
 * Returns lowercase for case-insensitive search compatibility with MongoDB.
 */
export function flattenSpansToText(
  spans: { text?: string | null }[],
): string | undefined {
  const text = spans
    .filter((span) => span.text)
    .map((span) => span.text)
    .join(' ')
    .trim()
    .toLowerCase();
  return text.length > 0 ? text : undefined;
}
