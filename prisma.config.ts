import { defineConfig } from 'prisma/config'
import { loadLocalEnv } from './server/load-env.js'

loadLocalEnv()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
