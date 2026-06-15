export default {
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    deps: {
      optimizer: {
        ssr: { enabled: false },
        client: { enabled: false },
      },
    },
  }
};
