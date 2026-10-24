import { defineConfig, coverageConfigDefaults } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.API_PORT || '3001'

  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist/web',
    },
    server: {
      port: 5174,
      open: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: false,
        },
      },
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'client',
            environment: 'happy-dom',
            include: ['client/**/*.{test,spec}.{ts,tsx}'],
            setupFiles: ['client/__tests__/setup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            env: { RATE_LIMIT_PER_MINUTE: '100000' },
            include: ['server/**/*.{test,spec}.ts', 'shared/**/*.{test,spec}.ts'],
            exclude: ['**/*.db.{test,spec}.ts', '**/*.fuzz.{test,spec}.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'db',
            environment: 'node',
            env: { RATE_LIMIT_PER_MINUTE: '100000' },
            include: ['prisma/**/*.{test,spec}.ts', 'server/**/*.db.{test,spec}.ts'],
            globalSetup: ['prisma/__tests__/global-setup.ts'],
            setupFiles: ['prisma/__tests__/setup-test-database.ts'],
            fileParallelism: false,
          },
        },
        {
          extends: true,
          test: {
            name: 'fuzz',
            environment: 'node',
            env: {
              RATE_LIMIT_PER_MINUTE: '100000',
              SECRET_BOX_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
              ORDER_LINK_SECRET: 'fuzz-only-order-link-secret-at-least-32-chars',
              UPGRADER_API_URL: 'https://upgrader.example',
              UPGRADER_API_KEY: 'fuzz-only-not-a-real-key',
              NOWPAYMENTS_API_URL: 'https://nowpayments.example',
              NOWPAYMENTS_API_KEY: 'fuzz-only-not-a-real-key',
              NOWPAYMENTS_IPN_SECRET: 'fuzz-only-not-a-real-secret',
              RESEND_API_URL: 'https://resend.example',
              RESEND_API_KEY: 'fuzz-only-not-a-real-key',
              MAIL_FROM: 'orders@boostmyspot.example',
            },
            include: ['server/**/*.fuzz.{test,spec}.ts'],
            globalSetup: ['prisma/__tests__/global-setup.ts'],
            setupFiles: ['prisma/__tests__/setup-test-database.ts'],
            fileParallelism: false,
          },
        },
      ],
      coverage: {
        reportsDirectory: 'coverage',
        thresholds: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        include: [
          'client/**/*.{ts,tsx}',
          'server/**/*.ts',
          'shared/**/*.ts',
        ],
        exclude: [
          ...coverageConfigDefaults.exclude,
          '**/__tests__/**',
          'client/main.tsx',
          'client/auth/client.ts',
          'client/types/**',
          'server/generated/**',
          'server/types/**',
          'server/index.ts',
          'server/prisma.ts',
          'server/prisma-client.ts',
          'server/env.ts',
          'server/auth/auth.ts',
          'server/deps.ts',
          'server/worker/start.ts',
        ],
      },
    },
  }
})
