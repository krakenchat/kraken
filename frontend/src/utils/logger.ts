/**
 * Centralized Logging Utility
 *
 * Provides environment-aware logging that only outputs in development.
 * This prevents console pollution in production and potential information leakage.
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Logger utility with environment-aware methods
 */
export const logger = {
  /**
   * Log messages only in development
   * Completely silent in production
   */
  dev: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log info messages only in development
   */
  info: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Log warnings in all environments
   * Use for recoverable issues that should be monitored
   */
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },

  /**
   * Log errors in all environments
   * Use for actual errors that need attention
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },

  /**
   * Log debug information with prefix only in development
   */
  debug: (context: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(`[DEBUG:${context}]`, ...args);
    }
  },

  /**
   * Group logs only in development
   */
  group: (label: string): void => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * End log group only in development
   */
  groupEnd: (): void => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },
};

export default logger;
