/**
 * logger.ts
 * Gated console output: log/warn only emit in development builds, and nothing
 * emits in tests so expected-failure paths stay quiet. Errors still reach the
 * production console because they are the only diagnostics available there.
 * @version 2026.11.13
 */
const IS_TEST = import.meta.env.MODE === 'test';

export const logger = {
    log: (...args: unknown[]) => {
        if (import.meta.env.DEV && !IS_TEST) console.log(...args);
    },
    warn: (...args: unknown[]) => {
        if (import.meta.env.DEV && !IS_TEST) console.warn(...args);
    },
    error: (...args: unknown[]) => {
        if (!IS_TEST) console.error(...args);
    }
};
