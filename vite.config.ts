import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';


export default defineConfig({
    plugins: [react(), viteTsconfigPaths()],
    server: {
        port: 3000,
        open: true,
        host: true,
    },
    build: {
        outDir: 'build',
        chunkSizeWarningLimit: 750,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
                    firebase: ['firebase/app', 'firebase/firestore']
                }
            }
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.ts',
        exclude: ['functions/**', 'node_modules/**'],
    },
});
