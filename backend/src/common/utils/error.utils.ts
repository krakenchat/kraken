/**
 * Error Handling Utilities
 *
 * Provides type-safe error message extraction and handling.
 */

/**
 * Safely extracts error message from unknown error type
 *
 * @param error - Unknown error object (from catch block)
 * @returns Error message string
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   this.logger.error(`Operation failed: ${getErrorMessage(error)}`);
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Safely extracts error stack trace from unknown error type
 *
 * @param error - Unknown error object (from catch block)
 * @returns Stack trace string or undefined
 *
 * @example
 * ```typescript
 * catch (error) {
 *   const stack = getErrorStack(error);
 *   if (stack) {
 *     this.logger.debug(`Stack trace: ${stack}`);
 *   }
 * }
 * ```
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}
