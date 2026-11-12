import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['rules-tests/**/*.test.ts'],
        fileParallelism: false,
        testTimeout: 20_000,
    },
});
